import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { getDevBypassWarningContext, isDevBypassAllowed, isDevBypassRequested } from './devBypass';

export async function resolveDevBypassDbUser() {
  if (!isDevBypassAllowed()) {
    if (isDevBypassRequested()) {
      console.warn('[DEV_BYPASS_AUTH] ignored because bypass is only allowed in local development.', getDevBypassWarningContext());
    }
    return null;
  }

  const devEmail = process.env.DEV_BYPASS_EMAIL ?? 'dev@localhost';
  const devClerkUserId = process.env.DEV_BYPASS_CLERK_USER_ID ?? `dev-bypass:${devEmail}`;
  const [existing] = await db.select().from(users).where(eq(users.email, devEmail)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: devClerkUserId,
      email: devEmail,
      fullName: 'Dev User',
    })
    .returning();

  return created ?? null;
}
