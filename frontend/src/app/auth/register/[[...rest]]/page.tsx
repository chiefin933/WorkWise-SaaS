'use client';

import { useSignUp } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, ArrowRight, ArrowLeft, Users, Zap,
  ShieldCheck, Building2, Star, Eye, EyeOff, Loader2,
  BadgeCheck,
} from 'lucide-react';

// ─── Plan Data ────────────────────────────────────────────────────────────────
const plans = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: '3,500',
    description: 'Best for startups & small teams',
    limit: '1–15 employees',
    color: 'emerald',
    features: ['Employee Management', 'Leave & Attendance', 'PDF Payslips', '1 Admin Account'],
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: '12,000',
    description: 'Perfect for growing SMEs',
    limit: '16–75 employees',
    color: 'teal',
    popular: true,
    features: ['Everything in Starter', 'GPS Attendance', 'M-Pesa Payouts', '5 Admin Users'],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: '35,000',
    description: 'For multi-branch organizations',
    limit: '76–300 employees',
    color: 'blue',
    features: ['Everything in Growth', 'Multi-branch', 'API Access', 'Unlimited Admins'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large institutions & NGOs',
    limit: '300+ employees',
    color: 'violet',
    features: ['Everything in Business', 'Dedicated Support', 'Custom Integrations', 'SLA Guarantee'],
  },
];

const colorMap: Record<string, { ring: string; bg: string; text: string; badge: string }> = {
  emerald: { ring: 'ring-emerald-500 border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600', badge: 'bg-emerald-500' },
  teal:    { ring: 'ring-teal-500 border-teal-500',       bg: 'bg-teal-500/10',    text: 'text-teal-600',    badge: 'bg-teal-500'    },
  blue:    { ring: 'ring-blue-500 border-blue-500',       bg: 'bg-blue-500/10',    text: 'text-blue-600',    badge: 'bg-blue-500'    },
  violet:  { ring: 'ring-violet-500 border-violet-500',   bg: 'bg-violet-500/10',  text: 'text-violet-600',  badge: 'bg-violet-500'  },
};

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold transition-all ${step >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
        {step > 1 ? <CheckCircle2 className="h-4 w-4" /> : '1'}
      </div>
      <span className={`text-sm font-medium ${step >= 1 ? 'text-slate-700' : 'text-slate-400'}`}>Choose Plan</span>
      <div className={`flex-1 h-px ${step >= 2 ? 'bg-teal-500' : 'bg-slate-200'}`} />
      <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold transition-all ${step >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
        2
      </div>
      <span className={`text-sm font-medium ${step >= 2 ? 'text-slate-700' : 'text-slate-400'}`}>Your Account</span>
    </div>
  );
}

