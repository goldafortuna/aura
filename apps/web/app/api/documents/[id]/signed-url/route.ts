import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createSignedObjectUrl } from '../../../../../lib/objectStorage';
import { db } from '../../../../../db';
import { documents, users } from '../../../../../db/schema';
import { auth } from '@clerk/nextjs/server';
import { resolveDevBypassDbUser } from '../../../../../lib/devDbUser';
import { internalServerErrorResponse } from '../../../../../lib/nextHttpErrors';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const bypassUser = await resolveDevBypassDbUser();
  const userId = bypassUser ? null : (await auth()).userId;
  const [dbUser] = bypassUser
    ? [bypassUser]
    : userId
      ? await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1)
      : [];
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, dbUser.id)))
    .limit(1);

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const expiresIn = 60 * 10; // 10 minutes

  try {
    const signed = await createSignedObjectUrl(doc.storagePath, expiresIn);
    return NextResponse.json({ data: { url: signed.url, expiresIn: signed.expiresIn } });
  } catch (error) {
    return internalServerErrorResponse(
      'documents/signed-url',
      error,
      'Gagal membuat tautan dokumen. Silakan coba lagi.',
    );
  }
}

