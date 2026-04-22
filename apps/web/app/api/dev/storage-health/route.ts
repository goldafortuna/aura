import { NextResponse } from 'next/server';
import { assertLocalDevEndpointAllowed } from '../../../../lib/devEndpointAccess';
import { getObjectStorageDebugInfo, probeObjectStorageConnection } from '../../../../lib/objectStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = assertLocalDevEndpointAllowed(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const result = await probeObjectStorageConnection();
    return NextResponse.json({ ok: true, storage: result });
  } catch (error) {
    const details = getObjectStorageDebugInfo();
    const message = error instanceof Error ? error.message : 'Unknown storage probe error';

    console.error('[dev/storage-health] Probe failed:', {
      ...details,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
        storage: details,
      },
      { status: 500 },
    );
  }
}
