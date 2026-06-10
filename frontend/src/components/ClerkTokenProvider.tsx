'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setTokenGetter } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Wires Clerk session tokens to Axios and loads the Django user profile.
 */
export function ClerkTokenProvider() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      fetchUser();
    } else {
      clearUser();
    }
  }, [isLoaded, isSignedIn, fetchUser, clearUser]);

  return null;
}
