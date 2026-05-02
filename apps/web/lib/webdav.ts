import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

type WebdavConnectionInput = {
  baseUrl: string;
  username: string;
  password: string;
  documentReviewFolder: string;
};

export type WebdavResolvedConfig = {
  baseUrl: string;
  username: string;
  password: string;
  documentReviewFolder: string;
  folderUrl: string;
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

function isBlockedIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIpAddress(address: string) {
  const ipVersion = isIP(address);
  if (ipVersion === 4) return isBlockedIpv4(address);
  if (ipVersion !== 6) return true;

  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isBlockedIpv4(normalized.slice('::ffff:'.length));
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('ff')
  );
}

function normalizeHostname(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '').toLowerCase();
}

function assertAllowedWebdavUrl(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('URL WebDAV harus menggunakan protokol http atau https.');
  }

  if (url.username || url.password) {
    throw new Error('URL WebDAV tidak boleh berisi kredensial.');
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('URL WebDAV harus mengarah ke host publik.');
  }

  if (isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new Error('URL WebDAV tidak boleh mengarah ke alamat lokal atau private.');
  }
}

async function assertPublicWebdavEndpoint(urlString: string) {
  const url = new URL(urlString);
  assertAllowedWebdavUrl(url);

  const hostname = normalizeHostname(url.hostname);
  if (isIP(hostname)) return;

  const addresses = await lookup(hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error('URL WebDAV harus mengarah ke alamat publik.');
  }
}

export function normalizeWebdavFolder(input: string) {
  const raw = input.trim();
  if (!raw) return '/';
  const collapsed = raw.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const prefixed = collapsed.startsWith('/') ? collapsed : `/${collapsed}`;
  return prefixed.length > 1 ? prefixed.replace(/\/+$/, '') : '/';
}

export function resolveWebdavConfig(input: WebdavConnectionInput): WebdavResolvedConfig {
  const baseUrl = input.baseUrl.trim();
  const username = input.username.trim();
  const password = input.password;
  const documentReviewFolder = normalizeWebdavFolder(input.documentReviewFolder);

  const parsedBaseUrl = new URL(baseUrl);
  assertAllowedWebdavUrl(parsedBaseUrl);
  const normalizedBasePath = trimTrailingSlashes(parsedBaseUrl.pathname || '');
  const effectivePath = `${normalizedBasePath}${documentReviewFolder === '/' ? '' : documentReviewFolder}`;
  parsedBaseUrl.pathname = effectivePath || '/';
  parsedBaseUrl.search = '';
  parsedBaseUrl.hash = '';

  return {
    baseUrl: trimTrailingSlashes(baseUrl),
    username,
    password,
    documentReviewFolder,
    folderUrl: parsedBaseUrl.toString(),
  };
}

function buildBasicAuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

function createWebdavHeaders(username: string, password: string, extra?: Record<string, string>) {
  return {
    Authorization: buildBasicAuthHeader(username, password),
    ...(extra ?? {}),
  };
}

function splitFolderSegments(folder: string) {
  return normalizeWebdavFolder(folder).split('/').filter(Boolean);
}

