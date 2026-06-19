'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setTokenGetter } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Wires Clerk session tokens to Axios and loads the Django user profile.
 * Sets isLoading=true immediately when Clerk reports the user as signed-in,
 * closing the race-condition window where isLoading was false but user was null.
 */
export function ClerkTokenProvider() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      setTokenGetter(() => getToken());

      const { hasFetched, isLoading, fetchUser } = useAuthStore.getState();
      // Only fetch once — prevents duplicate calls on hot-reload / re-renders
      if (!hasFetched && !isLoading) {
        void fetchUser();
      }
    } else {
      useAuthStore.getState().clearUser();
    }
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
