'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import { useUser } from '@clerk/nextjs';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Clock, Calendar, FileText, Receipt, ArrowRight,
  CheckCircle2, XCircle, AlertCircle, User,
} from 'lucide-react';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { user: clerkUser } = useUser();

  const firstName =
    user?.first_name?.trim() ||
    clerkUser?.firstName?.trim() ||
    user?.email?.split('@')[0] ||
    'there';

  const { data: leaveData } = useQuery({
    queryKey: ['my-leave'],
    queryFn: () => api.get('/leave/').then(r => r.data),
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => api.get('/attendance/').then(r => r.data),
  });

  const { data: expenseData } = useQuery({
    queryKey: ['my-expenses'],
    queryFn: () => api.get('/finance/expenses/').then(r => r.data),
  });

  const leaves = Array.isArray(leaveData) ? leaveData : leaveData?.results ?? [];
  const attendance = Array.isArray(attendanceData) ? attendanceData : attendanceData?.results ?? [];
  const expenses = Array.isArray(expenseData) ? expenseData : expenseData?.results ?? [];

  const pendingLeaves   = leaves.filter((l: { status: string }) => l.status === 'pending').length;
  const approvedLeaves  = leaves.filter((l: { status: string }) => l.status === 'approved').length;
  const pendingExpenses = expenses.filter((e: { status: string }) => e.status === 'pending').length;

  const quickLinks = [
    { label: 'My Attendance',  href: '/attendance',           icon: Clock,     desc: 'Clock in/out and view your log' },
    { label: 'Request Leave',  href: '/leave',                icon: Calendar,  desc: 'Apply for annual, sick or other leave' },
    { label: 'My Payslips',    href: '/manager/self-service', icon: FileText,  desc: 'Download your monthly payslips' },
    { label: 'Expense Claims', href: '/finance/expenses',     icon: Receipt,   desc: 'Submit and track expense reimbursements' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-1">
            Good {getTimeOfDay()}, {firstName}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200/60 dark:border-teal-800/60">
          <User className="h-5 w-5 text-teal-600" />
          <div>
            <p className="text-xs text-teal-600 font-bold uppercase tracking-widest">Your Role</p>
            <p className="text-sm font-bold text-teal-800 dark:text-teal-300">Employee</p>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{pendingLeaves}</p>
              <p className="text-sm text-slate-500">Pending Leave Requests</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{approvedLeaves}</p>
              <p className="text-sm text-slate-500">Approved Leave Days</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{pendingExpenses}</p>
              <p className="text-sm text-slate-500">Pending Expense Claims</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">What would you like to do?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map(link => (
            <Link key={link.label} href={link.href}>
              <GlassCard className="p-6 hover:shadow-md transition-all cursor-pointer border border-slate-200/60 group h-full">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 group-hover:bg-teal-50 dark:group-hover:bg-teal-900/20 flex items-center justify-center mb-4 transition-colors">
                  <link.icon className="h-6 w-6 text-slate-500 group-hover:text-teal-600 transition-colors" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">{link.label}</h3>
                <p className="text-xs text-slate-500">{link.desc}</p>
                <div className="flex items-center gap-1 mt-3 text-xs text-teal-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Go <ArrowRight className="h-3 w-3" />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Leave Requests */}
      <GlassCard className="p-6 border border-slate-200/60">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white">My Recent Leave Requests</h3>
          <Link href="/leave" className="text-xs text-teal-600 font-bold hover:underline">View all →</Link>
        </div>
        {leaves.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No leave requests yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {leaves.slice(0, 5).map((leave: { id: string; leave_type: string; start_date: string; end_date: string; status: string }) => (
              <div key={leave.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{leave.leave_type} Leave</p>
                  <p className="text-xs text-slate-500">{leave.start_date} → {leave.end_date}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                  leave.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  leave.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>{leave.status}</span>
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
