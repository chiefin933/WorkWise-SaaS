'use client';

import { GlassCard } from '@/components/premium/GlassCard';
import { CheckCircle2, ArrowRight, ShieldCheck, Zap, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const plans = [
  {
    id: 'STARTER',
    name: 'Starter Plan',
    price: '3,500',
    description: 'Best for startups & small teams',
    limit: '1–15 employees',
    features: [
      'Employee Management',
      'Basic Attendance tracking',
      'Leave Management',
      'PDF Payslip generation',
      '1 Admin Account',
      'Email Notifications'
    ],
    color: 'emerald'
  },
  {
    id: 'GROWTH',
    name: 'Growth Plan',
    price: '12,000',
    description: 'Perfect for growing SMEs',
    limit: '16–75 employees',
    popular: true,
    features: [
      'Everything in Starter',
      'GPS Attendance tracking',
      'M-Pesa Salary Payouts',
      'Bulk Payroll processing',
      '5 Admin Users',
      'SMS Notifications'
    ],
    color: 'teal'
  },
  {
    id: 'BUSINESS',
    name: 'Business Plan',
    price: '35,000',
    description: 'For multi-branch organizations',
    limit: '76–300 employees',
    features: [
      'Everything in Growth',
      'Multi-branch management',
      'API Access & Integrations',
      'KRA/Statutory exports',
      'Unlimited Admins',
      'Priority Onboarding'
    ],
    color: 'slate'
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 text-teal-600 text-xs font-bold uppercase tracking-widest">
            <Zap className="h-4 w-4" /> Simple, Scalable Pricing
          </div>
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white font-outfit">
            Ready to scale your <br />
            <span className="text-teal-600">HR operations?</span>
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Choose a plan that fits your business stage. No hidden fees, just smart HR for Kenya&apos;s best companies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div key={plan.id} className="relative">
              <GlassCard className={`p-8 border-2 h-full flex flex-col ${plan.popular ? 'border-teal-600 shadow-md scale-105' : 'border-slate-100 dark:border-slate-800'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                    Most Popular
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-slate-500">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-400">KES</span>
                    <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums">{plan.price}</span>
                    <span className="text-slate-500 text-sm font-medium">/month</span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-teal-600 px-3 py-1.5 rounded-lg bg-teal-500/5 w-fit">
                    <Users className="h-4 w-4" /> {plan.limit}
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className={`h-5 w-5 shrink-0 text-teal-600`} />
                      {feature}
                    </div>
                  ))}
                </div>

                <Link href={`/auth/register?plan=${plan.id}`} className="w-full">
                  <Button className={`w-full py-7 rounded-2xl font-bold text-lg transition-all ${
                    plan.popular 
                      ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm' 
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50'
                  }`}>
                    Select {plan.name}
                  </Button>
                </Link>
              </GlassCard>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <GlassCard className="p-10 border border-slate-200/60 max-w-4xl mx-auto">
             <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-left">
                <div>
                   <h3 className="text-3xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Need something custom?</h3>
                   <p className="text-slate-500">For enterprises, NGOs, and institutions with over 300 employees.</p>
                </div>
                <Button className="bg-slate-900 hover:bg-black text-white px-10 py-7 rounded-2xl font-bold flex items-center gap-2 shadow-sm">
                   Contact Enterprise <ArrowRight className="h-5 w-5" />
                </Button>
             </div>
          </GlassCard>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                 <ShieldCheck className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white">Bank-Grade Security</h4>
              <p className="text-sm text-slate-500">All data is encrypted and stored in compliant regional data centers.</p>
           </div>
           <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                 <Zap className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white">Easy Onboarding</h4>
              <p className="text-sm text-slate-500">Set up your entire company in under 30 minutes with our onboarding wizard.</p>
           </div>
           <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                 <Building2 className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white">Multi-Branch Ready</h4>
              <p className="text-sm text-slate-500">Manage multiple locations, departments, and payroll cycles from one central dashboard.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
