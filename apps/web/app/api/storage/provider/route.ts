import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { resolveDevBypassDbUser } from '../../../../lib/devDbUser';
import { getObjectStorageDebugInfo } from '../../../../lib/objectStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const devUser = await resolveDevBypassDbUser();
  if (!devUser) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const storage = getObjectStorageDebugInfo();

  return NextResponse.json({
    data: {
      provider: storage.provider,
      bucket: storage.bucket,
    },
  });
}
