import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

// ── Content Security Policy ────────────────────────────────────────────────
// Restricts what resources the browser is allowed to load.
// Tighten 'connect-src' when moving to a production API domain.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https:;
  connect-src 'self' http://localhost:8000 https://api.workwise.co.ke https://*.clerk.accounts.dev https://clerk.accounts.dev https://*.clerk.dev;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`.replace(/\s{2,}/g, ' ').trim();

// ── Security Headers ───────────────────────────────────────────────────────
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    // Prevent browsers from MIME-sniffing a response away from the declared content-type
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Prevent the page from being embedded in an iframe (clickjacking protection)
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Legacy XSS protection header (belt-and-suspenders for older browsers)
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    // Don't send the full referrer URL to cross-origin destinations
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Only enable HSTS when behind TLS in production.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    // Restrict browser features that the app doesn't need
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  // Apply security headers to all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders.filter(h => h.key),
      },
      // Service worker must not be cached — always serve fresh
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // Manifest should be fresh but can be cached briefly
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },

  turbopack: {
    root: frontendRoot,
  },

  // Webpack dev uses fewer inotify watches than Turbopack on Linux.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '../backend/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
