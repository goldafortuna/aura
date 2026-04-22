import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ObjectStorageProvider = 'cloudflare-r2' | 'local';

export type UploadObjectInput = {
  path: string;
  body: ArrayBuffer | Uint8Array | Buffer;
  contentType?: string;
  upsert?: boolean;
};

export type UploadObjectResult = {
  path: string;
};

export type DownloadObjectResult = {
  body: Uint8Array;
  contentType?: string | null;
};

export type SignedUrlResult = {
  url: string;
  expiresIn: number;
};

export type ObjectStorageDebugInfo = {
  provider: ObjectStorageProvider;
  bucket: string;
  endpointHost?: string;
  endpointOrigin?: string;
  publicBaseUrl?: string;
};

type ProviderConfig =
  | {
      provider: 'local';
      bucket: string;
      rootDir: string;
    }
  | {
      provider: 'cloudflare-r2';
      bucket: string;
      endpoint: string;
      accountId?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
    };

function normalizeBytes(body: UploadObjectInput['body']): Uint8Array | Buffer {
  if (body instanceof Uint8Array || Buffer.isBuffer(body)) return body;
  return new Uint8Array(body);
}

function getProviderConfig(): ProviderConfig {
  const provider = (process.env.OBJECT_STORAGE_PROVIDER || 'cloudflare-r2').trim().toLowerCase();

  if (provider === 'local') {
    return {
      provider: 'local',
      bucket: process.env.OBJECT_STORAGE_BUCKET || 'local-dev',
      rootDir: process.env.LOCAL_OBJECT_STORAGE_DIR || path.join(process.cwd(), '.local-object-storage'),
    };
  }

  if (provider === 'cloudflare-r2' || provider === 'r2') {
    const bucket = process.env.R2_BUCKET || process.env.OBJECT_STORAGE_BUCKET || 'documents';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const endpoint =
      process.env.R2_ENDPOINT ||
      (process.env.CLOUDFLARE_ACCOUNT_ID
        ? `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : '');

    if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error(
        'R2 env not configured. Set OBJECT_STORAGE_PROVIDER=cloudflare-r2 plus R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT or CLOUDFLARE_ACCOUNT_ID.',
      );
    }

    return {
      provider: 'cloudflare-r2',
      bucket,
      endpoint,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || undefined,
    };
  }

  throw new Error(
    'Unsupported object storage provider. Set OBJECT_STORAGE_PROVIDER to "cloudflare-r2" or "local".',
  );
}

function toDebugInfo(config: ProviderConfig): ObjectStorageDebugInfo {
  if (config.provider === 'local') {
    return {
      provider: config.provider,
      bucket: config.bucket,
      endpointOrigin: config.rootDir,
    };
  }

  const endpoint = new URL(config.endpoint);
  return {
    provider: config.provider,
    bucket: config.bucket,
    endpointHost: endpoint.host,
    endpointOrigin: endpoint.origin,
    publicBaseUrl: config.publicBaseUrl,
  };
}

function createR2Client(config: Extract<ProviderConfig, { provider: 'cloudflare-r2' }>) {
  const normalizedEndpoint = new URL(config.endpoint);

  // Accept env values copied from dashboard/docs that may include a bucket suffix.
  // S3 client endpoint must point to the account endpoint, while bucket stays separate.
  if (normalizedEndpoint.pathname !== '/' && normalizedEndpoint.pathname !== '') {
    const trimmedPath = normalizedEndpoint.pathname.replace(/\/+$/, '');
    if (trimmedPath === `/${config.bucket}`) {
      normalizedEndpoint.pathname = '/';
    }
  }

  return new S3Client({
    region: 'auto',
    endpoint: normalizedEndpoint.toString(),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function resolveLocalObjectAbsolutePath(config: Extract<ProviderConfig, { provider: 'local' }>, objectPath: string) {
  const normalized = path.posix.normalize(`/${objectPath}`).slice(1);
  if (!normalized || normalized.startsWith('..')) {
    throw new Error('Invalid local storage path.');
  }

  return path.join(config.rootDir, ...normalized.split('/'));
}

function inferContentTypeFromPath(objectPath: string) {
  const ext = path.extname(objectPath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function streamToUint8Array(stream: unknown): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  if (stream instanceof Uint8Array) return stream;
  if (Buffer.isBuffer(stream)) return new Uint8Array(stream);
  if (typeof Blob !== 'undefined' && stream instanceof Blob) {
    return new Uint8Array(await stream.arrayBuffer());
  }
  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      chunks.push(chunk);
      total += chunk.length;
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  const asyncIterable = stream as AsyncIterable<Uint8Array | Buffer | string>;
  if (typeof asyncIterable[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const part of asyncIterable) {
      const chunk =
        typeof part === 'string'
          ? new TextEncoder().encode(part)
          : part instanceof Uint8Array
            ? part
            : new Uint8Array(part);
      chunks.push(chunk);
      total += chunk.length;
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  throw new Error('Unsupported storage download stream.');
}

export function getObjectStorageProvider(): ObjectStorageProvider {
  return getProviderConfig().provider;
}

export function getObjectStorageDebugInfo(): ObjectStorageDebugInfo {
  return toDebugInfo(getProviderConfig());
}

export async function probeObjectStorageConnection() {
  const config = getProviderConfig();

  if (config.provider === 'local') {
    await mkdir(config.rootDir, { recursive: true });
    return {
      ...toDebugInfo(config),
      ok: true as const,
      itemCountSample: 0,
    };
  }

  const client = createR2Client(config);
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      MaxKeys: 1,
    }),
  );

  return {
    ...toDebugInfo(config),
    ok: true as const,
    itemCountSample: result.KeyCount ?? 0,
  };
}

export async function uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
  const config = getProviderConfig();
  const body = normalizeBytes(input.body);

  if (config.provider === 'local') {
    const absolutePath = resolveLocalObjectAbsolutePath(config, input.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return { path: input.path };
  }

  const client = createR2Client(config);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: input.path,
        Body: body,
        ContentType: input.contentType || 'application/octet-stream',
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown R2 upload error.';
    const endpointHost = new URL(config.endpoint).host;
    throw new Error(`R2 upload failed (${endpointHost}/${config.bucket}): ${message}`);
  }

  return { path: input.path };
}

export async function downloadObject(path: string): Promise<DownloadObjectResult> {
  const config = getProviderConfig();

  if (config.provider === 'local') {
    const absolutePath = resolveLocalObjectAbsolutePath(config, path);
    const body = await readFile(absolutePath);
    return {
      body: new Uint8Array(body),
      contentType: inferContentTypeFromPath(path),
    };
  }

  const client = createR2Client(config);
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: path,
    }),
  );

  return {
    body: await streamToUint8Array(result.Body),
    contentType: result.ContentType || null,
  };
}

export async function removeObjects(paths: string[]): Promise<void> {
  const normalized = paths.filter(Boolean);
  if (normalized.length === 0) return;

  const config = getProviderConfig();

  if (config.provider === 'local') {
    for (const objectPath of normalized) {
      const absolutePath = resolveLocalObjectAbsolutePath(config, objectPath);
      try {
        await stat(absolutePath);
        await rm(absolutePath, { force: true });
      } catch {
        // Ignore missing files in local dev storage.
      }
    }
    return;
  }

  const client = createR2Client(config);
  await client.send(
    new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: normalized.map((path) => ({ Key: path })),
        Quiet: true,
      },
    }),
  );
}

export async function createSignedObjectUrl(path: string, expiresIn: number): Promise<SignedUrlResult> {
  const config = getProviderConfig();

  if (config.provider === 'local') {
    return {
      url: `/api/storage/object?path=${encodeURIComponent(path)}`,
      expiresIn,
    };
  }

  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.replace(/\/$/, '');
    return {
      url: `${base}/${encodeURI(path)}`,
      expiresIn,
    };
  }

  const client = createR2Client(config);
  const url = await getS3SignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: path,
    }),
    { expiresIn },
  );

  return { url, expiresIn };
}
