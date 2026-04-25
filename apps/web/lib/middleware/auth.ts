import { Context } from 'hono';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getDevBypassWarningContext, isDevBypassAllowed, isDevBypassRequested } from '../devBypass';

export const USER_ROLES = ['secretary', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

type DbUser = typeof users.$inferSelect;

const USER_ROLE_SET = new Set<string>(USER_ROLES);

function uniqRoles(roles: UserRole[]) {
  return [...new Set(roles)];
}

export function parseUserRoles(user: Pick<DbUser, 'role' | 'rolesJson'> | null | undefined): UserRole[] {
  if (!user) return [];

  try {
    const parsed = JSON.parse(user.rolesJson || '[]') as unknown;
    if (Array.isArray(parsed)) {
      const roles = parsed.filter((role): role is UserRole => typeof role === 'string' && USER_ROLE_SET.has(role));
      if (roles.length > 0) return uniqRoles(roles);
    }
  } catch {
    // Fall back to legacy role below.
  }

  return USER_ROLE_SET.has(user.role) ? [user.role as UserRole] : ['secretary'];
}

export function serializeUserRoles(roles: UserRole[]) {
  const normalized = uniqRoles(roles.filter((role) => USER_ROLE_SET.has(role)));
  return JSON.stringify(normalized.length > 0 ? normalized : ['secretary']);
}

export function getSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? process.env.SUPER_ADMIN_EMAIL ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapSuperAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.trim().toLowerCase());
}

function bootstrapAccessForEmail(email: string) {
  if (isBootstrapSuperAdminEmail(email)) {
    return {
      role: 'super_admin' as const,
      rolesJson: serializeUserRoles(['super_admin']),
      approvalStatus: 'approved' as const,
      approvedAt: new Date(),
    };
  }

  return {
    role: 'secretary' as const,
    rolesJson: serializeUserRoles(['secretary']),
    approvalStatus: 'pending' as const,
    approvedAt: null,
  };
}

function withBootstrapSuperAdminAccess(user: DbUser, email: string) {
  if (!isBootstrapSuperAdminEmail(email)) return null;

  const roles = parseUserRoles(user);
  const nextRoles = uniqRoles([...roles, 'super_admin']);
  const shouldUpdate =
    user.approvalStatus !== 'approved' ||
    !roles.includes('super_admin') ||
    user.role !== 'super_admin';

  if (!shouldUpdate) return null;

  return {
    role: 'super_admin' as const,
    rolesJson: serializeUserRoles(nextRoles),
    approvalStatus: 'approved' as const,
    approvedAt: user.approvedAt ?? new Date(),
    rejectedAt: null,
    rejectedReason: null,
  };
}

export function hasRole(user: Pick<DbUser, 'role' | 'rolesJson'> | null | undefined, role: UserRole) {
  return parseUserRoles(user).includes(role);
}

export function isSecretary(user: Pick<DbUser, 'role' | 'rolesJson'> | null | undefined) {
  return hasRole(user, 'secretary');
}

export function isSuperAdmin(user: Pick<DbUser, 'role' | 'rolesJson'> | null | undefined) {
  return hasRole(user, 'super_admin');
}

export function isApprovedUser(user: Pick<DbUser, 'approvalStatus'> | null | undefined) {
  return user?.approvalStatus === 'approved';
}

