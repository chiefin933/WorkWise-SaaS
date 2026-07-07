'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Users, Clock, Calendar, DollarSign,
  FileText, ArrowLeft, ChevronRight, CheckCircle2,
  ShieldCheck, Banknote, Building2, PieChart,
  Mail, Smartphone, Search
} from 'lucide-react';

// ── Redirect authenticated users straight to their dashboard ─────────────────
function AuthRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  return null;
}

// ── Help Center Content Sections ──────────────────────────────────────────────
const sections = [
  {
    id: 'getting-started',
    title: 'Getting Started with WorkWise',
    icon: BookOpen,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    content: [
      {
        subtitle: '1. Creating Your Account',
        text: "Start by signing up for a free 14-day trial using your email address. You'll receive an invitation email with a temporary password. Log in and complete your company profile."
      },
      {
        subtitle: '2. Setting Up Your Team',
        text: "Go to HR → Employees to add your team members. You can add them one by one or use the bulk CSV import. Make sure to include all statutory details (KRA PIN, NSSF number, etc.) for accurate payroll."
      },
      {
        subtitle: '3. Configuring Payroll',
        text: "Navigate to Settings → Payroll Config to set up your statutory preferences. Choose between old or new NSSF Act, review PAYE bands, and set your pay cycle."
      }
    ]
  },
  {
    id: 'employee-management',
    title: 'Employee Management',
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    content: [
      {
        subtitle: 'Adding Employees',
        text: "Click 'Add Employee' to create a new profile. Fill in personal details, statutory IDs, and payment information. All sensitive data is encrypted with AES-256-GCM."
      },
      {
        subtitle: 'Bulk Import',
        text: "Use the CSV import to add multiple employees at once. The system supports column aliases, so you can map your spreadsheet columns to WorkWise fields."
      },
      {
        subtitle: 'Updating Employee Info',
        text: "Click on any employee to edit their details. You can update personal information, job title, salary, and payment methods from one place."
      }
    ]
  },
  {
    id: 'attendance',
    title: 'Attendance Tracking',
    icon: Clock,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    content: [
      {
        subtitle: 'Clock In / Out',
        text: "Employees can clock in and out using the mobile app or web portal. GPS geofencing ensures they're at the workplace when clocking in."
      },
      {
        subtitle: 'Overtime Calculation',
        text: "WorkWise automatically calculates overtime: 2x pay on public holidays and 1.5x pay on weekdays beyond standard hours."
      },
      {
        subtitle: 'Presence Matrix',
        text: "Managers can view the presence matrix to see who's in, who's out, and who's on leave at a glance."
      }
    ]
  },
  {
    id: 'leave-management',
    title: 'Leave Management',
    icon: Calendar,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    content: [
      {
        subtitle: 'Requesting Leave',
        text: "Employees submit leave requests from their self-service portal. They can check their leave balance before submitting."
      },
      {
        subtitle: 'Approval Workflow',
        text: "Leave requests go through a two-stage approval: first the manager, then HR or Admin. Approvers receive email notifications."
      },
      {
        subtitle: 'Leave Types',
        text: "WorkWise supports Annual (21 days), Sick (30 days), Maternity (90 days), Paternity (14 days), and Unpaid leave as per Kenyan Employment Act."
      }
    ]
  },
  {
    id: 'payroll',
    title: 'Processing Payroll',
    icon: DollarSign,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    content: [
      {
        subtitle: 'Running Payroll',
        text: "Go to Payroll → Run Payroll. Select the pay period, review the automatically calculated statutory deductions, and approve."
      },
      {
        subtitle: 'Statutory Exports',
        text: "Generate P9 Annual Tax Cards, P10 Monthly Returns, NSSF Remittance Schedules, and SHIF/AHL schedules ready for upload to respective portals."
      },
      {
        subtitle: 'Bank & M-Pesa Payments',
        text: "Export bulk EFT files for Equity, KCB, Co-op, or Stanbic. Or disburse salaries directly via M-Pesa B2C."
      },
      {
        subtitle: 'Payslips',
        text: "Employees receive branded PDF payslips via email and can also download them from their self-service portal."
      }
    ]
  },
  {
    id: 'finance',
    title: 'Finance & Accounting',
    icon: PieChart,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    content: [
      {
        subtitle: 'Expense Claims',
        text: "Employees submit expense claims with receipts. Finance approves and marks them paid, with automatic journal entries."
      },
      {
        subtitle: 'Petty Cash',
        text: "Manage petty cash funds with full approval workflow for requests and disbursements."
      },
      {
        subtitle: 'Budgets',
        text: "Set department budgets and track real-time utilization against payroll and expenses."
      },
      {
        subtitle: 'Financial Reports',
        text: "View Income Statement (P&L), Balance Sheet, Trial Balance, and General Ledger anytime."
      }
    ]
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    icon: ShieldCheck,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    content: [
      {
        subtitle: 'Data Encryption',
        text: "All sensitive data (KRA PIN, National ID, bank details) is encrypted with AES-256-GCM encryption."
      },
      {
        subtitle: 'Audit Trails',
        text: "Every action is logged in an immutable audit trail with HMAC-SHA256 integrity seals."
      },
      {
        subtitle: 'Role-Based Access',
        text: "Different roles see different information: CEO sees everything, HR sees HR data, Finance sees finance, Employees see only their own info."
      }
    ]
  }
];