function buildFolderUrl(baseUrl: string, segments: string[]) {
  const url = new URL(baseUrl);
  const baseSegments = url.pathname.split('/').filter(Boolean);
  url.pathname = `/${[...baseSegments, ...segments].map(encodeURIComponent).join('/')}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function ensureWebdavFolder(input: WebdavConnectionInput) {
  const resolved = resolveWebdavConfig(input);
  const segments = splitFolderSegments(resolved.documentReviewFolder);

  for (let index = 0; index < segments.length; index += 1) {
    const partialUrl = buildFolderUrl(resolved.baseUrl, segments.slice(0, index + 1));
    await assertPublicWebdavEndpoint(partialUrl);
    const response = await fetch(partialUrl, {
      method: 'MKCOL',
      headers: createWebdavHeaders(resolved.username, resolved.password),
      cache: 'no-store',
      redirect: 'manual',
    });

    if ([201, 405].includes(response.status)) continue;
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) continue;
    if (response.status === 409) {
      throw new Error(`Folder induk WebDAV untuk ${resolved.documentReviewFolder} belum tersedia.`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('Autentikasi WebDAV gagal saat membuat folder.');
    }
    throw new Error(`Gagal menyiapkan folder WebDAV (HTTP ${response.status}).`);
  }

  return resolved;
}

export async function uploadFileToWebdav(
  input: WebdavConnectionInput & {
    filename: string;
    body: ArrayBuffer | Uint8Array | Buffer;
    contentType?: string;
  },
) {
  const resolved = await ensureWebdavFolder(input);
  const targetUrl = new URL(resolved.folderUrl);
  const folderSegments = targetUrl.pathname.split('/').filter(Boolean);
  targetUrl.pathname = `/${[...folderSegments, input.filename].map(encodeURIComponent).join('/')}`;
  await assertPublicWebdavEndpoint(targetUrl.toString());
  const requestBody =
    input.body instanceof ArrayBuffer
      ? Buffer.from(input.body)
      : Buffer.isBuffer(input.body)
        ? input.body
        : Buffer.from(input.body);
  const requestBytes = Uint8Array.from(requestBody);
  const requestBlob = new Blob([requestBytes], {
    type: input.contentType || 'application/octet-stream',
  });

  const response = await fetch(targetUrl.toString(), {
    method: 'PUT',
    headers: createWebdavHeaders(resolved.username, resolved.password, {
      'Content-Type': input.contentType || 'application/octet-stream',
    }),
    body: requestBlob,
    cache: 'no-store',
    redirect: 'manual',
  });

  if (![200, 201, 204].includes(response.status)) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Autentikasi WebDAV gagal saat upload file.');
    }
    throw new Error(`Upload WebDAV gagal (HTTP ${response.status}).`);
  }

  return {
    ...resolved,
    fileUrl: targetUrl.toString(),
  };
}

export async function verifyWebdavConnection(input: WebdavConnectionInput) {
  const resolved = resolveWebdavConfig(input);
  await assertPublicWebdavEndpoint(resolved.folderUrl);
  const headers = {
    Authorization: buildBasicAuthHeader(resolved.username, resolved.password),
  };

  const propfindRes = await fetch(resolved.folderUrl, {
    method: 'PROPFIND',
    headers: {
      ...headers,
      Depth: '0',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname /></d:prop></d:propfind>`,
    cache: 'no-store',
    redirect: 'manual',
  });

  if ([200, 207].includes(propfindRes.status)) {
    return {
      ok: true as const,
      status: propfindRes.status,
      message: `Koneksi WebDAV berhasil. Folder ${resolved.documentReviewFolder} dapat diakses.`,
      resolved,
    };
  }

  if ([401, 403].includes(propfindRes.status)) {
    return {
      ok: false as const,
      status: propfindRes.status,
      message: 'Autentikasi WebDAV gagal. Periksa username dan password.',
      resolved,
    };
  }

  if (propfindRes.status === 404) {
    return {
      ok: false as const,
      status: propfindRes.status,
      message: `Folder ${resolved.documentReviewFolder} tidak ditemukan di server WebDAV.`,
      resolved,
    };
  }

  if (propfindRes.status === 405) {
    const headRes = await fetch(resolved.folderUrl, {
      method: 'HEAD',
      headers,
      cache: 'no-store',
      redirect: 'manual',
    });
    if (headRes.ok) {
      return {
        ok: true as const,
        status: headRes.status,
        message: `Koneksi WebDAV berhasil. Folder ${resolved.documentReviewFolder} merespons permintaan HEAD.`,
        resolved,
      };
    }

    return {
      ok: false as const,
      status: headRes.status,
      message: `Server WebDAV merespons ${headRes.status}. Pastikan URL dan folder benar.`,
      resolved,
    };
  }

  return {
    ok: false as const,
    status: propfindRes.status,
    message: `Server WebDAV merespons ${propfindRes.status}. Pastikan URL, folder, dan izin akses sudah benar.`,
    resolved,
  };
}
