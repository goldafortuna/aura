import { NextResponse } from 'next/server';
import { requireSecretary } from '../../../../lib/middleware/auth';
import { uploadObject } from '../../../../lib/objectStorage';
import { validateUploadedFile } from '../../../../lib/utils/fileValidation';
import { internalServerErrorResponse } from '../../../../lib/nextHttpErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 1;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function sanitizeFilename(name: string) {
  return name
    .replace(/[^\w.\-()\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const dbUser = await requireSecretary();
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User session ditemukan, tetapi profil database tidak cocok. Silakan login ulang.' },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const files = Array.from(formData.getAll('files')).filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: 'Max 1 file per upload.' }, { status: 400 });
    }

    const file = files[0]!;
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File terlalu besar: ${file.name}. Maks 10MB.` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const validation = validateUploadedFile(arrayBuffer, file.type);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `File validation failed for ${file.name}: ${validation.error}` },
        { status: 400 },
      );
    }

    const safeName = sanitizeFilename(file.name || 'notula');
    const random = Math.random().toString(16).slice(2);
    const storagePath = `meeting-minutes/${dbUser.id}/${Date.now()}-${random}-${safeName}`;

    await uploadObject({
      path: storagePath,
      body: arrayBuffer,
      contentType: validation.detectedMimeType || 'application/octet-stream',
      upsert: false,
    });

    return NextResponse.json(
      {
        data: {
          filename: safeName,
          fileType: validation.detectedMimeType || 'application/octet-stream',
          fileSize: file.size,
          storagePath,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return internalServerErrorResponse(
      'uploads/meeting-minutes-route',
      error,
      'Upload gagal diproses. Silakan coba lagi.',
    );
  }
}
