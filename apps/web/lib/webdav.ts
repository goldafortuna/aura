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
    const response = await fetch(partialUrl, {
      method: 'MKCOL',
      headers: createWebdavHeaders(resolved.username, resolved.password),
      cache: 'no-store',
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
