'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard } from '@/components/premium/GlassCard';
import {
  BarChart3,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  TrendingUp,
  PieChart,
  Download,
  Search,
  ChevronRight,
  Loader2,
  ArrowRight,
  Receipt,
  Landmark,
  HeartPulse,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { DashboardStats } from '@/lib/types';
import { BarChart, DonutChart } from '@/components/premium/CustomCharts';

const reportCategories = [
  {
    title: 'Financial Reports',
    reports: [
      { id: 'payroll_summary', name: 'Payroll Summary', icon: PieChart, description: 'Total cost to company and net pay analysis.' },
      { id: 'statutory_returns', name: 'Statutory Returns', icon: ShieldCheck, description: 'NHIF, NSSF and PAYE compliance files.' },
      { id: 'expense_tracking', name: 'Expense Tracking', icon: TrendingUp, description: 'Reimbursements and allowances breakdown.' }
    ]
  },
  {
    title: 'Workforce Analytics',
    reports: [
      { id: 'attendance_matrix', name: 'Attendance Matrix', icon: BarChart3, description: 'Punctuality and shift coverage reports.' },
      { id: 'employee_turnover', name: 'Employee Turnover', icon: Users, description: 'Hiring trends and attrition analysis.' },
      { id: 'leave_utilization', name: 'Leave Utilization', icon: FileSpreadsheet, description: 'Leave balances and popular time-off periods.' }
    ]
  }
];

const P9_YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
const CURRENT_MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];
const SUPPORTED_REPORT_RANGES = new Set([
  'last_30_days',
  'current_quarter',
  'last_12_months',
  'all_time',
]);