export async function requireDbUser(_c?: Context) {
  // Development bypass: set DEV_BYPASS_AUTH=1 and optionally DEV_BYPASS_EMAIL
  // to quickly test local API routes without Clerk auth. This should NEVER
  // be enabled in production.
  if (isDevBypassAllowed()) {
    const devEmail = process.env.DEV_BYPASS_EMAIL ?? 'dev@localhost';
    const devClerkUserId = process.env.DEV_BYPASS_CLERK_USER_ID ?? `dev-bypass:${devEmail}`;
    const devRoles = (process.env.DEV_BYPASS_ROLES ?? 'secretary')
      .split(',')
      .map((role) => role.trim())
      .filter((role): role is UserRole => USER_ROLE_SET.has(role));
    const devApprovalStatus = APPROVAL_STATUSES.includes(process.env.DEV_BYPASS_APPROVAL_STATUS as ApprovalStatus)
      ? (process.env.DEV_BYPASS_APPROVAL_STATUS as ApprovalStatus)
      : 'approved';
    console.warn('[DEV_BYPASS_AUTH] active, DEV_BYPASS_EMAIL=', devEmail);
    const [byEmail] = await db.select().from(users).where(eq(users.email, devEmail)).limit(1);
    if (byEmail) {
      const [updated] = await db
        .update(users)
        .set({
          clerkUserId: devClerkUserId,
          rolesJson: serializeUserRoles(devRoles.length > 0 ? devRoles : ['secretary']),
          role: devRoles[0] ?? 'secretary',
          approvalStatus: devApprovalStatus,
          approvedAt: devApprovalStatus === 'approved' ? byEmail.approvedAt ?? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, byEmail.id))
        .returning();
      return updated ?? byEmail;
    }
    const [created] = await db
      .insert(users)
      .values({
        clerkUserId: devClerkUserId,
        email: devEmail,
        fullName: 'Dev User',
        role: devRoles[0] ?? 'secretary',
        rolesJson: serializeUserRoles(devRoles.length > 0 ? devRoles : ['secretary']),
        approvalStatus: devApprovalStatus,
        approvedAt: devApprovalStatus === 'approved' ? new Date() : null,
      })
      .returning();
    console.warn('[DEV_BYPASS_AUTH] created dev user', devEmail);
    return created;
  }

  if (isDevBypassRequested()) {
    console.warn('[DEV_BYPASS_AUTH] ignored because bypass is only allowed in local development.', getDevBypassWarningContext());
  }

  const { userId } = await auth();
  if (!userId) {
    if (process.env.NODE_ENV !== 'production') console.debug('[requireDbUser] no userId from Clerk auth()');
    return null;
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    if (process.env.NODE_ENV !== 'production') console.debug('[requireDbUser] auth() returned userId but currentUser() is null');
    return null;
  }

  const primaryEmailAddress = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  const verifiedEmails = clerkUser.emailAddresses.filter((e) => e.verification?.status === 'verified');

  const primaryEmail =
    primaryEmailAddress?.emailAddress ??
    verifiedEmails[0]?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[requireDbUser]', { userId, primaryEmail });
  }
  if (!primaryEmail) return null;

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null;

  // Prefer lookup by Clerk user id
  const [byClerk] = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
  if (byClerk) {
    const bootstrapAccess = withBootstrapSuperAdminAccess(byClerk, primaryEmail);
    const [updated] = await db
      .update(users)
      .set({ email: primaryEmail, fullName, ...bootstrapAccess, updatedAt: new Date() })
      .where(eq(users.id, byClerk.id))
      .returning();
    return updated ?? byClerk;
  }

  // If a row already exists for this email (common after seeding / manual inserts),
  // attach it to the current Clerk user instead of failing the unique email constraint.
  const [byEmail] = await db.select().from(users).where(eq(users.email, primaryEmail)).limit(1);
  if (byEmail) {
    const bootstrapAccess = withBootstrapSuperAdminAccess(byEmail, primaryEmail);
    const [updated] = await db
      .update(users)
      .set({ clerkUserId: userId, fullName, ...bootstrapAccess, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning();
    return updated ?? byEmail;
  }

  const initialAccess = bootstrapAccessForEmail(primaryEmail);
  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: userId,
      email: primaryEmail,
      fullName,
      role: initialAccess.role,
      rolesJson: initialAccess.rolesJson,
      approvalStatus: initialAccess.approvalStatus,
      approvedAt: initialAccess.approvedAt,
    })
    .returning();

  return created;
}

export async function requireApprovedUser(c?: Context) {
  const dbUser = await requireDbUser(c);
  if (!dbUser || !isApprovedUser(dbUser)) return null;
  return dbUser;
}

export async function requireSecretary(c?: Context) {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser || !isSecretary(dbUser)) return null;
  return dbUser;
}

export async function requireSuperAdmin(c?: Context) {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser || !isSuperAdmin(dbUser)) return null;
  return dbUser;
}
