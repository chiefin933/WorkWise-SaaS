import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that do NOT require authentication
const isPublicRoute = createRouteMatcher([
  // Marketing
  '/',
  '/pricing(.*)',
  '/help(.*)',

  // Auth flows
  '/auth/login(.*)',
  '/auth/register(.*)',
  '/auth/accept-invite(.*)',

  // PWA + static files — must never be redirected to login
  '/manifest.json',
  '/sw.js',
  '/icons(.*)',
  '/robots.txt',
  '/favicon.ico',
  '/screenshots(.*)',

  // Webhooks & M-Pesa callbacks — server-to-server, no Clerk session
  '/api/webhooks(.*)',
  '/api/mpesa(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Signed-in user hitting a public auth page → send to their dashboard
  // Exception: accept-invite handles its own redirect logic (account switching)
  if (userId && isPublicRoute(req)) {
    const path = req.nextUrl.pathname;

    // Don't redirect PWA assets, webhooks, or the marketing home page
    if (
      path === '/' ||
      path === '/manifest.json' ||
      path === '/sw.js' ||
      path.startsWith('/icons') ||
      path.startsWith('/api/') ||
      path.startsWith('/auth/accept-invite')
    ) {
      return NextResponse.next();
    }

    // Redirect signed-in users away from /auth/login and /auth/register
    if (path.startsWith('/auth/')) {
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // All non-public routes require authentication
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static file extensions
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|otf)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
