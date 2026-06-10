'use client';

import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, Zap, Users } from 'lucide-react';

const stats = [
  { value: '500+', label: 'Companies' },
  { value: '12K+', label: 'Employees managed' },
  { value: '99.9%', label: 'Uptime SLA' },
];

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex overflow-hidden bg-white">
      {/* ── Left: Sign-in form ────────────────────────────────────────────── */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <span className="text-white font-bold font-outfit text-2xl">W</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-outfit">WorkWise</span>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2 font-outfit">Welcome back</h1>
            <p className="text-slate-500">Kenya&apos;s most powerful HR &amp; Payroll platform.</p>
          </div>

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

      {/* ── Right: Visual panel ───────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden bg-slate-950">
        {/* Gradient blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 max-w-lg px-12 space-y-12">
          {/* Badge */}
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

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.label} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="text-2xl font-black text-white font-outfit">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <ShieldCheck className="h-7 w-7 text-emerald-400 mb-3" />
              <h4 className="text-white font-bold text-sm mb-1">Tax Compliant</h4>
              <p className="text-slate-500 text-xs">PAYE, NSSF, NHIF &amp; Housing Levy built-in.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <Zap className="h-7 w-7 text-amber-400 mb-3" />
              <h4 className="text-white font-bold text-sm mb-1">Instant Payroll</h4>
              <p className="text-slate-500 text-xs">Calculate &amp; generate payslips in seconds.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