// ─── Verification Screen ──────────────────────────────────────────────────────
function VerifyEmail({
  email, code, setCode, onVerify, loading, error,
}: {
  email: string; code: string; setCode: (v: string) => void;
  onVerify: () => void; loading: boolean; error: string;
}) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="h-16 w-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto">
        <BadgeCheck className="h-8 w-8 text-teal-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2 font-outfit">Check your email</h2>
        <p className="text-slate-500 text-sm">We sent a 6-digit code to <strong className="text-slate-700">{email}</strong></p>
      </div>
      <div className="space-y-3">
        <input
          id="verification-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="w-full text-center text-3xl font-bold tracking-[0.5em] border-2 border-slate-200 rounded-2xl px-4 py-4 focus:outline-none focus:border-teal-500 transition-colors"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          id="verify-btn"
          onClick={onVerify}
          disabled={loading || code.length < 6}
          className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-base transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Continue'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function RegisterPageInner() {
  const { signUp, setActive } = useSignUp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselected = searchParams.get('plan')?.toUpperCase() || '';
  const [step, setStep] = useState<1 | 2>(preselected ? 2 : 1);
  const [selectedPlan, setSelectedPlan] = useState(preselected || '');
  const [verifying, setVerifying] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [code, setCode]               = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const selectedPlanObj = plans.find(p => p.id === selectedPlan);

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────
  function handleSelectPlan(planId: string) {
    setSelectedPlan(planId);
    setStep(2);
  }

  // ── Submit Registration ──────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!companyName.trim()) return setError('Please enter your company name.');
    if (!fullName.trim())    return setError('Please enter your full name.');
    if (!email.trim())       return setError('Please enter your work email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPwd) return setError('Passwords do not match.');

    const [firstName, ...rest] = fullName.trim().split(' ');
    const lastName = rest.join(' ');

    setLoading(true);
    try {
      await signUp!.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
        unsafeMetadata: { plan: selectedPlan, companyName: companyName.trim() },
      });
      await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
      setVerifying(true);
    } catch (err: unknown) {
      console.error('Clerk signup create error:', err);
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Verify Code ─────────────────────────────────────────────────────────────
  async function handleVerify() {
    setError('');
    setLoading(true);
    try {
      console.log('Attempting verification with code:', code);
      const result = await signUp!.attemptEmailAddressVerification({ code });
      console.log('Verification result:', result);

      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId });
        router.push('/');
      } else {
        const msg = `Signup status: "${result.status}". Missing requirements: ${JSON.stringify(result.missingFields)}`;
        console.warn(msg);
        setError(msg);
      }
    } catch (err: unknown) {
      console.error('Clerk verification error:', err);
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex flex-col">
      {/* Top bar */}
      <header className="px-8 py-5 flex items-center gap-3">
        <div className="h-9 w-9 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-500/20">
          <span className="text-white font-bold font-outfit text-xl">W</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900 font-outfit">WorkWise</span>
        <div className="ml-auto text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-teal-600 font-bold hover:underline">Sign in</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* ── STEP 1: Plan Selection ── */}
        {step === 1 && (
          <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-700 text-xs font-bold uppercase tracking-widest mb-4">
                <Zap className="h-3.5 w-3.5" /> Step 1 of 2 — Choose Your Plan
              </div>
              <h1 className="text-4xl font-bold text-slate-900 font-outfit mb-3">
                Start with the right plan
              </h1>
              <p className="text-slate-500 max-w-xl mx-auto">
                All plans include a <span className="font-bold text-teal-600">14-day free trial</span>. No credit card required.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map(plan => {
                const c = colorMap[plan.color];
                return (
                  <button
                    key={plan.id}
                    id={`plan-${plan.id.toLowerCase()}`}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`relative text-left p-6 rounded-3xl border-2 bg-white shadow-sm hover:shadow-md transition-all group
                      ${selectedPlan === plan.id ? `${c.ring} ring-2` : 'border-slate-100 hover:border-slate-300'}`}
                  >
                    {plan.popular && (
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${c.badge} text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1`}>
                        <Star className="h-3 w-3 fill-white" /> Most Popular
                      </div>
                    )}
                    <div className={`h-10 w-10 rounded-xl ${c.bg} flex items-center justify-center mb-4`}>
                      <Users className={`h-5 w-5 ${c.text}`} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1 font-outfit">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mb-4">{plan.description}</p>
                    <div className="mb-4">
                      {plan.price === 'Custom' ? (
                        <span className={`text-2xl font-black ${c.text}`}>Custom</span>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-bold text-slate-400">KES</span>
                          <span className="text-2xl font-black text-slate-900">{plan.price}</span>
                          <span className="text-xs text-slate-400">/mo</span>
                        </div>
                      )}
                      <div className={`mt-2 text-xs font-bold ${c.text} ${c.bg} rounded-lg px-2 py-1 w-fit`}>
                        {plan.limit}
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${c.text}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className={`mt-5 flex items-center gap-1 text-xs font-bold ${c.text} group-hover:gap-2 transition-all`}>
                      Select {plan.name} <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-xs text-slate-400 mt-8">
              Need more than 300 employees?{' '}
              <a href="mailto:hello@workwise.co.ke" className="text-teal-600 font-bold hover:underline">Contact us for Enterprise pricing</a>
            </p>
          </div>
        )}

        {/* ── STEP 2: Account Setup ── */}
        {step === 2 && !verifying && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
            <StepIndicator step={2} />

            {selectedPlanObj && (
              <div className={`flex items-center gap-3 mb-6 px-4 py-3 rounded-2xl ${colorMap[selectedPlanObj.color].bg} border border-current/10`}>
                <BadgeCheck className={`h-5 w-5 ${colorMap[selectedPlanObj.color].text}`} />
                <div>
                  <p className="text-xs text-slate-500">Selected Plan</p>
                  <p className={`text-sm font-bold ${colorMap[selectedPlanObj.color].text}`}>
                    {selectedPlanObj.name} — KES {selectedPlanObj.price}/mo · {selectedPlanObj.limit}
                  </p>
                </div>
                <button
                  id="change-plan-btn"
                  onClick={() => setStep(1)}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
                >
                  Change
                </button>
              </div>
            )}

            <h1 className="text-3xl font-bold text-slate-900 font-outfit mb-1">Create your workspace</h1>
            <p className="text-slate-500 text-sm mb-8">Set up your administrator account to get started.</p>

            <form id="register-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="company-name">Company Name</label>
                <input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Acme Limited"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm placeholder:text-slate-400"
                />
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="full-name">Your Full Name</label>
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jane Wambui"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm placeholder:text-slate-400"
                />
              </div>

              {/* Work Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="work-email">Work Email</label>
                <input
                  id="work-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@acmeltd.co.ke"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm placeholder:text-slate-400"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm placeholder:text-slate-400"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700" htmlFor="confirm-password">Confirm Password</label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm placeholder:text-slate-400"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Clerk CAPTCHA container for custom sign-up flow bot protection */}
              <div id="clerk-captcha" className="my-2"></div>

              {/* Inline error */}
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                  <span className="shrink-0">⚠</span> {error}
                </div>
              )}

              <button
                id="register-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm shadow-teal-500/20 mt-2"
              >
                {loading
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Creating workspace…</>
                  : <><span>Create Workspace</span> <ArrowRight className="h-4 w-4" /></>
                }
              </button>

              <button type="button" onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mt-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to plan selection
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Encrypted</div>
              <div className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-blue-500" /> Kenyan Data Centers</div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Email Verification ── */}
        {verifying && (
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
            <VerifyEmail
              email={email}
              code={code}
              setCode={setCode}
              onVerify={handleVerify}
              loading={loading}
              error={error}
            />
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} WorkWise. All rights reserved. &nbsp;·&nbsp;
        <Link href="/pricing" className="hover:text-teal-600 transition-colors">View all plans</Link>
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageInner />
    </Suspense>
  );
}
