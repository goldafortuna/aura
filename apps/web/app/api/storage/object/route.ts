import { NextResponse } from 'next/server';
import { downloadObject } from '../../../../lib/objectStorage';
import { userOwnsStoragePath } from '../../../../lib/storageAccess';
import { internalServerErrorResponse } from '../../../../lib/nextHttpErrors';
import { requireSecretary } from '../../../../lib/middleware/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const dbUser = await requireSecretary();
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const objectPath = url.searchParams.get('path');
  if (!objectPath) {
    return NextResponse.json({ error: 'Missing storage path.' }, { status: 400 });
  }

  const ownership = await userOwnsStoragePath(dbUser.id, objectPath);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: 403 });
  }

  try {
    const downloaded = await downloadObject(ownership.normalizedPath);
    const filename = ownership.normalizedPath.split('/').pop() || 'download';

    return new Response(Buffer.from(downloaded.body), {
      headers: {
        'Content-Type': downloaded.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(downloaded.body.byteLength),
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    return internalServerErrorResponse(
      'storage/object',
      error,
      'Gagal membaca file. Silakan coba lagi.',
    );
  }
}
