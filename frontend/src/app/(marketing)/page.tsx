'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DownloadButton } from '@/components/pwa/DownloadButton';
import {
  Users, DollarSign, Calendar, Clock, BarChart3,
  BookOpen, ShieldCheck, Zap, ArrowRight, CheckCircle2,
  Star, Building2, Receipt, PiggyBank, FileText,
} from 'lucide-react';

// ── Redirect authenticated users straight to their dashboard ─────────────────
function AuthRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Authenticated user landed on marketing page — send them to their dashboard
      // ClerkTokenProvider will handle the role-based redirect from /dashboard
      router.replace('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  return null;
}

// ── Data ─────────────────────────────────────────────────────────────────────
const features = [
  {
    icon: DollarSign,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    title: 'KRA-Compliant Payroll',
    desc: 'Auto-calculate PAYE, NSSF (old & new act), SHIF, and Housing Levy. Generate P9/P10 exports ready for iTax upload.',
  },
  {
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    title: 'Employee Management',
    desc: 'Full employee profiles with encrypted KRA PIN, NSSF number, bank details, and National ID. Bulk CSV import.',
  },
  {
    icon: Clock,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    title: 'GPS Attendance',
    desc: 'Clock in/out with geofence verification. Public holiday detection with 2x overtime. Presence matrix for managers.',
  },
  {
    icon: Calendar,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    title: 'Leave Management',
    desc: 'Annual, Sick, Maternity, Paternity leave with Employment Act defaults. Two-stage approval workflow.',
  },
  {
    icon: BookOpen,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'Finance Books',
    desc: 'Real double-entry bookkeeping with auto-posting from payroll. Income Statement, Balance Sheet, Trial Balance.',
  },
  {
    icon: Receipt,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    title: 'Expense Management',
    desc: 'Employees submit claims with receipts. Finance Manager approves. Reimbursements tracked end-to-end.',
  },
  {
    icon: PiggyBank,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    title: 'Petty Cash & Budgets',
    desc: 'Department budgets with real-time utilization alerts. Petty cash fund management with full approval workflow.',
  },
  {
    icon: Zap,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    title: 'M-Pesa Payments',
    desc: 'Disburse salaries directly to employee M-Pesa numbers via Safaricom Daraja B2C. One click, instant confirmation.',
  },
];

const roles = [
  {
    title: 'CEO / Owner',
    color: 'border-teal-500/40 bg-teal-500/5',
    badge: 'bg-teal-500/20 text-teal-300',
    items: ['Company-wide dashboard with live KPIs', 'HR + Finance overview in one view', 'Pending approvals from all departments', 'Full audit trail access'],
  },
  {
    title: 'HR Manager',
    color: 'border-blue-500/40 bg-blue-500/5',
    badge: 'bg-blue-500/20 text-blue-300',
    items: ['Employee directory & onboarding', 'Payroll processing & payslip delivery', 'Leave approvals & balance tracking', 'Statutory exports: P9, P10, NSSF, SHIF'],
  },
  {
    title: 'Finance Manager',
    color: 'border-purple-500/40 bg-purple-500/5',
    badge: 'bg-purple-500/20 text-purple-300',
    items: ['Expense claim approvals', 'Department budget monitoring', 'Double-entry journal entries', 'Income Statement & Balance Sheet'],
  },
  {
    title: 'Employee',
    color: 'border-amber-500/40 bg-amber-500/5',
    badge: 'bg-amber-500/20 text-amber-300',
    items: ['Clock in/out with GPS', 'Submit leave requests', 'Download own payslips', 'Submit expense claims'],
  },
];

const plans = [
  { name: 'Starter', price: '3,500', employees: '1–15 employees', popular: false },
  { name: 'Growth',  price: '12,000', employees: '16–75 employees', popular: true },
  { name: 'Business', price: '35,000', employees: '76–300 employees', popular: false },
];

