'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

/**
 * Accept Invite page — handles the invite link click from the email.
 *
 * The new invite flow emails credentials directly (email + temp password).
 * The invitee just needs to log in with those credentials.
 *
 * This page:
 *   1. Signs out any currently active Clerk session — prevents the scenario
 *      where the CEO clicks the link in the same browser and is redirected to
 *      their own dashboard instead of the login page.
 *   2. Redirects to /auth/login with the email pre-filled and invited=1 flag
 *      so the login page shows the "Your account is ready" banner.
 */
function AcceptInvitePageInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { signOut, isSignedIn, isLoaded } = useAuth();
  const { user: currentUser } = useUser();
  const currentUserEmail = currentUser?.primaryEmailAddress?.emailAddress || '';

  const email = searchParams.get('email') || '';

  useEffect(() => {
    if (!isLoaded) return;

    const loginUrl = `/auth/login?email=${encodeURIComponent(email)}&invited=1`;

    if (isSignedIn && currentUserEmail && email && currentUserEmail.toLowerCase() !== email.toLowerCase()) {
      // A DIFFERENT user is logged in (e.g. CEO clicked the link meant for an invitee)
      // Sign them out and redirect to the login page for the invited email
      signOut().then(() => {
        router.replace(loginUrl);
      });
    } else if (isSignedIn && currentUserEmail && email && currentUserEmail.toLowerCase() === email.toLowerCase()) {
      // The invited person is already logged in as themselves — go to their dashboard
      router.replace('/');
    } else {
      // No active session — go straight to login with email pre-filled
      router.replace(loginUrl);
    }
  }, [isLoaded, isSignedIn, currentUserEmail, email, signOut, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-900/50 mb-2">
        <span className="text-white font-bold text-2xl font-outfit">W</span>
      </div>
      <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
      <p className="text-slate-400 text-sm">Preparing your invitation…</p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
      </div>
    }>
      <AcceptInvitePageInner />
    </Suspense>
  );
}
