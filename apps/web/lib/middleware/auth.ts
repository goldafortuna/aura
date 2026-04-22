import { Context } from 'hono';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getDevBypassWarningContext, isDevBypassAllowed, isDevBypassRequested } from '../devBypass';

export async function requireDbUser(_c: Context) {
  // Development bypass: set DEV_BYPASS_AUTH=1 and optionally DEV_BYPASS_EMAIL
  // to quickly test local API routes without Clerk auth. This should NEVER
  // be enabled in production.
  if (isDevBypassAllowed()) {
    const devEmail = process.env.DEV_BYPASS_EMAIL ?? 'dev@localhost';
    const devClerkUserId = process.env.DEV_BYPASS_CLERK_USER_ID ?? `dev-bypass:${devEmail}`;
    console.warn('[DEV_BYPASS_AUTH] active, DEV_BYPASS_EMAIL=', devEmail);
    const [byEmail] = await db.select().from(users).where(eq(users.email, devEmail)).limit(1);
    if (byEmail) return byEmail;
    const [created] = await db
      .insert(users)
      .values({ clerkUserId: devClerkUserId, email: devEmail, fullName: 'Dev User' })
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
    const [updated] = await db
      .update(users)
      .set({ email: primaryEmail, fullName, updatedAt: new Date() })
      .where(eq(users.id, byClerk.id))
      .returning();
    return updated ?? byClerk;
  }

  // If a row already exists for this email (common after seeding / manual inserts),
  // attach it to the current Clerk user instead of failing the unique email constraint.
  const [byEmail] = await db.select().from(users).where(eq(users.email, primaryEmail)).limit(1);
  if (byEmail) {
    const [updated] = await db
      .update(users)
      .set({ clerkUserId: userId, fullName, updatedAt: new Date() })
      .where(eq(users.id, byEmail.id))
      .returning();
    return updated ?? byEmail;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: userId,
      email: primaryEmail,
      fullName,
    })
    .returning();

  return created;
}
