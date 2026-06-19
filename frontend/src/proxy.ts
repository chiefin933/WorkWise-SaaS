import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that do NOT require authentication
const isPublicRoute = createRouteMatcher([
  '/auth/login(.*)',
  '/auth/register(.*)',
  '/auth/accept-invite(.*)',
  '/api/webhooks(.*)',
  '/pricing(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Signed-in user hitting a public auth page → send to dashboard
  // Exception: accept-invite is allowed even when signed in (account switching)
  if (userId && isPublicRoute(req)) {
    if (req.nextUrl.pathname.startsWith('/auth/accept-invite')) {
      return NextResponse.next();
    }
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = '/';
    return NextResponse.redirect(dashboardUrl);
  }

  // All non-public routes require authentication
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