// Statutory filing cards config
const statutoryForms = [
  {
    id: 'p10',
    name: 'P10 Monthly PAYE Return',
    icon: FileText,
    description: 'KRA iTax P10 upload-ready CSV. One row per employee with full PAYE breakdown — required for monthly PAYE remittance.',
    endpoint: '/reports/p10-monthly/',
    filePrefix: 'p10_paye',
    badge: 'iTax Upload',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'nssf',
    name: 'NSSF Remittance Schedule',
    icon: Landmark,
    description: 'Employee & employer NSSF contributions schedule per employee for the selected month. Submit to NSSF portal.',
    endpoint: '/reports/nssf-schedule/',
    filePrefix: 'nssf_schedule',
    badge: 'NSSF Portal',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'shif',
    name: 'SHIF / AHL Deduction Schedule',
    icon: HeartPulse,
    description: 'Social Health Insurance Fund (SHIF 2.75%) and Affordable Housing Levy (AHL 1.5%) deductions per employee.',
    endpoint: '/reports/shif-schedule/',
    filePrefix: 'shif_schedule',
    badge: 'SHA Portal',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

export default function ReportsPage() {
  const today = new Date();
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState('payroll_summary');
  const [selectedRange, setSelectedRange] = useState('last_30_days');
  const [p9Year, setP9Year] = useState(today.getFullYear());
  const [p9Loading, setP9Loading] = useState(false);

  // Statutory filing pickers — shared month/year across all three forms
  const [statMonth, setStatMonth] = useState(today.getMonth() + 1);
  const [statYear, setStatYear] = useState(today.getFullYear());
  const [statLoading, setStatLoading] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/dashboard/stats/');
      return res.data;
    },
  });

  const handleDownload = async (reportId: string) => {
    if (!SUPPORTED_REPORT_RANGES.has(selectedRange)) {
      alert('Unsupported report range selected.');
      return;
    }

    setLoadingReport(reportId);
    try {
      const response = await api.post('/reports/generate/', {
        type: reportId,
        range: selectedRange
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download report:', err);
      alert('Failed to generate report. Please ensure data exists for this category.');
    } finally {
      setLoadingReport(null);
    }
  };

  const handleP9Download = async () => {
    setP9Loading(true);
    try {
      const response = await api.get('/reports/p9/', {
        params: { year: p9Year },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `p9_annual_${p9Year}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to generate P9 form. Ensure payroll data exists for this year.');
    } finally {
      setP9Loading(false);
    }
  };

  const handleStatutoryDownload = async (form: typeof statutoryForms[0]) => {
    setStatLoading(form.id);
    try {
      const response = await api.get(form.endpoint, {
        params: { month: statMonth, year: statYear },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${form.filePrefix}_${statYear}_${String(statMonth).padStart(2, '0')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert(`Failed to generate ${form.name}. Ensure payroll has been processed for ${CURRENT_MONTHS[statMonth - 1].label} ${statYear}.`);
    } finally {
      setStatLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Analytics &amp; Reports</h1>
          <p className="text-slate-500 dark:text-slate-400">Data-driven insights to help you manage your organization better.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search reports..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 text-sm outline-none focus:ring-2 focus:ring-slate-950 dark:focus:ring-white transition-all"
          />
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Departmental Allocation Bar Chart */}
          <GlassCard className="lg:col-span-2 p-8 border border-slate-200/60 shadow-xl rounded-3xl">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Department Payroll Expenses</h3>
              <p className="text-sm text-slate-500">Distribution of basic contracted salaries + allowances by department</p>
            </div>
            <div className="pt-2">
              <BarChart
                data={stats?.department_costs || []}
                xKey="department"
                yKey="cost"
              />
            </div>
          </GlassCard>

          {/* Leave Utilization Donut Chart */}
          <GlassCard className="p-8 border border-slate-200/60 shadow-xl rounded-3xl flex flex-col">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Leave Allocation</h3>
              <p className="text-sm text-slate-500">Approved leave days distribution for the current year</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <DonutChart
                data={stats?.leave_distribution || []}
                nameKey="leave_type"
                valueKey="days"
              />
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Statutory Filing Section ─────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit px-2 border-l-4 border-slate-900 dark:border-white ml-2 pl-3">
            Statutory Filing &amp; Compliance
          </h2>
          {/* Shared month / year picker */}
          <div className="flex items-center gap-3 ml-4 sm:ml-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Period:</span>
            <select
              value={statMonth}
              onChange={(e) => setStatMonth(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-slate-950"
            >
              {CURRENT_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={statYear}
              onChange={(e) => setStatYear(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-slate-950"
            >
              {P9_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statutoryForms.map((form) => {
            const Icon = form.icon;
            const isLoading = statLoading === form.id;
            return (
              <GlassCard
                key={form.id}
                className="p-6 border border-slate-200/60 h-full flex flex-col group relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-5 relative z-10">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm shrink-0">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${form.badgeColor} uppercase tracking-wider`}>
                    {form.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 relative z-10">{form.name}</h3>
                <p className="text-sm text-slate-500 mb-6 flex-1 relative z-10 leading-relaxed">{form.description}</p>
                <Button
                  onClick={() => handleStatutoryDownload(form)}
                  disabled={isLoading}
                  className="w-full bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white gap-2 rounded-xl py-2.5 h-auto font-bold shadow-sm relative z-10 transition-all"
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Download className="h-4 w-4" /> Download CSV</>
                  )}
                </Button>
                <div className="absolute -bottom-10 -right-10 h-24 w-24 bg-slate-500/5 rounded-full blur-2xl group-hover:bg-slate-500/10 transition-colors" />
              </GlassCard>
            );
          })}
        </div>

        {/* Period info callout */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            All statutory exports are generated from <strong>processed, approved, or paid</strong> payroll runs only.
            Processing payroll first ensures accurate filing data.
          </span>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-12">
        {reportCategories.map((category, idx) => (
          <div key={idx} className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit px-2 border-l-4 border-slate-900 dark:border-white ml-2 pl-3">
              {category.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.reports.map((report, rIdx) => (
                <div key={rIdx}>
                  <GlassCard className="p-6 border border-slate-200/60 h-full flex flex-col group relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-transform shadow-sm">
                        <report.icon className="h-6 w-6" />
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => handleDownload(report.id)}
                        disabled={loadingReport === report.id}
                        className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white transition-all"
                      >
                        {loadingReport === report.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 relative z-10">{report.name}</h3>
                    <p className="text-sm text-slate-500 mb-6 flex-1 relative z-10">{report.description}</p>
                    <button
                      onClick={() => handleDownload(report.id)}
                      disabled={loadingReport === report.id}
                      className="flex items-center text-slate-950 dark:text-white font-bold text-sm hover:underline transition-all relative z-10 disabled:opacity-50"
                    >
                      {loadingReport === report.id ? 'Generating...' : (
                        <>Generate Report <ChevronRight className="h-4 w-4" /></>
                      )}
                    </button>
                    <div className="absolute -bottom-10 -right-10 h-24 w-24 bg-slate-500/5 rounded-full blur-2xl group-hover:bg-slate-500/10 transition-colors" />
                  </GlassCard>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* P9 Annual Tax Form Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit px-2 border-l-4 border-slate-900 dark:border-white ml-2 pl-3">
          KRA Compliance Forms
        </h2>
        <GlassCard className="p-6 border border-slate-200/60 flex flex-col md:flex-row md:items-center gap-6">
          <div className="h-14 w-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-250 shrink-0 shadow-sm">
            <Receipt className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">P9 Annual Tax Deduction Card</h3>
            <p className="text-sm text-slate-500">
              Official KRA P9 form with monthly PAYE breakdown per employee. Submit to KRA via iTax.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={p9Year}
              onChange={(e) => setP9Year(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-950 dark:focus:ring-white"
            >
              {P9_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button
              onClick={handleP9Download}
              disabled={p9Loading}
              className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-105 dark:text-slate-950 text-white gap-2 rounded-xl px-5 py-2.5 h-auto font-bold shadow-sm"
            >
              {p9Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {p9Loading ? 'Generating...' : 'Download P9'}
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* Export Section */}
      <GlassCard className="p-8 border border-slate-200/60 bg-slate-900 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-md">
            <h3 className="text-2xl font-bold mb-3 font-outfit">Custom Data Export</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Need a specific data format? Use our advanced builder to filter, sort, and export custom CSV or Excel files from any module including payroll, attendance, and employee demographics.
            </p>
          </div>
          <Button
            onClick={() => setIsBuilderOpen(true)}
            className="bg-white hover:bg-slate-100 text-slate-950 gap-2 px-10 py-7 rounded-2xl transition-all shadow-sm font-bold text-lg group"
          >
            Open Builder <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
          </Button>
        </div>
        <div className="absolute top-0 right-0 h-full w-2/3 bg-gradient-to-l from-slate-500/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 bg-slate-600/10 rounded-full blur-3xl" />
      </GlassCard>

      {/* Report Builder Modal */}
      <AnimatePresence>
        {isBuilderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl"
            >
              <GlassCard className="p-10 border border-slate-200/80 shadow-2xl relative overflow-hidden bg-white">
                <div className="relative z-10 bg-white">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4 font-outfit">Advanced Report Builder</h2>
                  <p className="text-slate-500 mb-8">Configure your custom export parameters below.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Data Source</label>
                      <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-950"
                      >
                        <option value="payroll_summary">Payroll Records</option>
                        <option value="employee_turnover">Employee Master Data</option>
                        <option value="leave_utilization">Leave Applications</option>
                        <option value="attendance_matrix">Attendance Logs</option>
                        <option value="statutory_returns">Statutory Returns</option>
                        <option value="expense_tracking">Expense Tracking</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Date Range</label>
                      <select
                        value={selectedRange}
                        onChange={(e) => setSelectedRange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-950"
                      >
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="current_quarter">Current Quarter</option>
                        <option value="last_12_months">Last 12 Months</option>
                        <option value="all_time">All Time</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="ghost"
                      className="flex-1 text-slate-600 hover:bg-slate-105 h-14 rounded-xl font-bold"
                      onClick={() => setIsBuilderOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-slate-950 hover:bg-slate-900 text-white h-14 rounded-xl font-bold"
                      onClick={() => {
                        handleDownload(selectedSource);
                        setIsBuilderOpen(false);
                      }}
                      disabled={loadingReport !== null}
                    >
                      {loadingReport ? 'Generating...' : 'Export Custom Data'}
                    </Button>
                  </div>
                </div>
                <div className="absolute top-0 left-0 w-full h-2 bg-slate-950 dark:bg-white" />
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
