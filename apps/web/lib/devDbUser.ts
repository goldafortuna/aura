import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { getDevBypassWarningContext, isDevBypassAllowed, isDevBypassRequested } from './devBypass';
import { APPROVAL_STATUSES, serializeUserRoles, USER_ROLES, type ApprovalStatus, type UserRole } from './middleware/auth';

export async function resolveDevBypassDbUser() {
  if (!isDevBypassAllowed()) {
    if (isDevBypassRequested()) {
      console.warn('[DEV_BYPASS_AUTH] ignored because bypass is only allowed in local development.', getDevBypassWarningContext());
    }
    return null;
  }

  const devEmail = process.env.DEV_BYPASS_EMAIL ?? 'dev@localhost';
  const devClerkUserId = process.env.DEV_BYPASS_CLERK_USER_ID ?? `dev-bypass:${devEmail}`;
  const roleSet = new Set<string>(USER_ROLES);
  const roles = (process.env.DEV_BYPASS_ROLES ?? 'secretary')
    .split(',')
    .map((role) => role.trim())
    .filter((role): role is UserRole => roleSet.has(role));
  const approvalStatus = APPROVAL_STATUSES.includes(process.env.DEV_BYPASS_APPROVAL_STATUS as ApprovalStatus)
    ? (process.env.DEV_BYPASS_APPROVAL_STATUS as ApprovalStatus)
    : 'approved';
  const [existing] = await db.select().from(users).where(eq(users.email, devEmail)).limit(1);
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        clerkUserId: devClerkUserId,
        role: roles[0] ?? 'secretary',
        rolesJson: serializeUserRoles(roles.length > 0 ? roles : ['secretary']),
        approvalStatus,
        approvedAt: approvalStatus === 'approved' ? existing.approvedAt ?? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: devClerkUserId,
      email: devEmail,
      fullName: 'Dev User',
      role: roles[0] ?? 'secretary',
      rolesJson: serializeUserRoles(roles.length > 0 ? roles : ['secretary']),
      approvalStatus,
      approvedAt: approvalStatus === 'approved' ? new Date() : null,
    })
    .returning();

  return created ?? null;
}
