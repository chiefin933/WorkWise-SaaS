'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { setTokenGetter } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Role-to-home-dashboard mapping.
 * When a user logs in (or lands on "/"), they are redirected here.
 */
const ROLE_HOME: Record<string, string> = {
  ADMIN:    '/',
  HR:       '/hr',
  FINANCE:  '/finance',
  EMPLOYEE: '/employee',
};

/**
 * Wires Clerk session tokens to Axios, loads the Django user profile,
 * and performs a role-based redirect on first login.
 *
 * Redirect logic:
 *  1. Only redirects when the user lands on "/" or comes from an invite link.
 *  2. ADMIN/CEO → /   (main dashboard)
 *  3. HR Manager → /hr
 *  4. Finance Manager → /finance
 *  5. Employee → /employee
 */
export function ClerkTokenProvider() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      setTokenGetter(() => getToken());

      const { hasFetched, isLoading, fetchUser } = useAuthStore.getState();

      if (!hasFetched && !isLoading) {
        fetchUser().then(() => {
          if (didRedirect.current) return;
          const { user } = useAuthStore.getState();
          if (!user?.role) return;

          const isInviteLanding = searchParams.get('invited') === '1';
          const isRoot = pathname === '/';

          if (isRoot || isInviteLanding) {
            const home = ROLE_HOME[user.role] ?? '/';
            didRedirect.current = true;
            if (pathname !== home) router.replace(home);
          }
        });
      } else if (hasFetched) {
        // Profile already loaded — still redirect if we're on the wrong page
        if (didRedirect.current) return;
        const { user } = useAuthStore.getState();
        if (!user?.role) return;

        const isInviteLanding = searchParams.get('invited') === '1';
        const isRoot = pathname === '/';

        if (isRoot || isInviteLanding) {
          const home = ROLE_HOME[user.role] ?? '/';
          didRedirect.current = true;
          if (pathname !== home) router.replace(home);
        }
      }
    } else {
      didRedirect.current = false;
      useAuthStore.getState().clearUser();
    }
  }, [getToken, isLoaded, isSignedIn, pathname, router, searchParams]);

  return null;
}
