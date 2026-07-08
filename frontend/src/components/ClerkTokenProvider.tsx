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
      // Always wire the token getter so Axios has a fresh token source
      setTokenGetter(() => getToken());

      const { hasFetched, isLoading, fetchUser } = useAuthStore.getState();

      // Only fetch once per session
      if (hasFetched || isLoading || didFetch.current) return;
      didFetch.current = true;

      // Wait until Clerk can actually produce a non-null token before calling
      // the backend — avoids the 401 race on first render.
      const doFetch = async () => {
        let token: string | null = null;
        let attempts = 0;

        // Retry up to 5 times with 300ms gaps waiting for Clerk session
        while (!token && attempts < 5) {
          token = await getToken();
          if (!token) {
            attempts++;
            await new Promise(r => setTimeout(r, 300));
          }
        }

        if (!token) {
          console.warn('[ClerkTokenProvider] Could not get token after retries — skipping fetchUser');
          return;
        }

        try {
          await fetchUser();
        } catch {
          // Error handled in AppLayout (shows "Account not found" page)
          return;
        }

        // Role-based redirect after successful profile load
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
      didRedirect.current = false;
      didFetch.current    = false;
      useAuthStore.getState().clearUser();
    }
  }, [getToken, isLoaded, isSignedIn, pathname, router, searchParams]);

  return null;
}
