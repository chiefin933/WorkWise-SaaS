'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import { financeApi } from '@/lib/api';
import type { FinancialSummary } from '@/lib/types';
import Link from 'next/link';
import {
  DollarSign, Receipt, PiggyBank, Banknote, TrendingUp,
  TrendingDown, AlertCircle, CheckCircle2, ArrowRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORY_LABELS: Record<string, string> = {
  travel: 'Travel', accommodation: 'Accommodation', meals: 'Meals',
  office: 'Office Supplies', client: 'Client Entertainment',
  utilities: 'Utilities', training: 'Training', medical: 'Medical', other: 'Other',
};

export default function FinanceDashboard() {
  const { user } = useAuthStore();
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'there';
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());

  const { data: summary, isLoading } = useQuery<FinancialSummary>({
    queryKey: ['finance-summary', month, year],
    queryFn: () => financeApi.getFinancialSummary({ month, year }),
    refetchInterval: 60000,
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear();
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear();

  const kpis = [
    {
      label: 'Total Payroll Cost',
      value: summary ? `KES ${summary.payroll_cost.toLocaleString()}` : '—',
      icon: DollarSign, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20',
      href: '/payroll',
    },
    {
      label: 'Approved Expenses',
      value: summary ? `KES ${summary.total_expenses.toLocaleString()}` : '—',
      icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20',
      href: '/finance/expenses',
    },
    {
      label: 'Pending Expense Claims',
      value: summary?.pending_count ?? '—',
      sub: summary ? `KES ${summary.pending_expenses.toLocaleString()} awaiting review` : '',
      icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20',
      href: '/finance/expenses?status=pending',
    },
    {
      label: 'Petty Cash Balance',
      value: summary ? `KES ${summary.petty_balance.toLocaleString()}` : '—',
      icon: Banknote, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20',
      href: '/finance/petty-cash',
    },
  ];

  const budgetPct = summary?.budget_utilization_pct ?? 0;
  const budgetColor = budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-1">Finance Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Good {getTimeOfDay()}, {firstName}. Here's your financial overview.</p>
        </div>
        {/* Month Picker */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-sm">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white w-28 text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map(kpi => (
          <Link key={kpi.label} href={kpi.href}>
            <GlassCard className="p-6 hover:shadow-md transition-all cursor-pointer border border-slate-200/60 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className={`h-12 w-12 rounded-2xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-1">
                {isLoading ? <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" /> : kpi.value}
              </div>
              <div className="text-sm text-slate-500">{kpi.label}</div>
              {kpi.sub && <div className="text-xs text-amber-600 mt-1">{kpi.sub}</div>}
            </GlassCard>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Utilization */}
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Overall Budget Utilization</h3>
              <p className="text-xs text-slate-500 mt-0.5">{MONTHS[month-1]} {year}</p>
            </div>
            <Link href="/finance/budgets" className="text-xs text-teal-600 font-bold hover:underline">Manage budgets →</Link>
          </div>
          {isLoading ? (
            <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ) : (
            <>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-3xl font-black text-slate-900 dark:text-white font-outfit">{budgetPct}%</span>
                  <span className="text-sm text-slate-500 ml-2">of total budget used</span>
                </div>
                {budgetPct >= 80 && (
                  <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {budgetPct >= 100 ? 'Over budget' : 'Near limit'}
                  </span>
                )}
              </div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
                <div className={`h-full ${budgetColor} rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 mb-1">Total Budget</p>
                  <p className="font-bold text-slate-900 dark:text-white">
                    KES {(summary?.total_budget ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 mb-1">Actual Spend</p>
                  <p className="font-bold text-slate-900 dark:text-white">
                    KES {(summary?.total_actual ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </>
          )}
        </GlassCard>

        {/* Expenses by Category */}
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Expenses by Category</h3>
              <p className="text-xs text-slate-500 mt-0.5">Approved &amp; reimbursed claims</p>
            </div>
            <Link href="/finance/expenses" className="text-xs text-teal-600 font-bold hover:underline">View all →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : (summary?.expenses_by_category?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Receipt className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No approved expenses this month.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary!.expenses_by_category.map(cat => {
                const total = summary!.expenses_by_category.reduce((s, c) => s + c.total, 0);
                const pct = total ? Math.round((cat.total / total) * 100) : 0;
                return (
                  <div key={cat.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {CATEGORY_LABELS[cat.category] ?? cat.category}
                      </span>
                      <span className="text-slate-500">KES {cat.total.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Review Pending Expenses', href: '/finance/expenses?status=pending', icon: Receipt, desc: `${summary?.pending_count ?? 0} claims awaiting your review` },
          { label: 'Set Department Budgets', href: '/finance/budgets', icon: PiggyBank, desc: 'Allocate monthly budgets per department' },
          { label: 'Petty Cash Management', href: '/finance/petty-cash', icon: Banknote, desc: `Balance: KES ${(summary?.petty_balance ?? 0).toLocaleString()}` },
        ].map(action => (
          <Link key={action.label} href={action.href}>
            <GlassCard className="p-5 hover:shadow-md transition-all cursor-pointer border border-slate-200/60 group">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/20 flex items-center justify-center transition-colors">
                  <action.icon className="h-5 w-5 text-slate-500 group-hover:text-teal-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{action.label}</p>
                  <p className="text-xs text-slate-500 truncate">{action.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