// ── FAQ Section ───────────────────────────────────────────────────────────────
const faqs = [
  {
    question: 'Do I need technical knowledge to use WorkWise?',
    answer: 'No! WorkWise is designed for business owners and managers, not just accountants. The interface is intuitive and guides you through every step.'
  },
  {
    question: 'Is my data safe?',
    answer: 'Absolutely. We use bank-grade encryption (AES-256-GCM), Clerk authentication, and maintain a full audit trail of all actions.'
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. You can cancel your subscription at any time. Your data remains accessible until the end of your billing period.'
  },
  {
    question: 'Do you support M-Pesa payments?',
    answer: 'Yes! You can pay for your subscription via M-Pesa, and also disburse salaries to employees via M-Pesa B2C.'
  },
  {
    question: 'What statutory reports do you generate?',
    answer: 'We generate P9 Annual Tax Cards, P10 Monthly Returns, NSSF Remittance Schedules, and SHIF/AHL schedules ready for upload.'
  }
];

// ── Help Center Page ───────────────────────────────────────────────────────────
export default function HelpCenter() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sections based on search query
  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.content.some(c =>
      c.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.text.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <>
      <AuthRedirect />
      <div className="min-h-screen bg-slate-950 text-white">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold font-outfit">W</span>
                </div>
                <span className="text-lg font-bold tracking-tight font-outfit">WorkWise</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
              <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/#roles" className="hover:text-white transition-colors">Who It's For</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/help" className="text-teal-400 font-semibold">Help Center</Link>
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
        <section className="pt-16 pb-10 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
            <h1 className="text-4xl sm:text-5xl font-black font-outfit leading-tight">
              WorkWise Help Center
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Your complete guide to using WorkWise. From getting started to advanced payroll and accounting.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search for help topics..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Quick Links Grid ────────────────────────────────────────────── */}
        <section className="py-8 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => {
                    const el = document.getElementById(section.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="p-5 rounded-2xl bg-white/3 border border-white/8 hover:border-teal-500/30 hover:bg-white/5 transition-all text-left group"
                >
                  <div className={`h-10 w-10 rounded-xl ${section.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <section.icon className={`h-5 w-5 ${section.color}`} />
                  </div>
                  <h3 className="font-bold text-white text-sm">{section.title}</h3>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Main Content ────────────────────────────────────────────────── */}
        <section className="py-10 px-6">
          <div className="max-w-4xl mx-auto space-y-12">
            {filteredSections.length === 0 ? (
              <div className="text-center py-20">
                <Search className="h-16 w-16 text-slate-600 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-2">No results found</h3>
                <p className="text-slate-400">Try searching for something else</p>
              </div>
            ) : (
              filteredSections.map(section => (
                <div key={section.id} id={section.id} className="scroll-mt-24">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`h-12 w-12 rounded-xl ${section.bg} flex items-center justify-center`}>
                      <section.icon className={`h-6 w-6 ${section.color}`} />
                    </div>
                    <h2 className="text-3xl font-black font-outfit text-white">{section.title}</h2>
                  </div>
                  <div className="space-y-6">
                    {section.content.map((item, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-white/3 border border-white/8">
                        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-teal-400 flex-shrink-0" />
                          {item.subtitle}
                        </h3>
                        <p className="text-slate-400 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── FAQ Section ─────────────────────────────────────────────────── */}
        <section className="py-16 px-6 bg-slate-900/50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black font-outfit text-white mb-3">Frequently Asked Questions</h2>
              <p className="text-slate-400">Quick answers to common questions</p>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-white/3 border border-white/8">
                  <h3 className="font-bold text-white mb-2">{faq.question}</h3>
                  <p className="text-slate-400">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact Section ─────────────────────────────────────────────── */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="bg-gradient-to-br from-teal-900/40 to-slate-900 border border-teal-500/20 rounded-3xl p-10">
              <Mail className="h-12 w-12 text-teal-400 mx-auto mb-6" />
              <h2 className="text-2xl font-black font-outfit text-white mb-3">Still Need Help?</h2>
              <p className="text-slate-400 mb-6">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <a
                href="mailto:hello@workwise.co.ke"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all"
              >
                <Mail className="h-4 w-4" /> Email Us
              </a>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-12 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="h-7 w-7 bg-teal-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm font-outfit">W</span>
                </div>
                <span className="font-bold text-slate-400 font-outfit">WorkWise</span>
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
              <Link href="/pricing" className="hover:text-slate-400 transition-colors">Pricing</Link>
              <Link href="/help" className="text-slate-400">Help Center</Link>
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
