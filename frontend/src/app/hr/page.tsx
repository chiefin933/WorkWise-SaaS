'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import Link from 'next/link';
import {
  Users, Clock, Calendar, DollarSign, TrendingUp,
  CheckCircle2, AlertCircle, FileText, ArrowRight,
} from 'lucide-react';

export default function HRDashboard() {
  const { user } = useAuthStore();
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'there';

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats/').then(r => r.data),
    refetchInterval: 60000,
  });

  const kpis = [
    {
      label: 'Total Employees',
      value: stats?.total_employees ?? '—',
      icon: Users,
      color: 'text-teal-600',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      href: '/employees',
    },
    {
      label: 'Pending Leave Requests',
      value: stats?.pending_leaves ?? '—',
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      href: '/leave',
    },
    {
      label: 'Monthly Payroll Cost',
      value: stats?.monthly_payroll_cost
        ? `KES ${Number(stats.monthly_payroll_cost).toLocaleString()}`
        : '—',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      href: '/payroll',
    },
    {
      label: 'Attendance Rate',
      value: stats?.attendance_rate ? `${stats.attendance_rate}%` : '—',
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      href: '/attendance',
    },
  ];

  const quickActions = [
    { label: 'Add Employee',    href: '/employees',  icon: Users },
    { label: 'Run Payroll',     href: '/payroll',    icon: DollarSign },
    { label: 'Review Leave',    href: '/leave',      icon: Calendar },
    { label: 'View Reports',    href: '/reports',    icon: FileText },
    { label: 'Mark Attendance', href: '/attendance', icon: Clock },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-1">
          Good {getTimeOfDay()}, {firstName}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          HR Manager Dashboard — {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map(kpi => (
          <Link key={kpi.label} href={kpi.href}>
            <GlassCard className="p-6 hover:shadow-md transition-all cursor-pointer border border-slate-200/60">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <GlassCard className="p-6 border border-slate-200/60">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {quickActions.map(action => (
              <Link key={action.label} href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group">
                <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-teal-50 dark:group-hover:bg-teal-900/30 transition-colors">
                  <action.icon className="h-4 w-4 text-slate-500 group-hover:text-teal-600 transition-colors" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </GlassCard>

        {/* Department Costs */}
        <GlassCard className="p-6 border border-slate-200/60 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white">Department Cost Breakdown</h3>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
            </div>
          ) : (stats?.department_costs?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <DollarSign className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No payroll data yet. Run your first payroll to see costs.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats!.department_costs!.map(dept => {
                const total = stats!.department_costs!.reduce((s, d) => s + d.cost, 0);
                const pct = total ? Math.round((dept.cost / total) * 100) : 0;
                return (
                  <div key={dept.department}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{dept.department}</span>
                      <span className="text-slate-500">KES {dept.cost.toLocaleString()} · {dept.employees} emp</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Recent Activities */}
      <GlassCard className="p-6 border border-slate-200/60">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : (stats?.recent_activities?.length ?? 0) === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No recent activity to show.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats!.recent_activities!.map((activity, i) => (
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
        )}
      </GlassCard>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
