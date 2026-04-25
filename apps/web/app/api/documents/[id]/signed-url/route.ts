import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createSignedObjectUrl } from '../../../../../lib/objectStorage';
import { db } from '../../../../../db';
import { documents } from '../../../../../db/schema';
import { internalServerErrorResponse } from '../../../../../lib/nextHttpErrors';
import { requireSecretary } from '../../../../../lib/middleware/auth';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const dbUser = await requireSecretary();
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

