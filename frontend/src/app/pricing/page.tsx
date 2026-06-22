'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/premium/GlassCard';
import { CheckCircle2, ArrowRight, ShieldCheck, Zap, Users, Building2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    monthlyPrice: 3500,
    description: 'Best for startups & small teams',
    limit: '1–15 employees',
    features: [
      'Employee Management',
      'Attendance tracking',
      'Leave Management',
      'PDF Payslip generation',
      'KRA PAYE / NSSF / SHIF / AHL compliance',
      '1 Admin Account',
      'Email Notifications',
    ],
    color: 'emerald',
    popular: false,
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    monthlyPrice: 12000,
    description: 'Perfect for growing SMEs',
    limit: '16–75 employees',
    features: [
      'Everything in Starter',
      'GPS & Geofence Attendance',
      'M-Pesa Salary Payouts',
      'Bulk Payroll processing',
      'Finance Books (Double-Entry)',
      'Department Budgets & Expenses',
      'KRA P9 / P10 / NSSF / SHIF Exports',
      'Bank EFT Export (Equity, KCB, Co-op)',
      '5 User Accounts',
      'HR + Finance Manager roles',
    ],
    color: 'teal',
    popular: true,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    monthlyPrice: 35000,
    description: 'For established organisations',
    limit: '76–300 employees',
    features: [
      'Everything in Growth',
      'Multi-branch management',
      'Unlimited User Accounts',
      'Petty Cash Management',
      'Income Statement & Balance Sheet',
      'Full Audit Trail',
      'Priority Support & Onboarding',
      'API Access',
    ],
    color: 'slate',
    popular: false,
  },
];

function formatKES(n: number) {
  return n.toLocaleString('en-KE');
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  // Annual = 10 months (2 months free)
  const multiplier = annual ? 10 : 1;
  const periodLabel = annual ? '/year' : '/month';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20 px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 text-teal-600 text-xs font-bold uppercase tracking-widest">
            <Zap className="h-4 w-4" /> Simple, Scalable Pricing
          </div>
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white font-outfit">
            Ready to scale your <br />
            <span className="text-teal-600">HR &amp; Finance operations?</span>
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            All plans include full Kenya statutory compliance — PAYE, NSSF, SHIF, and Housing Levy.
            No hidden fees. Pay via M-Pesa.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-bold ${!annual ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(v => !v)}
            className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            aria-label="Toggle annual billing"
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-bold ${annual ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
            Annual
          </span>
          {annual && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black">
              <Tag className="h-3 w-3" /> 2 months FREE
            </span>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {PLANS.map(plan => {
            const price = plan.monthlyPrice * multiplier;
            return (
              <div key={plan.id} className="relative">
                <GlassCard className={`p-8 border-2 h-full flex flex-col ${plan.popular ? 'border-teal-600 shadow-lg scale-105' : 'border-slate-100 dark:border-slate-800'}`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{plan.name}</h3>
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-400">KES</span>
                      <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums">
                        {formatKES(price)}
                      </span>
                      <span className="text-slate-500 text-sm font-medium">{periodLabel}</span>
                    </div>
                    {annual && (
                      <p className="text-xs text-emerald-600 font-bold mt-1">
                        KES {formatKES(plan.monthlyPrice)}/month equivalent
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-teal-600 px-3 py-1.5 rounded-lg bg-teal-500/5 w-fit">
                      <Users className="h-4 w-4" /> {plan.limit}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <Link href={`/auth/register?plan=${plan.id}&billing=${annual ? 'annual' : 'monthly'}`} className="w-full">
                    <Button className={`w-full py-6 rounded-2xl font-bold text-base transition-all ${
                      plan.popular
                        ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}>
                      Get Started with {plan.name}
                    </Button>
                  </Link>
                </GlassCard>
              </div>
            );
          })}
        </div>

        {/* Annual savings summary */}
        {annual && (
          <div className="mt-10 text-center">
            <p className="text-slate-500 text-sm">
              Annual billing saves you <span className="font-bold text-emerald-600">
                KES {formatKES(PLANS.reduce((s, p) => s + p.monthlyPrice * 2, 0))} across all plans
              </span> compared to monthly. Paid once via M-Pesa STK Push.
            </p>
          </div>
        )}

        {/* Enterprise CTA */}
        <div className="mt-20 text-center">
          <GlassCard className="p-10 border border-slate-200/60 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-left">
              <div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white font-outfit mb-2">
                  Need something custom?
                </h3>
                <p className="text-slate-500">
                  For enterprises, NGOs, SACCOs, and institutions with over 300 employees.
                  Custom integrations, dedicated support, and on-premise options available.
                </p>
              </div>
              <Button
                onClick={() => window.location.href = 'mailto:enterprise@workwise.co.ke?subject=Enterprise%20Plan%20Enquiry'}
                className="bg-slate-900 hover:bg-black text-white px-10 py-7 rounded-2xl font-bold flex items-center gap-2 shadow-sm shrink-0">
                Contact Enterprise <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </GlassCard>
        </div>

        {/* Trust badges */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Full Kenya Compliance</h4>
            <p className="text-sm text-slate-500">
              PAYE, NSSF (new &amp; old act), SHIF, Housing Levy, KRA P9/P10 exports — always up to date.
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Zap className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Pay via M-Pesa</h4>
            <p className="text-sm text-slate-500">
              Upgrade your plan instantly with M-Pesa STK Push. No card, no wire transfer needed.
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Building2 className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">HR + Finance in One</h4>
            <p className="text-sm text-slate-500">
              Double-entry bookkeeping, expense claims, petty cash, and budgets — alongside payroll and HR.
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto space-y-4">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit text-center mb-8">
            Frequently Asked Questions
          </h3>
          {[
            {
              q: 'Can I switch plans later?',
              a: 'Yes. You can upgrade at any time from Settings → Billing using M-Pesa. Downgrading takes effect at the end of your billing period.',
            },
            {
              q: 'Is the annual plan paid upfront?',
              a: 'Yes — annual billing is a single M-Pesa payment covering 12 months at the price of 10. You save 2 full months.',
            },
            {
              q: 'Does WorkWise handle the new NSSF Act?',
              a: 'Yes. You can configure your payroll to use either the new NSSF Act 2013 (Tier I + Tier II) or the old flat KES 200 rate, depending on your legal advice.',
            },
            {
              q: 'Is my data safe?',
              a: 'All sensitive fields (KRA PIN, National ID, bank details) are encrypted with AES-256-GCM. Data is hosted on Supabase PostgreSQL with TLS in transit.',
            },
          ].map((item, i) => (
            <GlassCard key={i} className="p-6 border border-slate-200/60">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2">{item.q}</h4>
              <p className="text-sm text-slate-500">{item.a}</p>
            </GlassCard>
          ))}
        </div>

      </div>
    </div>
  );
}
