/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === 'development';
const configuredR2PublicHostname = process.env.R2_PUBLIC_BASE_URL
  ? (() => {
      try {
        return new URL(process.env.R2_PUBLIC_BASE_URL).hostname;
      } catch {
        return null;
      }
    })()
  : null;
const r2ImageHostnames = Array.from(
  new Set(
    [
      configuredR2PublicHostname,
      'pub-e951d1d3a86e4a359e3f0da971bbb1e7.r2.dev',
      '*.r2.dev',
    ].filter(Boolean),
  ),
);
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval' " : ''}https://*.clerk.com https://*.clerk.accounts.dev https://js.clerk.dev https://challenges.cloudflare.com https://*.hcaptcha.com https://hcaptcha.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev ${r2ImageHostnames.map((hostname) => `https://${hostname}`).join(' ')}`,
  "font-src 'self' data: https:",
  `connect-src 'self' ${isDevelopment ? 'ws: wss: ' : ''}https: https://challenges.cloudflare.com https://*.hcaptcha.com https://hcaptcha.com`,
  "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.hcaptcha.com https://hcaptcha.com https://view.officeapps.live.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'object-src \'none\'',
].join('; ');

const academyPdfFrameCsp = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
      },
      ...r2ImageHostnames.map((hostname) => ({
        protocol: 'https',
        hostname,
      })),
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/academy/lessons/:path*/asset',
        headers: [
          { key: 'Content-Security-Policy', value: academyPdfFrameCsp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
