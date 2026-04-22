import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';
import { resolveDevBypassDbUser } from '../../../../lib/devDbUser';
import { getObjectStorageProvider, uploadObject } from '../../../../lib/objectStorage';
import { validateUploadedFile } from '../../../../lib/utils/fileValidation';
import { internalServerErrorResponse } from '../../../../lib/nextHttpErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function sanitizeFilename(name: string) {
  return name
    .replace(/[^\w.\-()\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

async function resolveDbUser() {
  const devUser = await resolveDevBypassDbUser();
  if (devUser) return devUser;

  const { userId } = auth();
  if (!userId) return null;

  const [byClerk] = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
  return byClerk ?? null;
}

export async function POST(request: Request) {
  try {
    const dbUser = await resolveDbUser();
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User session ditemukan, tetapi profil database tidak cocok. Silakan login ulang.' },
        { status: 401 },
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Malformed multipart form data.';
      return NextResponse.json({ error: `Gagal membaca upload form: ${message}` }, { status: 400 });
    }

    const files = Array.from(formData.getAll('files')).filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Max ${MAX_FILES} files per upload.` }, { status: 400 });
    }

    const bucket = process.env.R2_BUCKET || process.env.OBJECT_STORAGE_BUCKET || 'documents';
    const now = Date.now();
    const results: Array<{
      filename: string;
      fileType: string;
      fileSize: number;
      storagePath: string;
    }> = [];

    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `File terlalu besar: ${file.name}. Maks 10MB.` },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const validation = validateUploadedFile(arrayBuffer, file.type);

      if (!validation.isValid) {
        return NextResponse.json(
          { error: `File validation failed for ${file.name}: ${validation.error}` },
          { status: 400 },
        );
      }

      const safeName = sanitizeFilename(file.name || 'dokumen');
      const random = Math.random().toString(16).slice(2);
      const storagePath = `documents/${dbUser.id}/${now}-${random}-${safeName}`;

      try {
        await uploadObject({
          path: storagePath,
          body: arrayBuffer,
          contentType: validation.detectedMimeType || 'application/octet-stream',
          upsert: false,
        });
      } catch (error) {
        const storageError = error instanceof Error ? error : new Error('Unknown storage error');
        const storageDetails = {
          provider: getObjectStorageProvider(),
          name: storageError.name,
          message: storageError.message,
          bucket,
          storagePath,
          fileType: validation.detectedMimeType || 'application/octet-stream',
          fileSize: file.size,
        };
        console.error('[uploads/documents] Object storage error:', storageDetails);
        return internalServerErrorResponse(
          'uploads/documents/storage-route',
          storageDetails,
          'Upload gagal diproses. Silakan coba lagi.',
        );
      }

      results.push({
        filename: safeName,
        fileType: validation.detectedMimeType || 'application/octet-stream',
        fileSize: file.size,
        storagePath,
      });
    }

    return NextResponse.json({ data: results }, { status: 201 });
  } catch (error) {
    return internalServerErrorResponse(
      'uploads/documents/route',
      error,
      'Upload gagal diproses. Silakan coba lagi.',
    );
  }
}
