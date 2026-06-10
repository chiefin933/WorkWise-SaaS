'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import {
  User,
  Download,
  Calendar,
  DollarSign,
  Loader2,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface PayslipItem {
  id: string;
  payroll_run: string;
  employee: string;
  employee_name: string;
  gross_salary: number;
  nssf: number;
  shif: number;
  ahl: number;
  paye: number;
  net_pay: number;
}

interface PayrollRunItem {
  id: string;
  month: number;
  year: number;
  status: string;
  items?: PayslipItem[];
}

interface LeaveRequest {
  id: string | number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

export default function SelfServicePage() {
  const profile = useAuthStore((s) => s.user);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const { data: runs, isLoading: runsLoading } = useQuery<PayrollRunItem[]>({
    queryKey: ['self-payroll'],
    queryFn: async () => {
      const res = await api.get<PayrollRunItem[]>('/payroll/?status=paid');
      return res.data;
    },
  });

  const { data: leaves, isLoading: leavesLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['self-leaves'],
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>('/leave/');
      return res.data;
    },
  });

  const handleDownload = async (itemId: string, employeeName: string, month: number, year: number) => {
    setDownloadingId(itemId);
    try {
      const response = await api.get(`/payslips/${itemId}/download/`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `payslip_${employeeName.toLowerCase().replace(/ /g, '_')}_${month}_${year}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('✅ Payslip downloaded successfully.');
    } catch {
      showToast('❌ Could not download payslip. Contact HR.');
    } finally {
      setDownloadingId(null);
    }
  };

  const monthName = (m: number) =>
    new Date(2000, m - 1).toLocaleString('default', { month: 'long' });

  const statusColors: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-700 border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusIcons: Record<string, React.ElementType> = {
    pending:  AlertCircle,
    approved: CheckCircle,
    rejected: XCircle,
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold bg-teal-600 text-white animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">
            My Portal
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Welcome back, {profile?.first_name ?? 'Employee'}. View your payslips and leave history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white text-xl font-black">
            {(profile?.first_name?.[0] ?? 'E').toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">
              {profile?.first_name} {profile?.last_name}
            </div>
            <div className="text-sm text-slate-500">{profile?.email}</div>
            <div className="text-xs text-teal-600 font-bold uppercase tracking-wide mt-0.5">
              {profile?.role}
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: FileText,
            label: 'Payslips Available',
            value: runsLoading ? '…' : String((runs ?? []).filter((r) => r.status !== 'draft').length),
            color: 'text-teal-600',
            bg: 'bg-teal-50',
          },
          {
            icon: Calendar,
            label: 'Leave Requests',
            value: leavesLoading ? '…' : String((leaves ?? []).length),
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
          {
            icon: CheckCircle,
            label: 'Approved Leaves',
            value: leavesLoading ? '…' : String((leaves ?? []).filter((l) => l.status === 'approved').length),
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            icon: Clock,
            label: 'Pending Leaves',
            value: leavesLoading ? '…' : String((leaves ?? []).filter((l) => l.status === 'pending').length),
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
        ].map((s) => (
          <GlassCard key={s.label} className={`p-5 border border-slate-200/60 ${s.bg}`}>
            <div className={`h-10 w-10 rounded-xl ${s.bg} border border-current/20 flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className={`text-3xl font-black font-outfit tabular-nums ${s.color}`}>
              {s.value}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">
              {s.label}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payslips */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-teal-500" />
            My Payslips
          </h2>
          <GlassCard className="border border-slate-200/60 overflow-hidden rounded-3xl">
            {runsLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : (runs ?? []).length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500 font-medium">No payslips available yet.</div>
                <div className="text-slate-400 text-sm mt-1">
                  Payslips appear after payroll is processed.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(runs ?? [])
                  .filter((r) => r.status !== 'draft')
                  .map((run) => {
                    const myItem = (run.items ?? []).find((i) =>
                      i.employee_name?.toLowerCase().includes(
                        (profile?.first_name ?? '').toLowerCase()
                      )
                    );
                    return (
                      <div
                        key={run.id}
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {monthName(run.month)} {run.year}
                            </div>
                            <div className="text-xs text-slate-500">
                              {myItem
                                ? `Net: KES ${Number(myItem.net_pay).toLocaleString()}`
                                : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                            </div>
                          </div>
                        </div>
                        {myItem ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleDownload(myItem.id, myItem.employee_name, run.month, run.year)
                            }
                            disabled={downloadingId === myItem.id}
                            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 gap-2"
                          >
                            {downloadingId === myItem.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><Download className="h-4 w-4" /> PDF</>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
                            Not included
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Leave history */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
            <Calendar className="h-6 w-6 text-purple-500" />
            My Leave History
          </h2>
          <GlassCard className="border border-slate-200/60 overflow-hidden rounded-3xl">
            {leavesLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : (leaves ?? []).length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500 font-medium">No leave requests found.</div>
                <div className="text-slate-400 text-sm mt-1">
                  Submit a leave request from the Leave tab.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(leaves ?? []).slice(0, 10).map((lv) => {
                  const Icon = statusIcons[lv.status] ?? AlertCircle;
                  const color = statusColors[lv.status] ?? 'bg-slate-100 text-slate-600';
                  const days =
                    Math.ceil(
                      (new Date(lv.end_date).getTime() - new Date(lv.start_date).getTime()) /
                        86400000
                    ) + 1;
                  return (
                    <div
                      key={lv.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm capitalize">
                            {lv.leave_type?.replace('_', ' ')} Leave
                          </div>
                          <div className="text-xs text-slate-500">
                            {lv.start_date} → {lv.end_date} · {days} day{days !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {lv.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Company info card */}
      <GlassCard className="p-6 border border-slate-200/60 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-teal-500/20 flex items-center justify-center">
            <User className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <div className="text-sm text-slate-400 font-semibold uppercase tracking-widest">
              Your Organisation
            </div>
            <div className="text-xl font-bold text-white font-outfit">
              {profile?.company_name ?? '—'}
            </div>
            <div className="text-sm text-slate-400 mt-0.5">
              Plan: <span className="text-teal-400 font-bold">{profile?.plan ?? 'STARTER'}</span>
              {' · '}
              Role: <span className="text-teal-400 font-bold">{profile?.role ?? '—'}</span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
