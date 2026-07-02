/**
 * WorkWise Service Worker
 * -----------------------
 * Caching strategy:
 *   - App shell (JS/CSS bundles, fonts, icons, manifest): Cache-first with network fallback
 *   - All API calls (/api/*, Django backend): Network-only — NEVER cached
 *     Correctness-critical: payroll, finance, attendance data must always be live.
 *   - Navigation (HTML pages): Network-first with cache fallback
 *
 * Registered only in production (see ServiceWorkerRegistration component).
 */

const CACHE_NAME = 'workwise-shell-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

// Patterns that must NEVER be served from cache
const NEVER_CACHE_PATTERNS = [
  /\/api\//,                          // Django backend API
  /localhost:8000/,                   // Local Django dev server
  /api\.workwise\.co\.ke/,            // Production backend
  /supabase\.co/,                     // Supabase direct calls
  /clerk\.accounts\.dev/,             // Clerk auth API
  /\/__nextjs/,                       // Next.js internal
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        // Don't fail install if pre-cache assets are unavailable
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route requests through the right strategy ─────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache API calls — always go to network
  const isApiCall = NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(request.url));
  if (isApiCall) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Only handle GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Static assets (JS/CSS/images/fonts): Cache-first, update in background
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(js|css|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|svg|webp)$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // 4. HTML navigation: Network-first, fall back to cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // 5. Everything else: network only
  event.respondWith(fetch(request));
});
