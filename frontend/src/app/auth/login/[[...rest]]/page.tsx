'use client';

import { SignIn, useSignIn } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';
import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck, Zap, Users, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const stats = [
  { value: '500+',  label: 'Companies' },
  { value: '12K+',  label: 'Employees managed' },
  { value: '99.9%', label: 'Uptime SLA' },
];

// ── Custom email/password form with toast feedback ────────────────────────────
// This sits ABOVE the Clerk component. Users can use either:
//   1. This quick form (email + password only, with toasts)
//   2. The full Clerk component below (social login, MFA, magic link, etc.)

function QuickSignInForm({ prefilledEmail = '', autoOpen = false }: { prefilledEmail?: string; autoOpen?: boolean }) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { toast, container: toastContainer } = useToast();

  const [email, setEmail]       = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(autoOpen);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;

    if (!email.trim()) { toast('Please enter your email address.', 'error'); return; }
    if (!password)     { toast('Please enter your password.', 'error'); return; }

    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        toast('Welcome back!', 'success');
        // ClerkTokenProvider will redirect to the role's home dashboard
        router.push('/');
      } else {
        // Needs MFA or another factor — fall through to full Clerk component
        toast('Additional verification required. Use the form below.', 'info');
        setOpen(false);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { code: string; message: string }[] };
      const code    = clerkErr.errors?.[0]?.code    ?? '';
      const message = clerkErr.errors?.[0]?.message ?? '';

      if (
        code === 'form_identifier_not_found' ||
        message.toLowerCase().includes('couldn\'t find') ||
        message.toLowerCase().includes('no account') ||
        message.toLowerCase().includes('identifier')
      ) {
        toast('No account found with that email. Please sign up first.', 'error');
      } else if (code === 'form_password_incorrect' || message.toLowerCase().includes('password')) {
        toast('Incorrect password. Please try again.', 'error');
      } else if (code === 'too_many_requests') {
        toast('Too many attempts. Please wait a moment and try again.', 'error');
      } else {
        toast(message || 'Something went wrong. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full mb-4">
      {toastContainer}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <Zap className="h-4 w-4 text-teal-500" /> Sign in with email &amp; password
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-slate-100 dark:border-slate-700 rounded-2xl bg-slate-50/60 dark:bg-slate-800/60" noValidate>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Quick sign in</p>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Work email"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400"
          />
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-white transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading || !isLoaded}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Sign In</span><ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const isInvited = searchParams.get('invited') === '1';
  const prefilledEmail = searchParams.get('email') || '';

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen flex overflow-hidden bg-white">

      {/* ── Left: Sign-in form ───────────────────────────────────────────── */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12">
        <div className="max-w-md w-full mx-auto">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <span className="text-white font-bold font-outfit text-2xl">W</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-outfit">WorkWise</span>
          </div>

          <div className="mb-6">
            {isInvited && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-sm leading-relaxed">
                  <strong className="font-bold">Your account is ready.</strong>
                  <br />
                  Use the email and temporary password from your invitation email to sign in below. You can change your password after logging in.
                </div>
              </div>
            )}
            <h1 className="text-4xl font-bold text-slate-900 mb-2 font-outfit">Welcome back</h1>
            <p className="text-slate-500">Kenya&apos;s most powerful HR &amp; Payroll platform.</p>
          </div>

          {/* Quick email/password form with toast errors */}
          {mounted && <QuickSignInForm prefilledEmail={prefilledEmail} autoOpen={isInvited} />}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400 font-medium">or continue with</span>
            </div>
          </div>

          {/* Full Clerk component — social login, MFA, magic link */}
          <div className="w-full min-h-[420px] flex items-center justify-center">
            {mounted ? (
              <SignIn
                routing="hash"
                signUpUrl="/auth/register"
                forceRedirectUrl="/"
                appearance={clerkAppearance}
              />
            ) : (
              <div className="w-full h-[400px] bg-slate-50 border border-slate-100 rounded-3xl animate-pulse flex items-center justify-center text-slate-400 text-sm">
                Loading secure sign in...
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-slate-500 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="font-bold text-teal-600 hover:text-teal-700 transition-colors">
              Create a workspace
            </Link>
          </p>

          {/* Trust badges */}
          <div className="mt-10 flex items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Bank-grade security
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" /> KRA compliant
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Visual panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden bg-slate-950">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 max-w-lg px-12 space-y-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-widest">
            <Users className="h-4 w-4" /> Trusted by 500+ Kenyan SMEs
          </div>

          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-white font-outfit leading-tight">
              Automate your HR,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
                empower your team.
              </span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              From KRA P9 forms to M-Pesa payouts — everything you need to run payroll in Kenya, in one place.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.label} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="text-2xl font-black text-white font-outfit">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <ShieldCheck className="h-7 w-7 text-emerald-400 mb-3" />
              <h4 className="text-white font-bold text-sm mb-1">Tax Compliant</h4>
              <p className="text-slate-500 text-xs">PAYE, NSSF, NHIF &amp; Housing Levy built-in.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <CheckCircle2 className="h-7 w-7 text-amber-400 mb-3" />
              <h4 className="text-white font-bold text-sm mb-1">Instant Payroll</h4>
              <p className="text-slate-500 text-xs">Calculate &amp; generate payslips in seconds.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