const testimonials = [
  { name: 'Grace W.', role: 'HR Manager, Nairobi', text: 'We used to spend 2 days calculating payroll manually. WorkWise does it in minutes and the PAYE is always correct.' },
  { name: 'James M.', role: 'CEO, Mombasa', text: 'The Finance Books module alone is worth it — our accountant finally stopped asking us to export spreadsheets.' },
  { name: 'Amina K.', role: 'Finance Manager, Kisumu', text: 'Expense claims used to get lost in WhatsApp. Now everything is tracked, approved, and posted to the books automatically.' },
];

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <AuthRedirect />
      <div className="min-h-screen bg-slate-950 text-white">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold font-outfit">W</span>
              </div>
              <span className="text-lg font-bold tracking-tight font-outfit">WorkWise</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#roles" className="hover:text-white transition-colors">Who It's For</a>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/help" className="hover:text-white transition-colors">Help Center</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors px-4 py-2">
                Log In
              </Link>
              <Link href="/auth/register"
                className="text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl transition-all">
                Start Free Trial
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-20 pb-28 px-6">
          {/* Background glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-teal-500/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/6 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="h-3.5 w-3.5" /> Built for Kenya · KRA Compliant · M-Pesa Ready
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-outfit leading-[1.05] tracking-tight">
              Run your HR & Finance{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">
                the smart way
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              WorkWise automates payroll, leave, attendance, expense claims, and double-entry
              bookkeeping — all in one platform built specifically for Kenyan SMEs.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link href="/auth/register"
                className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-base transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5">
                Start 14-Day Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <DownloadButton className="px-7 py-4 text-base" />
              <Link href="/auth/login"
                className="flex items-center gap-2 px-7 py-4 rounded-2xl border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-bold text-base transition-all">
                Log In
              </Link>
            </div>

            <p className="text-sm text-slate-500">
              No credit card required · Cancel anytime · M-Pesa billing
            </p>

            {/* Social proof numbers */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-6 border-t border-white/5">
              {[
                { value: '500+', label: 'Companies' },
                { value: 'KES 2B+', label: 'Payroll processed' },
                { value: '12,000+', label: 'Employees managed' },
                { value: '99.9%', label: 'Uptime SLA' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl font-black text-white font-outfit">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6 bg-slate-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-4xl font-black font-outfit">Everything your team needs</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                From clock-in to payslip, from expense claim to balance sheet — all in one place.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {features.map(f => (
                <div key={f.title}
                  className="p-5 rounded-2xl bg-white/3 border border-white/8 hover:border-white/15 transition-all group">
                  <div className={`h-11 w-11 rounded-xl ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <f.icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Statutory compliance callout ────────────────────────────────── */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-teal-900/40 to-slate-900 border border-teal-500/20 rounded-3xl p-10">
            <div className="flex flex-col md:flex-row items-start gap-8">
              <div className="h-16 w-16 rounded-2xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="h-8 w-8 text-teal-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-black font-outfit mb-3">
                  KRA, NSSF, SHIF & Housing Levy — always up to date
                </h2>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  WorkWise stays current with Kenya's statutory requirements. Switch between old NSSF Act (flat KES 200)
                  and new NSSF Act (Tier I + Tier II) with one setting. Export P9 Annual Tax Cards, P10 Monthly
                  Returns, NSSF Remittance Schedules, and SHIF/AHL schedules ready for portal upload.
                </p>
                <div className="flex flex-wrap gap-3">
                  {['PAYE', 'NSSF Tier I+II', 'SHIF 2.75%', 'Housing Levy 1.5%', 'P9 Annual', 'P10 Monthly', 'NSSF Schedule', 'SHIF Schedule'].map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-300 text-xs font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Role-based access ───────────────────────────────────────────── */}
        <section id="roles" className="py-24 px-6 bg-slate-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-4xl font-black font-outfit">A dashboard for every role</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Each person in your organisation sees exactly what they need — nothing more, nothing less.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {roles.map(r => (
                <div key={r.title} className={`p-6 rounded-2xl border ${r.color}`}>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4 ${r.badge}`}>
                    {r.title}
                  </span>
                  <ul className="space-y-2.5">
                    {r.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────────────────────── */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-4xl font-black font-outfit">Trusted by Kenyan businesses</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map(t => (
                <div key={t.name} className="p-6 rounded-2xl bg-white/3 border border-white/8">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
                  <div>
                    <p className="font-bold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing teaser ──────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-slate-900/50">
          <div className="max-w-4xl mx-auto text-center mb-12 space-y-3">
            <h2 className="text-4xl font-black font-outfit">Simple, transparent pricing</h2>
            <p className="text-slate-400">Pay via M-Pesa. No credit card needed. Cancel anytime.</p>
          </div>
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
            {plans.map(p => (
              <div key={p.name}
                className={`p-6 rounded-2xl border text-center ${p.popular ? 'border-teal-500/50 bg-teal-500/8 scale-105' : 'border-white/10 bg-white/3'}`}>
                {p.popular && (
                  <div className="text-[10px] font-black uppercase tracking-widest text-teal-400 mb-3">Most Popular</div>
                )}
                <h3 className="font-black text-white font-outfit text-lg mb-1">{p.name}</h3>
                <div className="text-3xl font-black text-white font-outfit mb-1">
                  <span className="text-sm font-bold text-slate-400">KES </span>{p.price}
                  <span className="text-sm font-normal text-slate-400">/mo</span>
                </div>
                <p className="text-xs text-slate-500">{p.employees}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all">
              See full pricing & features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <section className="py-28 px-6">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="h-16 w-16 mx-auto bg-teal-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-teal-500/30">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-5xl font-black font-outfit">
              Ready to transform your HR & Finance?
            </h2>
            <p className="text-slate-400 text-lg">
              Join hundreds of Kenyan SMEs that have automated their payroll, leave, and finance operations.
              Start your free 14-day trial today — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-lg transition-all shadow-lg shadow-teal-500/20 hover:-translate-y-0.5">
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Link>
              <DownloadButton className="px-8 py-4 text-lg" />
            </div>
            <p className="text-sm text-slate-600">
              Questions? Email us at{' '}
              <a href="mailto:hello@workwise.co.ke" className="text-slate-400 hover:text-white transition-colors">
                hello@workwise.co.ke
              </a>
            </p>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-12 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 bg-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm font-outfit">W</span>
              </div>
              <span className="font-bold text-slate-400 font-outfit">WorkWise</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
              <Link href="/pricing" className="hover:text-slate-400 transition-colors">Pricing</Link>
              <Link href="/help" className="hover:text-slate-400 transition-colors">Help Center</Link>
              <Link href="/auth/login" className="hover:text-slate-400 transition-colors">Log In</Link>
              <Link href="/auth/register" className="hover:text-slate-400 transition-colors">Sign Up</Link>
              <a href="mailto:enterprise@workwise.co.ke" className="hover:text-slate-400 transition-colors">Enterprise</a>
              <a href="mailto:hello@workwise.co.ke" className="hover:text-slate-400 transition-colors">Contact</a>
            </div>
            <p className="text-xs text-slate-700">
              © {new Date().getFullYear()} WorkWise. Built for Kenya.
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}
