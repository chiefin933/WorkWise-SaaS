'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { financeApi } from '@/lib/api';
import type { DashboardStats, FinancialSummary } from '@/lib/types';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Users, DollarSign, Clock, Calendar, TrendingUp,
  ShieldCheck, ArrowRight, AlertTriangle, CheckCircle2,
  Building, Receipt, PiggyBank, BarChart3, Bell,
  FileText, Banknote, UserCheck, XCircle, ChevronRight,
} from 'lucide-react';

export default function CEODashboard() {
  const { user } = useAuthStore();
  const { user: clerkUser } = useUser();
  const today = new Date();

  const firstName =
    user?.first_name?.trim() ||
    clerkUser?.firstName?.trim() ||
    user?.email?.split('@')[0] ||
    'there';

  // ── Data from both modules ─────────────────────────────────────────────────
  const { data: hrStats, isLoading: hrLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats/').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: finSummary, isLoading: finLoading } = useQuery<FinancialSummary>({
    queryKey: ['finance-summary', today.getMonth() + 1, today.getFullYear()],
    queryFn: () => financeApi.getFinancialSummary({ month: today.getMonth() + 1, year: today.getFullYear() }),
    refetchInterval: 30000,
  });

  const { data: leaveData } = useQuery({
    queryKey: ['ceo-leave-pending'],
    queryFn: () => api.get('/leave/', { params: { status: 'pending' } }).then(r =>
      Array.isArray(r.data) ? r.data : r.data.results ?? []
    ),
    refetchInterval: 30000,
  });

  const { data: payrollData } = useQuery({
    queryKey: ['ceo-payroll'],
    queryFn: () => api.get('/payroll/').then(r =>
      Array.isArray(r.data) ? r.data : r.data.results ?? []
    ),
    refetchInterval: 30000,
  });

  const { data: expenseData } = useQuery({
    queryKey: ['ceo-expenses-pending'],
    queryFn: () => financeApi.getExpenses({ status: 'pending' }),
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['ceo-notifications'],
    queryFn: () => api.get('/notifications/', { params: { limit: 8 } }).then(r =>
      Array.isArray(r.data) ? r.data : r.data.results ?? []
    ),
    refetchInterval: 30000,
  });

  const isLoading = hrLoading || finLoading;

  const pendingLeaves    = (leaveData ?? []).length;
  const pendingExpenses  = finSummary?.pending_count ?? 0;
  const totalPending     = pendingLeaves + pendingExpenses;
  const latestPayrollRun = (payrollData ?? [])[0] ?? null;
  const budgetPct        = finSummary?.budget_utilization_pct ?? 0;
  const budgetColor      = budgetPct >= 100 ? 'text-red-500' : budgetPct >= 80 ? 'text-amber-500' : 'text-purple-600';
  const budgetBg         = budgetPct >= 100 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-purple-50 dark:bg-purple-900/20';

  const kpis = [
    { label: 'Total Employees',    value: hrStats?.total_employees ?? '—',
      icon: Users,       color: 'text-teal-600',    bg: 'bg-teal-50 dark:bg-teal-900/20',    href: '/employees' },
    { label: 'Monthly Payroll',    value: finSummary ? `KES ${finSummary.payroll_cost.toLocaleString()}` : '—',
      icon: DollarSign,  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', href: '/payroll' },
    { label: 'Approved Expenses',  value: finSummary ? `KES ${finSummary.total_expenses.toLocaleString()}` : '—',
      icon: Receipt,     color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20',    href: '/finance/expenses' },
    { label: 'Budget Utilization', value: finSummary ? `${budgetPct}%` : '—',
      icon: BarChart3,   color: budgetColor,        bg: budgetBg,                            href: '/finance/budgets' },
    { label: 'Attendance Rate',    value: hrStats?.attendance_rate ? `${hrStats.attendance_rate}%` : '—',
      icon: Clock,       color: 'text-cyan-600',    bg: 'bg-cyan-50 dark:bg-cyan-900/20',    href: '/attendance' },
    { label: 'Pending Approvals',  value: isLoading ? '—' : totalPending,
      icon: AlertTriangle, color: totalPending > 0 ? 'text-amber-600' : 'text-slate-400',
      bg: totalPending > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-100 dark:bg-slate-800', href: '/leave' },
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
            {today.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}{user?.company_name ?? 'Your Company'} · <span className="capitalize">{user?.plan ?? 'Business'} Plan</span>
          </p>
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

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Pending Approvals ─────────────────────────────────────── */}
        <GlassCard className="p-6 border border-slate-200/60 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Pending Approvals
            </h3>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${totalPending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {totalPending}
            </span>
          </div>

          <div className="space-y-3">
            {/* Pending leave */}
            <Link href="/leave" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Leave Requests</p>
                  <p className="text-xs text-slate-500">Awaiting HR approval</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${pendingLeaves > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{pendingLeaves}</span>
                <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            {/* Pending expenses */}
            <Link href="/finance/expenses" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Expense Claims</p>
                  <p className="text-xs text-slate-500">Awaiting Finance approval</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${pendingExpenses > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{pendingExpenses}</span>
                <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            {/* Payroll status */}
            <Link href="/payroll" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Latest Payroll</p>
                  <p className="text-xs text-slate-500">
                    {latestPayrollRun
                      ? `${latestPayrollRun.month}/${latestPayrollRun.year} — ${latestPayrollRun.status}`
                      : 'No payroll runs yet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {latestPayrollRun && (
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    latestPayrollRun.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    latestPayrollRun.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    latestPayrollRun.status === 'processed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>{latestPayrollRun.status}</span>
                )}
                <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </div>
        </GlassCard>

        {/* ── Financial Overview ────────────────────────────────────── */}
        <GlassCard className="p-6 border border-slate-200/60 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Financial Overview</h3>
              <p className="text-xs text-slate-500 mt-0.5">This month — payroll + expenses vs budget</p>
            </div>
            <Link href="/finance" className="text-xs text-teal-600 font-bold hover:underline">Finance dashboard →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="space-y-5">
              {[
                { label: 'Payroll Cost',        value: finSummary?.payroll_cost ?? 0,    color: 'bg-teal-500' },
                { label: 'Approved Expenses',   value: finSummary?.total_expenses ?? 0,  color: 'bg-blue-500' },
                { label: 'Pending Expenses',    value: finSummary?.pending_expenses ?? 0, color: 'bg-amber-400' },
                { label: 'Petty Cash Balance',  value: finSummary?.petty_balance ?? 0,   color: 'bg-purple-400' },
              ].map(item => {
                const budget = finSummary?.total_budget ?? 0;
                const pct = budget > 0 ? Math.min(Math.round((item.value / budget) * 100), 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">KES {item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 mb-1">Total Budget</p>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">KES {(finSummary?.total_budget ?? 0).toLocaleString()}</p>
                </div>
                <div className={`p-3 rounded-xl ${budgetPct >= 100 ? 'bg-red-50 dark:bg-red-900/20' : budgetPct >= 80 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                  <p className="text-xs text-slate-500 mb-1">Budget Used</p>
                  <p className={`font-bold text-sm ${budgetColor}`}>{budgetPct}%{budgetPct >= 80 ? ' ⚠' : ''}</p>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* HR + Department breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Department headcount */}
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Department Headcount</h3>
            <Link href="/employees" className="text-xs text-teal-600 font-bold hover:underline">View all →</Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
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
                      <span className="text-slate-500 tabular-nums">{dept.employees} emp · {pct}%</span>
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

        {/* Recent notifications from both modules */}
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" /> Recent Activity
            </h3>
            <Link href="/notifications" className="text-xs text-teal-600 font-bold hover:underline">View all →</Link>
          </div>
          {(notifications ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircle2 className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">All caught up — no new activity.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {(notifications ?? []).slice(0, 6).map((n: { id: string; type: string; title: string; message: string; is_read: boolean; created_at: string }) => {
                const typeColors: Record<string, string> = {
                  payroll:  'bg-teal-50 text-teal-600 dark:bg-teal-900/20',
                  leave:    'bg-amber-50 text-amber-600 dark:bg-amber-900/20',
                  employee: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
                  system:   'bg-slate-100 text-slate-600 dark:bg-slate-800',
                };
                const typeIcons: Record<string, React.ReactNode> = {
                  payroll:  <Banknote className="h-4 w-4" />,
                  leave:    <Calendar className="h-4 w-4" />,
                  employee: <UserCheck className="h-4 w-4" />,
                  system:   <Bell className="h-4 w-4" />,
                };
                return (
                  <div key={n.id} className={`flex items-start gap-3 py-3 ${!n.is_read ? 'opacity-100' : 'opacity-60'}`}>
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[n.type] ?? typeColors.system}`}>
                      {typeIcons[n.type] ?? typeIcons.system}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{n.title}</p>
                      <p className="text-xs text-slate-500 truncate">{n.message}</p>
                    </div>
                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0 mt-1.5" />}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Management shortcut grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Management Areas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Employees',   href: '/employees',           icon: Users,       color: 'text-teal-600',    bg: 'bg-teal-50 dark:bg-teal-900/20' },
            { label: 'Attendance',  href: '/attendance',          icon: Clock,       color: 'text-cyan-600',    bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
            { label: 'Leave',       href: '/leave',               icon: Calendar,    color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Payroll',     href: '/payroll',             icon: Banknote,    color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Expenses',    href: '/finance/expenses',    icon: Receipt,     color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Budgets',     href: '/finance/budgets',     icon: PiggyBank,   color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-900/20' },
            { label: 'Reports',     href: '/reports',             icon: BarChart3,   color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
            { label: 'Audit Trail', href: '/audit',               icon: ShieldCheck, color: 'text-slate-600',   bg: 'bg-slate-100 dark:bg-slate-800' },
          ].map(item => (
            <Link key={item.label} href={item.href}>
              <GlassCard className="p-4 text-center hover:shadow-md transition-all cursor-pointer border border-slate-200/60 group">
                <div className={`h-9 w-9 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{item.label}</p>
              </GlassCard>
            </Link>
          ))}
        </div>
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
