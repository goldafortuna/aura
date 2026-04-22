import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';

export async function requireDbUser() {
  const { userId } = auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primaryEmailAddress = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  const verifiedEmails = clerkUser.emailAddresses.filter((e) => e.verification?.status === 'verified');

  const primaryEmail =
    primaryEmailAddress?.emailAddress ??
    verifiedEmails[0]?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) return null;

  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || null;

  const [byClerk] = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
  if (byClerk) {
    const [updated] = await db
      .update(users)
      .set({ email: primaryEmail, fullName, updatedAt: new Date() })
      .where(eq(users.id, byClerk.id))
      .returning();
    return updated ?? byClerk;
  }

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
    .values({ clerkUserId: userId, email: primaryEmail, fullName })
    .returning();

  return created;
}
