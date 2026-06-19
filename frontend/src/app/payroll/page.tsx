'use client';

import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { StatutoryExportButtons } from '@/components/payroll/StatutoryExportButtons';
import { AddPayrollRunModal } from '@/components/premium/AddPayrollRunModal';
import { MpesaDisbursementModal } from '@/components/premium/MpesaDisbursementModal';
import { BankExportModal } from '@/components/premium/BankExportModal';
import { useAuthStore } from '@/lib/store';
import type { PayrollRun, PayrollSummary, PayrollItem } from '@/lib/types';
import { formatKES, monthLabel } from '@/lib/format';
import Link from 'next/link';
import {
  CreditCard,
  Calendar,
  TrendingUp,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  History,
  Play,
  Download,
  Loader2,
  CheckCircle,
  BadgeDollarSign,
  Mail,
  CheckCheck,
  Smartphone,
  Building2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PayrollPage() {
  const user = useAuthStore((state) => state.user);
  const isGrowthPlus = ['GROWTH', 'BUSINESS', 'ENTERPRISE'].includes(user?.plan ?? '');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedDisburseRun, setSelectedDisburseRun] = useState<PayrollRun | null>(null);
  const [selectedBankExportRun, setSelectedBankExportRun] = useState<PayrollRun | null>(null);
  const [sendPayslipsConfirm, setSendPayslipsConfirm] = useState<PayrollRun | null>(null);
  const queryClient = useQueryClient();

  const now = new Date();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const invalidatePayroll = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-run-detail'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
  };

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: payrollRuns, isLoading } = useQuery<PayrollRun[]>({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const res = await api.get<PayrollRun[]>('/payroll/');
      return res.data;
    }
  });

  const { data: expandedRunDetail, isLoading: isRunDetailLoading } = useQuery<PayrollRun>({
    queryKey: ['payroll-run-detail', expandedRunId],
    enabled: !!expandedRunId,
    queryFn: async () => {
      const res = await api.get<PayrollRun>(`/payroll/${expandedRunId}/`);
      return res.data;
    },
  });

  const { data: summary } = useQuery<PayrollSummary>({
    queryKey: ['payroll-summary', now.getMonth() + 1, now.getFullYear()],
    queryFn: async () => {
      const res = await api.get<PayrollSummary>('/payroll/summary/', {
        params: { month: now.getMonth() + 1, year: now.getFullYear() },
      });
      return res.data;
    },
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleProcess = async (id: string) => {
    setProcessingId(id);
    try {
      await api.post(`/payroll/${id}/process/`);
      invalidatePayroll();
      showToast('Payroll processed successfully.');
    } catch {
      showToast('Processing failed. Ensure payroll settings are configured.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await api.post(`/payroll/${id}/approve/`);
      invalidatePayroll();
      showToast('Payroll run approved.');
    } catch {
      showToast('Could not approve payroll run.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setMarkingPaidId(id);
    try {
      await api.post(`/payroll/${id}/mark-paid/`);
      invalidatePayroll();
      showToast('Payroll run marked as paid. 🎉');
    } catch {
      showToast('Could not mark as paid.', 'error');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleSendPayslips = async (id: string) => {
    setEmailingId(id);
    try {
      const res = await api.post<{ sent: number; failed: { employee: string }[] }>(`/payroll/${id}/send-payslips/`);
      const { sent, failed } = res.data;
      if (failed.length > 0) {
        showToast(`Sent ${sent} payslip(s). ${failed.length} failed (no email on file).`, 'error');
      } else {
        showToast(`✉️ ${sent} payslip(s) emailed to employees successfully.`);
      }
    } catch {
      showToast('Failed to send payslips.', 'error');
    } finally {
      setEmailingId(null);
    }
  };

  const handleDownloadPayslip = async (itemId: string, employeeName: string) => {
    setDownloadingItemId(itemId);
    try {
      const response = await api.get(`/payslips/${itemId}/download/`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${employeeName.toLowerCase().replace(/ /g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('Could not download payslip.', 'error');
    } finally {
      setDownloadingItemId(null);
    }
  };

  const getMonthName = (month: number) =>
    new Date(2000, month - 1).toLocaleString('default', { month: 'long' });

  // ── Status badge ──────────────────────────────────────────────────────────

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      paid:      'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      approved:  'bg-teal-500/10 text-teal-600 border border-teal-500/20',
      processed: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
      draft:     'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    };
    return map[s] ?? 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="space-y-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 transition-all animate-in slide-in-from-bottom-4 ${
          toast.type === 'success'
            ? 'bg-teal-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCheck className="h-5 w-5" /> : null}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Payroll Engine</h1>
          <p className="text-slate-500 dark:text-slate-400">Automated compliant payroll processing and payslips for Kenya.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6 py-6 rounded-2xl transition-all shadow-sm"
          >
            <Plus className="h-5 w-5" /> New Payroll Run
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60 bg-gradient-to-br from-teal-600 to-teal-700 text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-lg backdrop-blur-md uppercase tracking-widest">
                {summary ? monthLabel(summary.month, summary.year) : monthLabel(now.getMonth() + 1, now.getFullYear())}
              </span>
            </div>
            <div className="text-sm text-teal-100 uppercase tracking-widest font-semibold mb-1">Total Net Payable</div>
            <div className="text-3xl font-bold font-outfit tabular-nums">{formatKES(summary?.total_net)}</div>
            <div className="flex items-center gap-2 mt-4 text-xs text-teal-200 font-medium">
              <ArrowUpRight className="h-4 w-4" />
              {summary?.change_pct != null && summary.change_pct !== 0
                ? `${summary.change_pct > 0 ? '+' : ''}${summary.change_pct}% vs last month`
                : summary?.has_run ? `${summary.employee_count} employees processed` : 'Create a payroll run to begin'}
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-white/5 rounded-full blur-2xl" />
        </GlassCard>

        <GlassCard className="p-6 border border-slate-200/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Tax Compliance</div>
              <div className="text-xs text-emerald-600 font-bold">SECURE & COMPLIANT</div>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{formatKES(summary?.total_statutory)}</div>
            <div className="text-sm text-slate-500">Statutory Deductions (NSSF, SHIF, AHL, PAYE)</div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border border-slate-200/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Run Status</div>
              <div className="text-xs text-teal-600 font-bold uppercase">{summary?.status || 'No run yet'}</div>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{summary?.employee_count ?? 0}</div>
            <div className="text-sm text-slate-500">Employees in current run</div>
          </div>
        </GlassCard>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-3">
              <History className="h-6 w-6 text-teal-500" />
              Payroll History
            </h2>
          </div>

          <GlassCard className="overflow-hidden border border-slate-200/60 rounded-3xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Period</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Employees</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total Net</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-6 py-8"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : payrollRuns?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                        No payroll runs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payrollRuns?.map((run) => (
                      <Fragment key={run.id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <FileText className="h-5 w-5" />
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {getMonthName(run.month)} {run.year}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400 font-semibold">
                            {run.item_count} Employees
                          </td>
                          <td className="px-6 py-5 text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            Ksh {run.total_net.toLocaleString()}
                          </td>
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusBadge(run.status)}`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end gap-2">
                              {/* Draft → Process */}
                              {run.status === 'draft' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleProcess(run.id)}
                                  disabled={processingId === run.id}
                                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl h-10 px-4"
                                >
                                  {processingId === run.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <><Play className="h-4 w-4" /> Run</>}
                                </Button>
                              )}

                              {/* Processed → Approve */}
                              {run.status === 'processed' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(run.id)}
                                    disabled={approvingId === run.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl h-10 px-3"
                                  >
                                    {approvingId === run.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <><CheckCircle className="h-4 w-4" /> Approve</>}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSendPayslipsConfirm(run)}
                                    disabled={emailingId !== null}
                                    title="Email payslips to all employees"
                                    className="rounded-xl h-10 w-10 p-0 text-teal-600 hover:bg-teal-50"
                                  >
                                    {emailingId === run.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Mail className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                                    className="h-10 w-10 p-0 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-500/10 text-teal-600"
                                  >
                                    {expandedRunId === run.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                  </Button>
                                </>
                              )}

                              {/* Approved → Mark Paid */}
                              {run.status === 'approved' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedDisburseRun(run)}
                                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white gap-1.5 rounded-xl h-10 px-3 shadow-sm"
                                  >
                                    <Smartphone className="h-4 w-4" /> Disburse M-Pesa
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedBankExportRun(run)}
                                    className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5 rounded-xl h-10 px-3 shadow-sm relative group"
                                  >
                                    {isGrowthPlus ? (
                                      <Building2 className="h-4 w-4" />
                                    ) : (
                                      <Lock className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                                    )}
                                    Bank Export
                                    {!isGrowthPlus && (
                                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-bold text-[9px] px-1 py-0.5 rounded-full leading-none scale-90">
                                        Growth+
                                      </span>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkPaid(run.id)}
                                    disabled={markingPaidId === run.id}
                                    className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 rounded-xl h-10 px-3"
                                  >
                                    {markingPaidId === run.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <><BadgeDollarSign className="h-4 w-4" /> Mark Paid</>}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSendPayslipsConfirm(run)}
                                    disabled={emailingId !== null}
                                    title="Email payslips to all employees"
                                    className="rounded-xl h-10 w-10 p-0 text-teal-600 hover:bg-teal-50"
                                  >
                                    {emailingId === run.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Mail className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                                    className="h-10 w-10 p-0 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-500/10 text-teal-600"
                                  >
                                    {expandedRunId === run.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                  </Button>
                                </>
                              )}

                              {/* Paid — locked, expand only */}
                              {run.status === 'paid' && (
                                <>
                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                    ✓ Paid
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSendPayslipsConfirm(run)}
                                    disabled={emailingId !== null}
                                    title="Re-send payslips"
                                    className="rounded-xl h-10 w-10 p-0 text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                                  >
                                    {emailingId === run.id
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Mail className="h-4 w-4" />}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                                    className="h-10 w-10 p-0 rounded-xl hover:bg-teal-50 text-teal-600"
                                  >
                                    {expandedRunId === run.id ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded employee breakdown */}
                        {expandedRunId === run.id && (
                          <tr className="bg-slate-50/30">
                            <td colSpan={5} className="px-6 py-4">
                              <div className="p-4 border border-slate-200/50 rounded-2xl space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold text-slate-800">Employee Payslip Breakdown</h4>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSendPayslipsConfirm(run)}
                                    disabled={emailingId !== null}
                                    className="text-teal-600 hover:text-teal-700 h-8 rounded-lg gap-1.5 px-3 text-xs font-bold"
                                  >
                                    {emailingId === run.id
                                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</>
                                      : <><Mail className="h-3.5 w-3.5" /> Email All Payslips</>}
                                  </Button>
                                </div>
                                {isRunDetailLoading ? (
                                  <div className="space-y-2">
                                    {[...Array(3)].map((_, i) => (
                                      <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
                                    ))}
                                  </div>
                                ) : (expandedRunDetail?.items ?? []).length === 0 ? (
                                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                                    No payroll items found for this run.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="pb-2 font-semibold text-slate-600 dark:text-slate-300">Employee</th>
                                        <th className="pb-2 font-semibold text-slate-600 dark:text-slate-300">Gross</th>
                                        <th className="pb-2 font-semibold text-slate-600 dark:text-slate-300">PAYE</th>
                                        <th className="pb-2 font-semibold text-slate-600 dark:text-slate-300">NSSF+SHIF+AHL</th>
                                        <th className="pb-2 font-semibold text-slate-600 dark:text-slate-300">Net Take-Home</th>
                                        <th className="pb-2 font-semibold text-slate-600 dark:text-slate-300 text-right">Payslip</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(expandedRunDetail?.items ?? []).map((item: PayrollItem) => {
                                        const statutorySum = Number(item.nssf) + Number(item.shif) + Number(item.ahl);
                                        return (
                                          <tr key={item.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-700/30">
                                            <td className="py-2.5 font-bold text-slate-800 dark:text-slate-100">{item.employee_name}</td>
                                            <td className="py-2.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">Ksh {Number(item.gross_salary).toLocaleString()}</td>
                                            <td className="py-2.5 text-slate-700 dark:text-slate-200 tabular-nums">Ksh {Number(item.paye).toLocaleString()}</td>
                                            <td className="py-2.5 text-slate-700 dark:text-slate-200 tabular-nums">Ksh {statutorySum.toLocaleString()}</td>
                                            <td className="py-2.5 font-bold text-teal-600 dark:text-teal-400 tabular-nums">Ksh {Number(item.net_pay).toLocaleString()}</td>
                                            <td className="py-2.5 text-right">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDownloadPayslip(item.id, item.employee_name)}
                                                disabled={downloadingItemId === item.id}
                                                className="text-teal-600 hover:text-teal-700 h-8 rounded-lg gap-1 px-2.5"
                                              >
                                                {downloadingItemId === item.id
                                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                  : <><Download className="h-3.5 w-3.5" /> PDF</>}
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  </div>
                                )}

                                {/* Statutory CSV exports — Growth plan and above, processed/approved/paid only */}
                                {['processed', 'approved', 'paid'].includes(run.status) && (
                                  <StatutoryExportButtons payrollRunId={run.id.toString()} />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">Quick Actions</h2>
          <GlassCard className="p-6 border border-slate-200/60 divide-y divide-slate-100 dark:divide-slate-800">
            <Link href="/reports" className="flex items-center justify-between w-full py-4 first:pt-0 group">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Bank Export</div>
                  <div className="text-xs text-slate-500">Download bulk payment files</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/reports" className="flex items-center justify-between w-full py-4 group">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">P9 Forms</div>
                  <div className="text-xs text-slate-500">Generate annual tax forms</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/reports" className="flex items-center justify-between w-full py-4 last:pb-0 group">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Statutory Logs</div>
                  <div className="text-xs text-slate-500">NSSF & SHIF reports</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </GlassCard>

          <GlassCard className="p-6 border border-slate-200/60 bg-slate-900 text-white">
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              Payroll Lifecycle
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /> Draft — created, not yet run</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" /> Processed — calculations done</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" /> Approved — manager sign-off</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> Paid — disbursed to employees</div>
            </div>
          </GlassCard>
        </div>
      </div>

      <AddPayrollRunModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          invalidatePayroll();
        }}
      />

      <MpesaDisbursementModal
        isOpen={!!selectedDisburseRun}
        onClose={() => setSelectedDisburseRun(null)}
        run={selectedDisburseRun}
        onSuccess={() => {
          invalidatePayroll();
        }}
      />

      <BankExportModal
        isOpen={!!selectedBankExportRun}
        onClose={() => setSelectedBankExportRun(null)}
        run={selectedBankExportRun}
        isPlanLocked={!isGrowthPlus}
        currentPlan={user?.plan ?? 'STARTER'}
      />

      {/* Email Payslips Confirmation Modal */}
      {sendPayslipsConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => !emailingId && setSendPayslipsConfirm(null)}
          />
          {/* Modal Container */}
          <GlassCard className="relative w-full max-w-md p-6 border border-slate-200/60 animate-in zoom-in-95 duration-200 space-y-4">
            <h3 className="text-xl font-bold font-outfit text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="h-6 w-6 text-teal-500" />
              Confirm Email Delivery
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You are about to email payslips to <span className="font-bold text-slate-900 dark:text-white">{sendPayslipsConfirm.item_count}</span> employees for <span className="font-bold text-slate-900 dark:text-white">{getMonthName(sendPayslipsConfirm.month)} {sendPayslipsConfirm.year}</span>.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl font-medium">
              ⚠️ Note: This action will send emails directly to all employees with an email on file. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                disabled={emailingId !== null}
                onClick={() => setSendPayslipsConfirm(null)}
                className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 rounded-xl h-11 px-4 font-bold border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={emailingId !== null}
                onClick={async () => {
                  const runId = sendPayslipsConfirm.id;
                  await handleSendPayslips(runId);
                  setSendPayslipsConfirm(null);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-11 px-6 font-bold flex items-center gap-2"
              >
                {emailingId !== null ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Confirm & Send'
                )}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
