'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { financeApi } from '@/lib/api';
import type { DashboardStats, FinancialSummary } from '@/lib/types';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Users, DollarSign, Clock, Calendar, TrendingUp, TrendingDown,
  ShieldCheck, ArrowRight, AlertTriangle, CheckCircle2,
  Building, Receipt, PiggyBank, BarChart3,
} from 'lucide-react';

export default function CEODashboard() {
  const { user } = useAuthStore();
  const { user: clerkUser } = useUser();
  const today = new Date();

  // Prefer Django profile name, fall back to Clerk name, then email prefix
  const firstName =
    user?.first_name?.trim() ||
    clerkUser?.firstName?.trim() ||
    user?.email?.split('@')[0] ||
    'there';

  const { data: hrStats, isLoading: hrLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats/').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: finSummary, isLoading: finLoading } = useQuery<FinancialSummary>({
    queryKey: ['finance-summary', today.getMonth() + 1, today.getFullYear()],
    queryFn: () => financeApi.getFinancialSummary({ month: today.getMonth() + 1, year: today.getFullYear() }),
    refetchInterval: 60000,
  });

  const isLoading = hrLoading || finLoading;

  const kpis = [
    {
      label: 'Total Employees',
      value: hrStats?.total_employees ?? '—',
      icon: Users, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20',
      href: '/employees', trend: null,
    },
    {
      label: 'Monthly Payroll Cost',
      value: finSummary ? `KES ${finSummary.payroll_cost.toLocaleString()}` : '—',
      icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      href: '/payroll', trend: null,
    },
    {
      label: 'Total Monthly Expenses',
      value: finSummary ? `KES ${finSummary.total_expenses.toLocaleString()}` : '—',
      icon: Receipt, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20',
      href: '/finance/expenses', trend: null,
    },
    {
      label: 'Budget Utilization',
      value: finSummary ? `${finSummary.budget_utilization_pct}%` : '—',
      icon: BarChart3,
      color: finSummary && finSummary.budget_utilization_pct >= 100 ? 'text-red-500' : finSummary && finSummary.budget_utilization_pct >= 80 ? 'text-amber-500' : 'text-purple-600',
      bg: finSummary && finSummary.budget_utilization_pct >= 100 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-purple-50 dark:bg-purple-900/20',
      href: '/finance/budgets', trend: null,
    },
    {
      label: 'Attendance Rate',
      value: hrStats?.attendance_rate ? `${hrStats.attendance_rate}%` : '—',
      icon: Clock, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20',
      href: '/attendance', trend: null,
    },
    {
      label: 'Pending Approvals',
      value: (hrStats?.pending_leaves ?? 0) + (finSummary?.pending_count ?? 0),
      icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20',
      href: '/leave', trend: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 dark:bg-teal-900/20 border border-teal-200/60 dark:border-teal-800/60 text-xs font-bold text-teal-700 dark:text-teal-400 mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> CEO / Administrator Dashboard
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-1">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Company overview — {today.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{user?.company_name ?? 'Your Company'}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{user?.plan ?? 'Business'} Plan</p>
          </div>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
            </GlassCard>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll + Expense Trend */}
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Financial Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5">This month vs total budget</p>
            </div>
            <Link href="/finance" className="text-xs text-teal-600 font-bold hover:underline">Finance dashboard →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Payroll', value: finSummary?.payroll_cost ?? 0, total: finSummary?.total_budget ?? 0, color: 'bg-teal-500' },
                { label: 'Expenses', value: finSummary?.total_expenses ?? 0, total: finSummary?.total_budget ?? 0, color: 'bg-blue-500' },
                { label: 'Pending Expenses', value: finSummary?.pending_expenses ?? 0, total: finSummary?.total_budget ?? 0, color: 'bg-amber-500' },
              ].map(item => {
                const pct = item.total ? Math.min(Math.round((item.value / item.total) * 100), 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                      <span className="text-slate-500 tabular-nums">KES {item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-sm">
                <span className="text-slate-500">Total Budget</span>
                <span className="font-bold text-slate-900 dark:text-white">KES {(finSummary?.total_budget ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Department Cost Breakdown */}
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Department Headcount</h3>
              <p className="text-xs text-slate-500 mt-0.5">Employees per department</p>
            </div>
            <Link href="/employees" className="text-xs text-teal-600 font-bold hover:underline">View employees →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : (hrStats?.department_costs?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Building className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No department data yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hrStats!.department_costs!.map(dept => {
                const total = hrStats!.department_costs!.reduce((s, d) => s + d.employees, 0);
                const pct = total ? Math.round((dept.employees / total) * 100) : 0;
                return (
                  <div key={dept.department}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{dept.department}</span>
                      <span className="text-slate-500">{dept.employees} employees · {pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Quick Navigation for CEO */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Management Areas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'HR Dashboard',  href: '/hr',                icon: Users,     color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-900/20' },
            { label: 'Finance',       href: '/finance',           icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Payroll',       href: '/payroll',           icon: Receipt,   color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Budgets',       href: '/finance/budgets',   icon: PiggyBank, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Audit Trail',   href: '/audit',             icon: ShieldCheck, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
            { label: 'Reports',       href: '/reports',           icon: BarChart3, color: 'text-cyan-600',   bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
          ].map(item => (
            <Link key={item.label} href={item.href}>
              <GlassCard className="p-4 text-center hover:shadow-md transition-all cursor-pointer border border-slate-200/60 group">
                <div className={`h-10 w-10 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.label}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {(hrStats?.recent_activities?.length ?? 0) > 0 && (
        <GlassCard className="p-6 border border-slate-200/60">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Recent Company Activity</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {hrStats!.recent_activities!.slice(0, 6).map((activity, i) => (
              <div key={i} className="flex items-start gap-4 py-3">
                <div className="h-8 w-8 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{activity.title}</p>
                  <p className="text-xs text-slate-500 truncate">{activity.description}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
