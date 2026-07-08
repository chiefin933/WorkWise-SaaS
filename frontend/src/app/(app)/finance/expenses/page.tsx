'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/store';
import { financeApi } from '@/lib/api';
import api from '@/lib/api';
import type { ExpenseClaim, Employee } from '@/lib/types';
import {
  Receipt, Plus, Filter, ChevronDown, X, Loader2,
  CheckCircle2, XCircle, DollarSign, AlertCircle,
  FileText, Calendar, Tag, MessageSquare, Eye, Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const CATEGORY_OPTIONS = [
  { value: 'travel',        label: 'Travel & Transport' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'meals',         label: 'Meals & Entertainment' },
  { value: 'office',        label: 'Office Supplies' },
  { value: 'client',        label: 'Client Entertainment' },
  { value: 'utilities',     label: 'Utilities' },
  { value: 'training',      label: 'Training & Development' },
  { value: 'medical',       label: 'Medical' },
  { value: 'other',         label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '',         label: 'All statuses' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid',     label: 'Reimbursed' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:  'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
    paid:     'bg-teal-50 text-teal-700 border-teal-200',
  };
  const labels: Record<string, string> = {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected', paid: 'Reimbursed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${map[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Submit Expense Modal ──────────────────────────────────────────────────────
function SubmitExpenseModal({
  isOpen, onClose, onSuccess, employees,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: Employee[];
}) {
  const { user } = useAuthStore();
  const { toast, container: toastContainer } = useToast();
  const [form, setForm] = useState({
    employee: '', title: '', category: 'other', amount: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'), description: '', receipt_url: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee) { toast('Select an employee.', 'error'); return; }
    if (!form.title.trim()) { toast('Enter a title for this expense.', 'error'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast('Enter a valid amount.', 'error'); return; }
    setLoading(true);
    try {
      await financeApi.createExpense({
        employee: form.employee,
        title: form.title.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        expense_date: form.expense_date,
        description: form.description.trim(),
        receipt_url: form.receipt_url.trim(),
      });
      toast('Expense claim submitted successfully.', 'success');
      setForm({ employee: '', title: '', category: 'other', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), description: '', receipt_url: '' });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e.response?.data?.error || 'Failed to submit expense.', 'error');
    } finally { setLoading(false); }
  }

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {toastContainer}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-50 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Submit Expense Claim</h2>
              <p className="text-xs text-slate-500">Fill in the details of your business expense.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Employee</label>
            <select value={form.employee} onChange={e => set('employee', e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Select employee</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} — {emp.department}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Expense Title</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Client lunch at Java House"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500">
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount (KES)</label>
              <input type="number" min="1" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Expense Date</label>
            <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Provide context for this expense claim..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Receipt URL (optional)</label>
            <input type="url" value={form.receipt_url} onChange={e => set('receipt_url', e.target.value)} placeholder="https://drive.google.com/..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Receipt className="h-4 w-4" /> Submit Claim</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Review Modal (approve/reject) ────────────────────────────────────────────
function ReviewModal({
  claim, action, onClose, onSuccess,
}: {
  claim: ExpenseClaim;
  action: 'approve' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast, container: toastContainer } = useToast();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (action === 'reject' && !comment.trim()) {
      toast('Please provide a reason for rejection.', 'error');
      return;
    }
    setLoading(true);
    try {
      if (action === 'approve') {
        await financeApi.approveExpense(claim.id, comment);
        toast('Expense claim approved.', 'success');
      } else {
        await financeApi.rejectExpense(claim.id, comment);
        toast('Expense claim rejected.', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e.response?.data?.error || 'Action failed.', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {toastContainer}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {action === 'approve'
              ? <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              : <XCircle className="h-6 w-6 text-red-500" />}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
              </h2>
              <p className="text-xs text-slate-500">{claim.title} — KES {Number(claim.amount).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {action === 'reject' ? 'Reason for Rejection *' : 'Comment (optional)'}
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder={action === 'reject' ? 'State why this claim is being rejected...' : 'Add any notes for the employee...'}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-3 rounded-2xl disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 ${action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast, container: toastContainer } = useToast();
  const isFinanceOrAdmin = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [statusFilter, setStatusFilter]   = useState('');
  const [deptFilter,   setDeptFilter]     = useState('');
  const [filterOpen,   setFilterOpen]     = useState(false);
  const [isSubmitOpen, setIsSubmitOpen]   = useState(false);
  const [reviewClaim,  setReviewClaim]    = useState<ExpenseClaim | null>(null);
  const [reviewAction, setReviewAction]   = useState<'approve' | 'reject'>('approve');
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    if (filterOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  const { data: claims = [], isLoading } = useQuery<ExpenseClaim[]>({
    queryKey: ['expenses', statusFilter, deptFilter],
    queryFn: () => financeApi.getExpenses({ status: statusFilter || undefined, department: deptFilter || undefined }),
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
  });

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];

  const markPaid = useMutation({
    mutationFn: (id: string) => financeApi.markExpensePaid(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast('Marked as reimbursed.', 'success'); },
    onError: () => toast('Failed to update status.', 'error'),
  });

  const totalAmount = claims.reduce((s, c) => s + Number(c.amount), 0);
  const pendingCount = claims.filter(c => c.status === 'pending').length;
  const approvedAmount = claims.filter(c => c.status === 'approved').reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-8">
      {toastContainer}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Expense Claims</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {isFinanceOrAdmin ? 'Review and approve employee expense reimbursement requests.' : 'Submit and track your business expense claims.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={filterRef}>
            <Button onClick={() => setFilterOpen(v => !v)}
              className={`gap-2 px-5 py-6 rounded-2xl border transition-all shadow-sm ${
                statusFilter || deptFilter
                  ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}>
              <Filter className="h-4 w-4" /> Filter
              {(statusFilter || deptFilter) && <span className="ml-1 bg-white text-slate-950 dark:bg-slate-950 dark:text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">•</span>}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </Button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none">
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {isFinanceOrAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
                    <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none">
                      <option value="">All departments</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => { setStatusFilter(''); setDeptFilter(''); }} className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Clear</button>
                  <button onClick={() => setFilterOpen(false)} className="px-4 py-2 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-bold">Apply</button>
                </div>
              </div>
            )}
          </div>
          <Button onClick={() => setIsSubmitOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6 py-6 rounded-2xl transition-all shadow-sm font-bold">
            <Plus className="h-5 w-5" /> Submit Claim
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center"><Receipt className="h-6 w-6 text-slate-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{claims.length}</p><p className="text-sm text-slate-500">Total Claims</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center"><AlertCircle className="h-6 w-6 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{pendingCount}</p><p className="text-sm text-slate-500">Pending Review</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><DollarSign className="h-6 w-6 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">KES {approvedAmount.toLocaleString()}</p><p className="text-sm text-slate-500">Approved Amount</p></div>
          </div>
        </GlassCard>
      </div>

      {/* Claims Table */}
      <GlassCard className="overflow-hidden border border-slate-200/60 rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60">
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Expense</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Category</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-6 py-5"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                    ))}
                  </tr>
                ))
              ) : claims.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-500">
                  <Receipt className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">No expense claims found.</p>
                  <p className="text-sm mt-1">Submit a new claim using the button above.</p>
                </td></tr>
              ) : (
                claims.map(claim => (
                  <tr key={claim.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{claim.employee_name}</p>
                      <p className="text-xs text-slate-500">{claim.employee_dept}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-sm text-slate-900 dark:text-white max-w-[180px] truncate">{claim.title}</p>
                      {claim.description && <p className="text-xs text-slate-500 truncate max-w-[180px]">{claim.description}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <Tag className="h-3 w-3" />{claim.category_display}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                        KES {Number(claim.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {format(new Date(claim.expense_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4">{statusBadge(claim.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {claim.receipt_url && (
                          <a href={claim.receipt_url} target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all" title="View Receipt">
                            <Eye className="h-4 w-4" />
                          </a>
                        )}
                        {isFinanceOrAdmin && claim.status === 'pending' && (
                          <>
                            <button onClick={() => { setReviewClaim(claim); setReviewAction('approve'); }}
                              className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" title="Approve">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => { setReviewClaim(claim); setReviewAction('reject'); }}
                              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Reject">
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {isFinanceOrAdmin && claim.status === 'approved' && (
                          <button onClick={() => markPaid.mutate(claim.id)}
                            disabled={markPaid.isPending}
                            className="p-2 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all" title="Mark as Reimbursed">
                            {markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                          </button>
                        )}
                        {claim.review_comment && (
                          <span title={claim.review_comment} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-help">
                            <MessageSquare className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modals */}
      <SubmitExpenseModal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
        employees={employees}
      />
      {reviewClaim && (
        <ReviewModal
          claim={reviewClaim}
          action={reviewAction}
          onClose={() => setReviewClaim(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
        />
      )}
    </div>
  );
}
