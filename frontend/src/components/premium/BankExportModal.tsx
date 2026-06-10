'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { PayrollRun } from '@/lib/types';
import {
  Download, X, Building2, Loader2, CheckCircle,
  Lock, Zap, ArrowRight, Star,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  run: PayrollRun | null;
  /** Pass true when the tenant is on Starter — shows the upgrade wall immediately */
  isPlanLocked?: boolean;
  currentPlan?: string;
}

const BANKS = [
  {
    id: 'equity',
    name: 'Equity Bank',
    code: '68',
    textColor: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    active: 'ring-2 ring-red-400 bg-red-50 border-red-300',
    iconBg: 'bg-red-500',
    desc: 'Equity EFT bulk payment format',
  },
  {
    id: 'kcb',
    name: 'KCB Bank',
    code: '01',
    textColor: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    active: 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-300',
    iconBg: 'bg-emerald-600',
    desc: 'KCB bulk salary disbursement',
  },
  {
    id: 'coop',
    name: 'Co-operative Bank',
    code: '11',
    textColor: 'text-indigo-700',
    bg: 'bg-indigo-50 border-indigo-200',
    active: 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300',
    iconBg: 'bg-indigo-600',
    desc: 'Co-op Bank batch transfer format',
  },
  {
    id: 'stanbic',
    name: 'Stanbic Bank',
    code: '31',
    textColor: 'text-sky-700',
    bg: 'bg-sky-50 border-sky-200',
    active: 'ring-2 ring-sky-500 bg-sky-50 border-sky-300',
    iconBg: 'bg-sky-600',
    desc: 'Stanbic Kenya bulk payment CSV',
  },
];

const GROWTH_FEATURES = [
  'Bulk bank export for all 4 major Kenyan banks',
  'Up to 75 employees',
  'Advanced payroll analytics',
  'Priority email support',
  'Custom payroll configurations',
];

export function BankExportModal({ isOpen, onClose, run, isPlanLocked = false, currentPlan = 'STARTER' }: Props) {
  const [selectedBank, setSelectedBank] = useState('equity');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  if (!isOpen || !run) return null;

  const monthName = new Date(2000, run.month - 1).toLocaleString('default', { month: 'long' });

  // Show upgrade wall if plan is locked coming in, OR if API returned 403
  const showUpgradeWall = isPlanLocked || upgradeRequired;

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setDone(false);
    setUpgradeRequired(false);
    try {
      const response = await api.get(
        `/payroll/${run.id}/bank-export/`,
        { params: { bank: selectedBank }, responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `bank_export_${selectedBank}_${String(run.month).padStart(2, '0')}_${run.year}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err: unknown) {
      // Check for plan gate 403
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        try {
          const text = await new Response((err as { response?: { data?: unknown } }).response?.data).text();
          const parsed = JSON.parse(text);
          if (parsed?.upgrade_required) {
            setUpgradeRequired(true);
            return;
          }
        } catch {/* fall through to generic error */}
      }
      const msg = (err as { response?: { data?: unknown } })?.response?.data
        ? await new Response((err as { response?: { data?: unknown } }).response?.data).text()
        : 'Export failed. Ensure employees have bank details set.';
      setError(msg.replace(/[{}"]/g, '').replace('error:', '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">

        {/* ── Upgrade Wall ──────────────────────────────────────────────────── */}
        {showUpgradeWall ? (
          <>
            {/* Header */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 pt-6 pb-8 text-center overflow-hidden">
              {/* decorative rings */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border border-white/5" />
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full border border-white/5" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="h-14 w-14 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Growth Plan Required</h2>
              <p className="text-sm text-slate-400">
                Bulk Bank Export is a <span className="text-amber-400 font-semibold">Growth+</span> feature.
                You're currently on the <span className="text-slate-300 font-semibold">{currentPlan}</span> plan.
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Feature list */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  What you unlock on Growth
                </p>
                <ul className="space-y-2">
                  {GROWTH_FEATURES.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <span className="mt-0.5 h-4 w-4 rounded-full bg-teal-500/15 flex items-center justify-center shrink-0">
                        <Star className="h-2.5 w-2.5 text-teal-600" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan comparison pill */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {['STARTER', 'GROWTH', 'BUSINESS'].map((plan) => (
                  <div
                    key={plan}
                    className={`py-2.5 px-3 rounded-xl border font-semibold ${
                      plan === 'GROWTH'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                        : plan === currentPlan
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {plan === 'GROWTH' && <Zap className="h-3 w-3 mx-auto mb-0.5" />}
                    {plan}
                    {plan === 'GROWTH' && (
                      <div className="text-teal-200 font-normal text-[10px]">Recommended</div>
                    )}
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 rounded-2xl h-12 border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  Maybe Later
                </Button>
                <Link href="/pricing" className="flex-1">
                  <Button className="w-full rounded-2xl h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold gap-2 shadow-md">
                    Upgrade Now
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </>
        ) : (
          /* ── Normal Export UI ──────────────────────────────────────────────── */
          <>
            {/* Header */}
            <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 px-6 pt-6 pb-5">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-2xl bg-teal-500/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Bulk Bank Export</h2>
                  <p className="text-xs text-slate-400">
                    {monthName} {run.year} · {run.item_count} employees
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Bank selector */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Select Your Bank
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {BANKS.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBank(bank.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        selectedBank === bank.id ? bank.active : bank.bg
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl ${bank.iconBg} flex items-center justify-center mb-2`}
                      >
                        <Building2 className="h-4 w-4 text-white" />
                      </div>
                      <div className={`text-sm font-bold ${bank.textColor}`}>{bank.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{bank.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-700 mb-2">What&apos;s included in the CSV?</div>
                <div>✓ Employee name &amp; account number</div>
                <div>✓ Net take-home salary (post-deductions)</div>
                <div>✓ Bank code, branch code, narration</div>
                <div>✓ Bank-specific format headers</div>
                <div className="mt-2 text-amber-600 font-semibold">
                  ⚠ Only employees with payment method = Bank Transfer are included.
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 rounded-2xl h-12 border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={loading}
                  className="flex-1 rounded-2xl h-12 bg-teal-600 hover:bg-teal-700 text-white gap-2 font-bold"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : done ? (
                    <><CheckCircle className="h-4 w-4" /> Downloaded!</>
                  ) : (
                    <><Download className="h-4 w-4" /> Download CSV</>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
