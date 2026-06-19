'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { SignUp, useUser } from '@clerk/nextjs';
import { Building2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface InviteInfo {
  email: string;
  role: string;
  company: string;
}

function AcceptInvitePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn } = useUser();

  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Look up invite info from the backend using the token
  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. Please request a new invitation from your administrator.');
      setLoading(false);
      return;
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    fetch(`${apiBase}/api/users/invite/info/?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid or expired invitation token.');
        return res.json();
      })
      .then((data: InviteInfo) => {
        setInviteInfo(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'This invitation link is invalid or has already been used.');
        setLoading(false);
      });
  }, [token]);

  // If already signed in, redirect to dashboard
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/');
    }
  }, [isSignedIn, router]);

  const roleLabel = (role: string) => {
    if (role === 'HR') return 'HR Manager';
    if (role === 'EMPLOYEE') return 'Employee';
    return role;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-900/50">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white font-outfit tracking-tight">WorkWise</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Accept Your Invitation</h1>
          <p className="text-slate-400 text-sm">Create your account to join your team</p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
            <Loader2 className="h-8 w-8 text-teal-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-300 text-sm">Verifying your invitation…</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-2xl p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">Invitation Invalid</h3>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors text-sm"
            >
              Go to Login
            </Link>
          </div>
        )}

        {/* Invite info banner + Clerk sign-up */}
        {!loading && inviteInfo && (
          <div className="space-y-4">
            {/* Invite banner */}
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm mb-0.5">
                  You&apos;ve been invited to{' '}
                  <span className="text-teal-300">{inviteInfo.company}</span>
                </p>
                <p className="text-slate-400 text-xs">
                  Role: <span className="text-slate-300 font-medium">{roleLabel(inviteInfo.role)}</span>
                  {' · '}
                  <span className="text-slate-300">{inviteInfo.email}</span>
                </p>
              </div>
            </div>

            {/* Clerk SignUp component, pre-filled with invite email */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden p-2">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'bg-transparent shadow-none border-none',
                    headerTitle: 'hidden',
                    headerSubtitle: 'hidden',
                    socialButtonsBlockButton:
                      'bg-white/10 border-white/20 text-white hover:bg-white/20',
                    formFieldInput:
                      'bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:ring-teal-500 focus:border-teal-500',
                    formFieldLabel: 'text-slate-300',
                    formButtonPrimary:
                      'bg-teal-600 hover:bg-teal-500 text-white font-semibold',
                    footerActionLink: 'text-teal-400 hover:text-teal-300',
                    identityPreviewText: 'text-slate-300',
                    identityPreviewEditButton: 'text-teal-400',
                  },
                }}
                initialValues={{
                  emailAddress: inviteInfo.email,
                }}
                redirectUrl="/"
                signInUrl="/auth/login"
              />
            </div>

            <p className="text-center text-xs text-slate-500">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-teal-400 hover:text-teal-300 transition-colors">
                Sign in instead
              </Link>
            </p>
          </div>
        )}
      </div>
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
