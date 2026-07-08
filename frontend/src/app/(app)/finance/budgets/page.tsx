'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useToast } from '@/components/ui/toast';
import { financeApi } from '@/lib/api';
import api from '@/lib/api';
import type { DepartmentBudget, BudgetUtilization, Employee } from '@/lib/types';
import { PiggyBank, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, AlertCircle, Loader2, X, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function BudgetModal({
  budget, departments, month, year, onClose, onSuccess,
}: {
  budget?: DepartmentBudget;
  departments: string[];
  month: number;
  year: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast, container: toastContainer } = useToast();
  const [form, setForm] = useState({
    department:   budget?.department ?? '',
    period_month: budget?.period_month ?? month,
    period_year:  budget?.period_year ?? year,
    budget_amount: budget?.budget_amount?.toString() ?? '',
    notes:        budget?.notes ?? '',
  });
  const [loading, setLoading] = useState(false);

  const [customDept, setCustomDept] = useState('');

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  // Effective department value — use custom input when __custom__ is selected
  const effectiveDept = form.department === '__custom__' ? customDept.trim() : form.department.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const deptToSubmit = form.department === '__custom__' ? customDept.trim() : form.department.trim();
    if (!deptToSubmit) { toast('Select or enter a department.', 'error'); return; }
    if (!form.budget_amount || Number(form.budget_amount) <= 0) { toast('Enter a valid budget amount.', 'error'); return; }
    setLoading(true);
    try {
      if (budget) {
        await financeApi.updateBudget(budget.id, { budget_amount: Number(form.budget_amount), notes: form.notes });
        toast('Budget updated.', 'success');
      } else {
        await financeApi.createBudget({
          department:   deptToSubmit,
          period_month: Number(form.period_month),
          period_year:  Number(form.period_year),
          budget_amount: Number(form.budget_amount),
          notes:        form.notes.trim(),
        });
        toast('Budget set successfully.', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; non_field_errors?: string[] } } };
      toast(e.response?.data?.non_field_errors?.[0] || e.response?.data?.error || 'Failed to save budget.', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {toastContainer}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-50 flex items-center justify-center"><PiggyBank className="h-5 w-5 text-teal-600" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{budget ? 'Edit Budget' : 'Set Department Budget'}</h2>
              <p className="text-xs text-slate-500">Allocate monthly budget for a department.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department</label>
            {!budget && (
              <select value={form.department} onChange={e => set('department', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                <option value="__custom__">+ Add custom department</option>
              </select>
            )}
            {form.department === '__custom__' && (
              <input
                type="text"
                placeholder="Enter department name"
                value={customDept}
                onChange={e => setCustomDept(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 mt-2"
              />
            )}
            {budget && <input type="text" value={form.department} disabled className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm" />}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Month</label>
              <select value={form.period_month} onChange={e => set('period_month', e.target.value)} disabled={!!budget}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60">
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Year</label>
              <input type="number" value={form.period_year} onChange={e => set('period_year', e.target.value)} disabled={!!budget} min={2020} max={2035}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Budget Amount (KES)</label>
            <input type="number" min="1" step="0.01" value={form.budget_amount} onChange={e => set('budget_amount', e.target.value)} placeholder="e.g. 500000"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any notes about this budget allocation..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : budget ? 'Update Budget' : 'Set Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const { toast, container: toastContainer } = useToast();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<DepartmentBudget | undefined>();

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() {
    const isCurrent = month === today.getMonth() + 1 && year === today.getFullYear();
    if (isCurrent) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }
  const isCurrent = month === today.getMonth() + 1 && year === today.getFullYear();

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<DepartmentBudget[]>({
    queryKey: ['budgets', month, year],
    queryFn: () => financeApi.getBudgets({ month, year }),
  });

  const { data: utilization, isLoading: utilLoading } = useQuery<{ month: number; year: number; departments: BudgetUtilization[] }>({
    queryKey: ['budget-utilization', month, year],
    queryFn: () => financeApi.getBudgetUtilization({ month, year }),
    refetchInterval: 60000,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
  });
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];

  const deleteBudget = useMutation({
    mutationFn: (id: string) => financeApi.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budget-utilization'] });
      toast('Budget removed.', 'success');
    },
    onError: () => toast('Could not delete budget.', 'error'),
  });

  const totalBudget = budgets.reduce((s, b) => s + Number(b.budget_amount), 0);
  const deptMap = new Map(utilization?.departments.map(d => [d.department, d]) ?? []);

  return (
    <div className="space-y-8">
      {toastContainer}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Department Budgets</h1>
          <p className="text-slate-500 dark:text-slate-400">Set monthly budgets per department and track actual spend in real time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-sm">
            <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4 text-slate-500" /></button>
            <span className="text-sm font-bold text-slate-900 dark:text-white w-28 text-center">{MONTHS[month-1]} {year}</span>
            <button onClick={nextMonth} disabled={isCurrent} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="h-4 w-4 text-slate-500" /></button>
          </div>
          <Button onClick={() => { setEditBudget(undefined); setIsModalOpen(true); }}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6 py-6 rounded-2xl font-bold shadow-sm">
            <Plus className="h-5 w-5" /> Set Budget
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center"><PiggyBank className="h-6 w-6 text-teal-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{budgets.length}</p><p className="text-sm text-slate-500">Departments Budgeted</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><TrendingUp className="h-6 w-6 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">KES {totalBudget.toLocaleString()}</p><p className="text-sm text-slate-500">Total Budget Allocated</p></div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center"><AlertCircle className="h-6 w-6 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">
                {utilization?.departments.filter(d => d.over_budget).length ?? 0}
              </p>
              <p className="text-sm text-slate-500">Departments Over Budget</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Budget Utilization Table */}
      <GlassCard className="overflow-hidden border border-slate-200/60 rounded-3xl">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Budget vs Actual Spend — {MONTHS[month-1]} {year}</h3>
          <span className="text-xs text-slate-500">Includes payroll + approved expenses</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Budget</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Payroll</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Expenses</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Actual</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Utilization</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {(budgetsLoading || utilLoading) ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-6 py-4"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg" /></td>)}
                  </tr>
                ))
              ) : budgets.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center">
                  <PiggyBank className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-500 font-medium">No budgets set for {MONTHS[month-1]} {year}.</p>
                  <p className="text-sm text-slate-400 mt-1">Click "Set Budget" to allocate budgets for each department.</p>
                </td></tr>
              ) : (
                budgets.map(budget => {
                  const util = deptMap.get(budget.department);
                  const pct = util?.utilization_pct ?? 0;
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500';
                  return (
                    <tr key={budget.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">{budget.department}</p>
                        {budget.notes && <p className="text-xs text-slate-500 truncate max-w-[150px]">{budget.notes}</p>}
                      </td>
                      <td className="px-6 py-4 font-bold text-sm text-slate-900 dark:text-white tabular-nums">KES {Number(budget.budget_amount).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 tabular-nums">KES {(util?.payroll_cost ?? 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 tabular-nums">KES {(util?.expense_cost ?? 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-sm tabular-nums ${util?.over_budget ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                          KES {(util?.actual_spend ?? 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-bold tabular-nums ${util?.over_budget ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>{pct}%</span>
                          {util?.over_budget && <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditBudget(budget); setIsModalOpen(true); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all" title="Edit budget">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteBudget.mutate(budget.id)}
                            disabled={deleteBudget.isPending}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Remove budget">
                            {deleteBudget.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {isModalOpen && (
        <BudgetModal
          budget={editBudget}
          departments={departments}
          month={month}
          year={year}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); queryClient.invalidateQueries({ queryKey: ['budget-utilization'] }); }}
        />
      )}
    </div>
  );
}
