'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { setTokenGetter } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const ROLE_HOME: Record<string, string> = {
  ADMIN:    '/dashboard',
  HR:       '/hr',
  FINANCE:  '/finance',
  EMPLOYEE: '/employee',
};

/** Delay helper */
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Waits until Clerk can produce a non-null JWT, with exponential backoff.
 * Returns the token, or null if all attempts fail.
 */
async function waitForToken(
  getToken: () => Promise<string | null>,
  maxAttempts = 8,
): Promise<string | null> {
  let token: string | null = null;
  let wait = 200; // ms — doubles each attempt

  for (let i = 0; i < maxAttempts; i++) {
    token = await getToken();
    if (token) return token;
    await delay(wait);
    wait = Math.min(wait * 2, 2000); // cap at 2 s
  }
  return null;
}

export function ClerkTokenProvider() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const didRedirect  = useRef(false);
  const didFetch     = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      // Wire Axios interceptor — must happen every render cycle so the getter
      // always holds a reference to the current Clerk session's getToken.
      setTokenGetter(() => getToken());

      const { hasFetched, isLoading, fetchUser } = useAuthStore.getState();

      // Only fetch once per sign-in session
      if (hasFetched || isLoading || didFetch.current) return;
      didFetch.current = true;

      const doFetch = async () => {
        // Block until Clerk can actually produce a JWT — prevents 401 race
        const token = await waitForToken(getToken);

        if (!token) {
          console.warn('[ClerkTokenProvider] Could not obtain Clerk token after retries. Skipping fetchUser.');
          return;
        }

        try {
          await fetchUser();
        } catch {
          // fetchUser records the error in the store (fetchError field).
          // AppLayout reads store.fetchError and renders the appropriate screen.
          return;
        }

        // ── Role-based redirect after successful profile load ──────────────
        if (didRedirect.current) return;
        const { user } = useAuthStore.getState();
        if (!user?.role) return;

        const isInviteLanding = searchParams.get('invited') === '1';
        const isRoot = pathname === '/' || pathname === '/dashboard';
        const fromLogin =
          document.referrer.includes('/auth/login') ||
          document.referrer === '' ||
          isInviteLanding;

        if ((isRoot && fromLogin) || isInviteLanding) {
          const home = ROLE_HOME[user.role] ?? '/dashboard';
          didRedirect.current = true;
          if (pathname !== home) router.replace(home);
        }
      };

      doFetch();
    } else {
      // User signed out — reset all refs so a fresh sign-in retriggers fetch
      didRedirect.current = false;
      didFetch.current    = false;
      useAuthStore.getState().clearUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);
  // NOTE: getToken, pathname, router, searchParams intentionally excluded —
  // we only want to re-run on auth state changes, not on every navigation.
  // The Axios interceptor is wired inside the effect and always has a fresh
  // closure over getToken via the setTokenGetter call above.

  return null;
}
