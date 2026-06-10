'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { Users, DollarSign, Clock, AlertTriangle, ArrowUpRight, Calendar, Zap, LayoutGrid, Plus } from 'lucide-react';
import { TiltCard } from '@/components/premium/TiltCard';
import { GlassCard } from '@/components/premium/GlassCard';
import { EmptyState } from '@/components/premium/EmptyState';
import { AreaChart } from '@/components/premium/CustomCharts';
import Link from 'next/link';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/dashboard/stats/');
      return res.data;
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-teal-500/20 border-t-teal-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-6 w-6 text-teal-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard className="p-8 border-red-500/20 bg-red-50/10 backdrop-blur-md">
        <div className="flex items-center gap-4 text-red-600">
           <AlertTriangle className="h-8 w-8" />
           <div>
             <h3 className="text-lg font-bold">Data Synchronization Error</h3>
             <p className="text-sm opacity-80">We couldn&apos;t fetch your dashboard metrics. Please refresh or contact support.</p>
           </div>
        </div>
      </GlassCard>
    );
  }

  const isEmpty = !data || data.total_employees === 0;

  return (
    <div className="space-y-10">
      {/* Welcome Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-8 md:p-12 shadow-xl">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-slate-850/30 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-800/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold tracking-wider uppercase mb-6">
            All systems running smoothly
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white font-outfit mb-4">
            {getGreeting()}, <span className="text-white">Admin</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            {isEmpty 
              ? 'Welcome to Workwise! Let&apos;s get started by adding your first employee to activate the platform features.'
              : `Your workforce is growing. You have ${data?.pending_leaves || 0} pending leave requests that need your attention today.`
            }
          </p>
          <div className="flex flex-wrap gap-4">
            {isEmpty ? (
              <Link href="/employees">
                <button className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-2xl shadow-md transition-colors flex items-center gap-2">
                  <Plus className="h-5 w-5" /> Add First Employee
                </button>
              </Link>
            ) : (
              <>
                <Link href="/payroll">
                  <button className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2">
                    Run Payroll <ArrowUpRight className="h-4 w-4" />
                  </button>
                </Link>
                <Link href="/employees">
                  <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-colors">
                    Manage Employees
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {isEmpty ? (
        <EmptyState 
          title="No data to show yet"
          description="Once you add employees and process attendance, your dashboard metrics and analytics will appear here."
          actionLabel="Add Employees"
          actionHref="/employees"
          icon={LayoutGrid}
        />
      ) : (
        <>
          {/* Stats Bento Grid */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <TiltCard className="premium-card p-8 flex flex-col justify-between h-52 group border border-slate-200/50 dark:border-white/5">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                  <Users className="w-5 h-5 text-slate-800 dark:text-slate-200" />
                </div>
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Stable</span>
              </div>
              <div className="flex flex-col-reverse gap-1">
                <div className="text-5xl font-light tracking-tight text-slate-900 dark:text-white font-outfit">{data?.total_employees || 0}</div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Total Employees</p>
              </div>
            </TiltCard>

            <TiltCard className="premium-card p-8 flex flex-col justify-between h-52 border border-slate-200/50 dark:border-white/5">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                  <DollarSign className="w-5 h-5 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-1">
                <div className="text-4xl font-light tracking-tight text-slate-900 dark:text-white font-outfit flex items-baseline gap-1">
                  <span className="text-xs font-semibold text-slate-400">KES</span>
                  {data?.monthly_payroll_cost?.toLocaleString() || 0}
                </div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Monthly Payroll</p>
              </div>
            </TiltCard>

            <TiltCard className="premium-card p-8 flex flex-col justify-between h-52 border border-slate-200/50 dark:border-white/5">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                  <Clock className="w-5 h-5 text-slate-800 dark:text-slate-200" />
                </div>
                {(data?.pending_leaves ?? 0) > 0 && (
                  <span className="text-[9px] font-bold text-slate-650 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wider">Action Required</span>
                )}
              </div>
              <div className="flex flex-col-reverse gap-1">
                <div className="text-5xl font-light tracking-tight text-slate-900 dark:text-white font-outfit">{data?.pending_leaves || 0}</div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">Pending Leaves</p>
              </div>
            </TiltCard>

            <TiltCard className="premium-card p-8 flex flex-col justify-between h-52 border border-slate-200/50 dark:border-white/5">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                  <AlertTriangle className="w-5 h-5 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-1">
                <div className="text-5xl font-light tracking-tight text-slate-900 dark:text-white font-outfit">{data?.alerts || 0}</div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">System Alerts</p>
              </div>
            </TiltCard>
          </div>

          {/* Payroll Trend Charts Section */}
          <div className="grid gap-8 lg:grid-cols-3">
            <GlassCard className="lg:col-span-3 p-8 border border-slate-200/60 shadow-sm rounded-3xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Payroll & Headcount Trends</h3>
                  <p className="text-sm text-slate-500">Overview of monthly expenditures and staff capacity.</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                    <span className="h-3 w-3 rounded-full bg-slate-800 dark:bg-slate-200" /> Net Payroll (KES)
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-450">
                    <span className="h-3 w-3 rounded-full border border-slate-400 border-dashed bg-slate-500/20" /> Staff Headcount
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <AreaChart 
                  data={data?.monthly_trends || []}
                  xKey="month"
                  yKey="cost"
                  y2Key="employees"
                />
              </div>
            </GlassCard>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            <GlassCard className="lg:col-span-2 p-8 border border-slate-200/60 shadow-sm rounded-3xl">
              <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Recent Activity</h3>
                   <p className="text-sm text-slate-500">Track payroll and attendance logs</p>
                 </div>
                 <button className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:underline">View All</button>
              </div>
              
              <div className="space-y-6">
                {(data?.recent_activities || []).length > 0 ? data?.recent_activities?.map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300 dark:hover:border-slate-700 group">
                    <div className="h-12 w-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
                      <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{activity.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{activity.description}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400 italic">{activity.time}</span>
                  </div>
                )) : (
                  <p className="text-center text-slate-400 py-8 italic">No recent activity found.</p>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-8 border border-slate-200/60 shadow-sm rounded-3xl bg-gradient-to-b from-white to-slate-50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-8">Quick Insights</h3>
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-slate-650">Employee Attendance</span>
                    <span className="text-slate-850 dark:text-slate-100">{data?.attendance_rate || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${data?.attendance_rate || 0}%` }}
                      className="h-full bg-slate-800 dark:bg-slate-250 rounded-full transition-all duration-500" 
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-slate-650">Leave Utilization</span>
                    <span className="text-slate-850 dark:text-slate-100">{data?.leave_utilization || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${data?.leave_utilization || 0}%` }}
                      className="h-full bg-slate-800 dark:bg-slate-250 rounded-full transition-all duration-500" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-150 dark:border-slate-800">
                   <div className="p-4 rounded-2xl bg-slate-950 dark:bg-slate-900 text-white dark:text-slate-200 border border-slate-850 dark:border-slate-800 shadow-sm">
                     <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                       <Zap className="h-4 w-4 text-slate-400" /> Workforce Insight
                     </h4>
                     <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed">
                       {data?.suggestion || "Maintain regular data entry to get accurate AI-driven workforce suggestions."}
                     </p>
                   </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
