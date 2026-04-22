const DEFAULT_LOCAL_DEV_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function parseAllowedHosts() {
  const envHosts = (process.env.DEV_ENDPOINT_HOST_ALLOWLIST || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_LOCAL_DEV_HOSTS, ...envHosts]);
}

function extractHostname(request: Request) {
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function assertLocalDevEndpointAllowed(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return {
      ok: false as const,
      status: 403,
      error: 'Dev-only endpoint is disabled outside local development.',
    };
  }

  const hostname = extractHostname(request);
  const allowedHosts = parseAllowedHosts();
  if (!hostname || !allowedHosts.has(hostname)) {
    return {
      ok: false as const,
      status: 403,
      error: 'Dev-only endpoint is only available from an allowlisted local host.',
    };
  }

  return {
    ok: true as const,
  };
}
