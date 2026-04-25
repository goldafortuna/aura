import { NextResponse } from 'next/server';
import { getObjectStorageDebugInfo } from '../../../../lib/objectStorage';
import { requireApprovedUser } from '../../../../lib/middleware/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const dbUser = await requireApprovedUser();
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const storage = getObjectStorageDebugInfo();

  return NextResponse.json({
    data: {
      provider: storage.provider,
      bucket: storage.bucket,
    },
  });
}
