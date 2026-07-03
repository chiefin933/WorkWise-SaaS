import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Public routes — accessible without authentication.
 * Everything else requires a valid Clerk session.
 */
const isPublicRoute = createRouteMatcher([
  // Marketing
  '/',
  '/pricing',
  '/pricing(.*)',

  // Auth flows
  '/auth(.*)',

  // PWA + static assets — must NOT be redirected to login
  '/manifest.json',
  '/sw.js',
  '/icons(.*)',
  '/robots.txt',
  '/favicon.ico',
  '/screenshots(.*)',

  // API webhooks (verified by SVIX signature, not Clerk JWT)
  '/api/webhooks(.*)',

  // M-Pesa callbacks (called by Safaricom, not by authenticated users)
  '/api/mpesa(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.ico$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
