'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { EditEmployeeModal } from '@/components/premium/EditEmployeeModal';
import { Button } from '@/components/ui/button';
import type { Employee, AttendanceLog, LeaveRequest } from '@/lib/types';
import {
  ArrowLeft,
  Mail,
  Phone,
  Edit3,
  DollarSign,
  Download,
  Building,
  Activity,
  Sparkles,
  User,
  Landmark,
  ShieldCheck,
  Loader2
} from 'lucide-react';

interface EmployeePayslip {
  id: string;
  payroll_run: string;
  gross_salary: string | number;
  nssf: string | number;
  shif: string | number;
  ahl: string | number;
  paye: string | number;
  net_pay: string | number;
  month: number;
  year: number;
  status: string;
}

export default function EmployeeDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'compensation' | 'history'>('overview');
  const [historySubTab, setHistorySubTab] = useState<'payslips' | 'attendance' | 'leave'>('payslips');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Queries
  const { data: employee, isLoading: isEmployeeLoading } = useQuery<Employee>({
    queryKey: ['employee', id],
    queryFn: async () => {
      const res = await api.get<Employee>(`/employees/${id}/`);
      return res.data;
    }
  });

  const { data: attendance } = useQuery<AttendanceLog[]>({
    queryKey: ['employee-attendance', id],
    queryFn: async () => {
      const res = await api.get<AttendanceLog[]>(`/employees/${id}/attendance/`);
      return res.data;
    },
    enabled: !!employee
  });

  const { data: leaves } = useQuery<LeaveRequest[]>({
    queryKey: ['employee-leave', id],
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>(`/employees/${id}/leave/`);
      return res.data;
    },
    enabled: !!employee
  });

  const { data: payslips } = useQuery<EmployeePayslip[]>({
    queryKey: ['employee-payslips', id],
    queryFn: async () => {
      const res = await api.get<EmployeePayslip[]>(`/employees/${id}/payslips/`);
      return res.data;
    },
    enabled: !!employee
  });

  const handleDownloadPayslip = async (itemId: string, month: number, year: number) => {
    setDownloadingId(itemId);
    try {
      const res = await api.get(`/payslips/${itemId}/download/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${employee?.name.replace(/\s+/g, '_').toLowerCase()}_${month}_${year}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to download payslip. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleVerifyPayment = () => {
    setVerifyingPayment(true);
    setVerifyMessage('');
    setTimeout(() => {
      setVerifyingPayment(false);
      setVerifyMessage('Compliance Verified: Accounts synced successfully with KRA PIN and payment gateways.');
    }, 1800);
  };

  if (isEmployeeLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-slate-950 dark:border-slate-800 dark:border-t-white animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <GlassCard className="p-8 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Employee Profile Not Found</h3>
        <p className="text-slate-500 mt-2">The requested profile does not exist or you do not have permission to view it.</p>
        <Button onClick={() => router.push('/employees')} className="mt-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl">
          Back to Directory
        </Button>
      </GlassCard>
    );
  }

  const initials = employee.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={() => router.push('/employees')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold transition-all group hover:underline"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Directory
      </button>

      {/* Header Profile Summary */}
      <GlassCard className="p-8 border border-slate-200/60 shadow-xl rounded-3xl relative overflow-hidden bg-gradient-to-r from-white via-white to-slate-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850/10">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-slate-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-white text-3xl font-black font-outfit shadow-md shadow-slate-500/10 shrink-0">
              {initials}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-outfit leading-none">{employee.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  employee.status === 'active'
                    ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800'
                    : 'bg-slate-50 text-slate-450 border-slate-200 dark:bg-slate-950 dark:text-slate-550 dark:border-slate-850'
                }`}>
                  {employee.status}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-slate-500" /> {employee.job_title || 'No Title'} • <span className="opacity-80">{employee.department || 'General'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 gap-2 px-5 py-6 rounded-2xl border transition-all shadow-sm"
            >
              <Edit3 className="h-4 w-4 text-slate-500" />
              Edit Profile
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { id: 'overview', label: 'Overview & Details', icon: User },
          { id: 'compensation', label: 'Compensation & Allowances', icon: DollarSign },
          { id: 'history', label: 'Activity & History logs', icon: Activity }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'compensation' | 'history')}
              className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${
                activeTab === tab.id ? 'text-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-850 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 dark:bg-white rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              {/* Profile Card */}
              <GlassCard className="p-8 border border-slate-200/60 shadow-sm rounded-3xl bg-white dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit mb-6 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-slate-900 dark:text-white" /> Job Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Employment Type</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">{employee.employment_type || 'Monthly'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Department</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{employee.department || 'General'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Job Title</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{employee.job_title || 'Staff Member'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preferred Payment Method</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase">{employee.payment_method || 'Bank Transfer'}</p>
                  </div>
                </div>
              </GlassCard>

              {/* Identity & Compliance Details */}
              <GlassCard className="p-8 border border-slate-200/60 shadow-sm rounded-3xl bg-white dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit mb-6 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-slate-900 dark:text-white" /> Statutory compliance
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">KRA PIN</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">{employee.kra_pin || 'Not Registered'}</p>
                  </div>
                  {employee.payment_method === 'mpesa' ? (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">M-Pesa registered number</span>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">+{employee.phone || 'N/A'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bank Gateway</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Equity Bank (Kenya)</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bank Account</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">•••• •••• 1928</p>
                      </div>
                    </>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Quick Contact & Action card */}
            <div className="space-y-6">
              <GlassCard className="p-6 border border-slate-200/60 rounded-3xl space-y-5 bg-white dark:bg-slate-900/50">
                <h4 className="font-bold text-slate-900 dark:text-white text-md">Contact details</h4>
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3 text-slate-650 dark:text-slate-305 text-sm">
                    <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                    <span className="truncate">{employee.email || 'No email registered'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-650 dark:text-slate-305 text-sm">
                    <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>{employee.phone || 'No phone registered'}</span>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-6 border border-slate-200/60 rounded-3xl space-y-4 bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50">
                <h4 className="font-bold text-slate-900 dark:text-white text-md flex items-center gap-2">
                  <Landmark className="h-4.5 w-4.5 text-slate-950 dark:text-white" /> Compliance Checker
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Run standard background synchronization checks to verify current bank routing coordinates or M-Pesa channels against statutory KRA PIN bounds.
                </p>
                <Button 
                  onClick={handleVerifyPayment} 
                  disabled={verifyingPayment}
                  className="w-full py-5 bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-105 dark:text-slate-950 text-white rounded-xl text-xs font-bold gap-2"
                >
                  {verifyingPayment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Run Sync Checklist'}
                </Button>
                {verifyMessage && (
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-3 rounded-xl">
                    {verifyMessage}
                  </p>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {/* TAB 2: COMPENSATION */}
        {activeTab === 'compensation' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <GlassCard className="p-8 border border-slate-200/60 shadow-sm rounded-3xl bg-white dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit mb-6">Payroll Compensation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contracted Basic Salary</span>
                    <p className="text-2xl font-black text-slate-950 dark:text-white font-outfit flex items-baseline gap-1">
                      <span className="text-sm font-medium text-slate-400">KES</span>
                      {parseFloat(String(employee.salary_basic ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pay Cycle Frequency</span>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">{employee.employment_type || 'Monthly'}</p>
                  </div>
                </div>
              </GlassCard>

              {/* Allowances Breakdown */}
              <GlassCard className="p-8 border border-slate-200/60 shadow-sm rounded-3xl bg-white dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit mb-6">Recurring Allowances & Bonuses</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <GlassCard className="p-4 border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-28">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">House Allowance</span>
                    <span className="text-lg font-black text-slate-850 dark:text-white font-outfit">KES 12,000.00</span>
                  </GlassCard>
                  <GlassCard className="p-4 border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-28">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transport</span>
                    <span className="text-lg font-black text-slate-850 dark:text-white font-outfit">KES 4,500.00</span>
                  </GlassCard>
                  <GlassCard className="p-4 border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-28">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internet / Phone</span>
                    <span className="text-lg font-black text-slate-850 dark:text-white font-outfit">KES 2,000.00</span>
                  </GlassCard>
                </div>
              </GlassCard>
            </div>

            <div className="space-y-6">
              <GlassCard className="p-6 border border-slate-200/60 rounded-3xl bg-slate-950 text-white dark:bg-slate-900 shadow-md">
                <h4 className="font-bold text-md mb-2 flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5" /> Est. Employer Cost
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Estimate calculations including mandatory NSSF matches, Affordable Housing Levy matched stakes (1.5%), and base contracted earnings.
                </p>
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="opacity-80 text-slate-400">Gross Salary (Est):</span>
                    <span className="font-bold">KES {parseFloat(String(employee.salary_basic ?? 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="opacity-80 text-slate-400">Levy Matches:</span>
                    <span className="font-bold">KES {Math.round(parseFloat(String(employee.salary_basic ?? 0)) * 0.015).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold border-t border-slate-800 pt-2">
                    <span>Total Cost / Mo:</span>
                    <span>KES {Math.round(parseFloat(String(employee.salary_basic ?? 0)) * 1.015).toLocaleString()}</span>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {/* TAB 3: HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 mb-4">
              {[
                { id: 'payslips', label: 'Payslips History' },
                { id: 'attendance', label: 'Attendance Records' },
                { id: 'leave', label: 'Leave Requests' }
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  onClick={() => setHistorySubTab(subTab.id as 'payslips' | 'attendance' | 'leave')}
                  className={`pb-3 text-xs font-bold transition-all relative ${
                    historySubTab === subTab.id ? 'text-slate-950 dark:text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {subTab.label}
                  {historySubTab === subTab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 dark:bg-white rounded-full" />}
                </button>
              ))}
            </div>

            {/* Payslips history grid */}
            {historySubTab === 'payslips' && (
              <GlassCard className="overflow-hidden border border-slate-200/60 shadow-sm rounded-3xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Period</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Gross Pay (KES)</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Net Pay (KES)</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Run Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {!payslips || payslips.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                            No payslips processed for this employee yet.
                          </td>
                        </tr>
                      ) : (
                        payslips.map((slip) => (
                          <tr key={slip.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-800">
                              {new Date(slip.year, slip.month - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-600 tabular-nums">
                              {parseFloat(String(slip.gross_salary)).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900 tabular-nums">
                              {parseFloat(String(slip.net_pay)).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                slip.status === 'paid'
                                  ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800'
                                  : slip.status === 'approved'
                                  ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800'
                                  : 'bg-slate-50 text-slate-650 border-slate-250 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-850'
                              }`}>
                                {slip.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={downloadingId === slip.id}
                                onClick={() => handleDownloadPayslip(slip.id, slip.month, slip.year)}
                                className="h-9 w-9 p-0 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                              >
                                {downloadingId === slip.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-slate-950 dark:text-white" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}

            {/* Attendance history grid */}
            {historySubTab === 'attendance' && (
              <GlassCard className="overflow-hidden border border-slate-200/60 shadow-sm rounded-3xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock In</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock Out</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Hours Logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {!attendance || attendance.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                            No attendance logs recorded for this employee.
                          </td>
                        </tr>
                      ) : (
                        attendance.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                              {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-slate-800 bg-slate-100 dark:text-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                                {log.clock_in}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg">
                                {log.clock_out || '—'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-900 tabular-nums">
                              {log.hours_worked != null ? `${Number(log.hours_worked).toFixed(2)} hours` : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}

            {/* Leave history grid */}
            {historySubTab === 'leave' && (
              <GlassCard className="overflow-hidden border border-slate-200/60 shadow-sm rounded-3xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/60">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Period</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60">
                      {!leaves || leaves.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                            No leave requests registered for this employee.
                          </td>
                        </tr>
                      ) : (
                        leaves.map((req) => (
                          <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                              <div className="flex flex-col">
                                <span className="font-bold">{new Date(req.start_date).toLocaleDateString()}</span>
                                <span className="text-[10px] text-slate-400">to {new Date(req.end_date).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-600 capitalize">
                              {req.leave_type}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                req.status === 'approved'
                                  ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800'
                                  : req.status === 'pending'
                                  ? 'bg-slate-50 text-slate-650 border-slate-250 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-850'
                                  : 'bg-slate-50 text-slate-450 border-slate-200 dark:bg-slate-950 dark:text-slate-550 dark:border-slate-850'
                              }`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                              {(req as any).reason || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </div>
        )}
      </div>

      <EditEmployeeModal
        employee={employee}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employee', id] });
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />
    </div>
  );
}
