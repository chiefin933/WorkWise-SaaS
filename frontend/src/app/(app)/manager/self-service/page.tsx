'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import type { Employee } from '@/lib/types';
import Link from 'next/link';
import {
  ArrowLeft,
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
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface EmployeePayslip {
  id: string;
  payroll_run: string;
  gross_salary: number;
  nssf: number;
  shif: number;
  ahl: number;
  paye: number;
  net_pay: number;
  month: number;
  year: number;
  status: string;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface LeaveBalanceItem {
  total: number | null;
  used: number;
  pending: number;
  remaining: number | null;
}

export default function SelfServicePage() {
  const profile = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Leave Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Personal Info Update State
  const [phoneInput, setPhoneInput] = useState('');
  const [updatingPhone, setUpdatingPhone] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Resolve employee record for this user
  const { data: employees, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ['self-employee'],
    queryFn: async () => {
      const res = await api.get<Employee[]>('/employees/');
      return res.data;
    },
  });

  const myEmployee = employees?.[0];

  // 2. Fetch payslips for this employee
  const { data: payslips, isLoading: payslipsLoading } = useQuery<EmployeePayslip[]>({
    queryKey: ['self-payslips', myEmployee?.id],
    enabled: !!myEmployee?.id,
    queryFn: async () => {
      if (!myEmployee?.id) return [];
      const res = await api.get<EmployeePayslip[]>(`/employees/${myEmployee.id}/payslips/`);
      return res.data;
    },
  });

  // 3. Fetch leaves
  const { data: leaves, isLoading: leavesLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['self-leaves'],
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>('/leave/');
      return res.data;
    },
  });

  // 4. Fetch leave balance
  const { data: balance, isLoading: balanceLoading } = useQuery<Record<string, LeaveBalanceItem>>({
    queryKey: ['leave-balance'],
    queryFn: async () => {
      const res = await api.get<Record<string, LeaveBalanceItem>>('/leave/my-balance/');
      return res.data;
    },
  });

  // Sync phone input when employee data is loaded
  useEffect(() => {
    if (myEmployee?.phone) {
      setPhoneInput(myEmployee.phone);
    }
  }, [myEmployee]);

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

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveSubmitting(true);
    setLeaveError('');

    if (!myEmployee?.id) {
      setLeaveError('Could not resolve your employee ID.');
      setLeaveSubmitting(false);
      return;
    }

    if (new Date(leaveForm.start_date) > new Date(leaveForm.end_date)) {
      setLeaveError('Start date must be before or equal to end date.');
      setLeaveSubmitting(false);
      return;
    }

    try {
      const payload = {
        employee: myEmployee.id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason,
      };

      await api.post('/leave/', payload);
      setShowLeaveModal(false);
      setLeaveForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      await queryClient.invalidateQueries({ queryKey: ['self-leaves'] });
      await queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      showToast('✅ Leave request submitted successfully.');
    } catch (err: any) {
      const errorMsg = err.response?.data?.non_field_errors?.[0] || err.response?.data?.error || err.message || 'Failed to submit leave request.';
      setLeaveError(errorMsg);
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!myEmployee?.id) {
      alert('Could not resolve your employee record.');
      return;
    }
    setUpdatingPhone(true);
    try {
      await api.patch(`/employees/${myEmployee.id}/`, { phone: phoneInput });
      await queryClient.invalidateQueries({ queryKey: ['self-employee'] });
      showToast('✅ Phone number updated successfully.');
    } catch (err: any) {
      alert('Failed to update phone number.');
    } finally {
      setUpdatingPhone(false);
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
          <Link
            href="/employee"
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
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
            value: payslipsLoading ? '…' : String((payslips ?? []).filter((p) => p.status === 'paid').length),
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

      {/* Leave Balances Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">
          Leave Balances
        </h2>
        {balanceLoading ? (
          <div className="h-24 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        ) : balance ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Annual', key: 'annual', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
              { name: 'Sick', key: 'sick', bg: 'bg-red-500/10 dark:bg-red-500/20 border-red-500/20', text: 'text-red-700 dark:text-red-400' },
              { name: 'Maternity', key: 'maternity', bg: 'bg-pink-500/10 dark:bg-pink-500/20 border-pink-500/20', text: 'text-pink-700 dark:text-pink-400' },
              { name: 'Paternity', key: 'paternity', bg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
            ].map((item) => {
              const data = balance[item.key] || { total: 0, used: 0, remaining: 0, pending: 0 };
              return (
                <div key={item.key} className={`p-4 rounded-2xl border ${item.bg}`}>
                  <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                    {item.name} Leave
                  </div>
                  <div className={`text-2xl font-black font-outfit mt-1 ${item.text}`}>
                    {data.remaining !== null ? `${data.remaining} / ${data.total}` : 'Unlimited'} <span className="text-xs font-normal text-slate-500">{data.remaining !== null ? 'days left' : ''}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                    <span>Used: {data.used}d</span>
                    {data.pending > 0 && (
                      <span className="text-amber-500 font-bold">Pending: {data.pending}d</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Could not retrieve leave balances.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payslips */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-teal-500" />
            My Payslips
          </h2>
          <GlassCard className="border border-slate-200/60 overflow-hidden rounded-3xl">
            {payslipsLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : (payslips ?? []).filter((p) => p.status === 'paid').length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500 font-medium">No payslips available yet.</div>
                <div className="text-slate-400 text-sm mt-1">
                  Payslips appear after payroll is processed.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(payslips ?? [])
                  .filter((p) => p.status === 'paid')
                  .map((payslip) => (
                    <div
                      key={payslip.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {monthName(payslip.month)} {payslip.year}
                          </div>
                          <div className="text-xs text-slate-500">
                            Net: KES {Number(payslip.net_pay).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleDownload(payslip.id, myEmployee?.name || 'Employee', payslip.month, payslip.year)
                        }
                        disabled={downloadingId === payslip.id}
                        className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 gap-2"
                      >
                        {downloadingId === payslip.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Download className="h-4 w-4" /> PDF</>
                        )}
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Leave history */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
              <Calendar className="h-6 w-6 text-purple-500" />
              My Leave History
            </h2>
            <Button
              onClick={() => setShowLeaveModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 gap-1 text-xs px-3 font-bold"
            >
              <Plus className="h-3.5 w-3.5" /> Request Leave
            </Button>
          </div>
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
                  Submit a leave request from the button above.
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

      {/* Bottom organization / contact details row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Company info card */}
        <GlassCard className="p-6 border border-slate-200/60 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col justify-between h-full">
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

        {/* Personal Details Update Card */}
        <GlassCard className="p-6 border border-slate-200/60 flex flex-col justify-between h-full">
          {employeesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-500 uppercase tracking-widest font-bold">
                Personal Details
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Phone Number</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="+254 700 000 000"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none"
                  />
                  <Button 
                    onClick={handleUpdatePhone}
                    disabled={updatingPhone}
                    className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-105 dark:text-slate-950 text-white font-bold rounded-xl px-4 py-2 text-xs"
                  >
                    {updatingPhone ? 'Saving...' : 'Update'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => !leaveSubmitting && setShowLeaveModal(false)}
          />
          {/* Modal Container */}
          <GlassCard className="relative w-full max-w-lg p-6 border border-slate-200/60 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold font-outfit text-slate-900 dark:text-white mb-4">
              Request Leave
            </h3>
            {leaveError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {leaveError}
              </div>
            )}
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-1">Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-1">Reason (Optional)</label>
                <textarea
                  placeholder="Details about your leave request..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm outline-none resize-none h-24 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  disabled={leaveSubmitting}
                  onClick={() => setShowLeaveModal(false)}
                  className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 rounded-xl h-11 px-4 font-bold border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={leaveSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-11 px-6 font-bold"
                >
                  {leaveSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
