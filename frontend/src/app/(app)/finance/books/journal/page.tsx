'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import {
  FileText, Plus, X, Loader2, CheckCircle2,
  RotateCcw, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Account { id: string; code: string; name: string; account_type: string; }
interface JournalLine { account: string; account_code: string; account_name: string; side: 'DEBIT' | 'CREDIT'; amount: number; description: string; }
interface JournalEntry {
  id: string; date: string; reference: string; description: string;
  source: string; source_display: string; status: string; status_display: string;
  created_by_name: string; total_debits: number; total_credits: number; is_balanced: boolean;
  lines: JournalLine[]; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-slate-100 text-slate-600 border-slate-200',
  POSTED:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  REVERSED: 'bg-red-50 text-red-600 border-red-200',
};
const SOURCE_COLORS: Record<string, string> = {
  MANUAL:  'bg-blue-50 text-blue-700 border-blue-200',
  PAYROLL: 'bg-teal-50 text-teal-700 border-teal-200',
  EXPENSE: 'bg-amber-50 text-amber-700 border-amber-200',
  PETTY:   'bg-purple-50 text-purple-700 border-purple-200',
};

function NewJournalModal({ accounts, onClose, onSuccess }: {
  accounts: Account[]; onClose: () => void; onSuccess: () => void;
}) {
  const { toast, container: tc } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [header, setHeader] = useState({ date: today, reference: '', description: '' });
  const [lines, setLines] = useState([
    { account: '', side: 'DEBIT' as 'DEBIT' | 'CREDIT', amount: '', description: '' },
    { account: '', side: 'CREDIT' as 'DEBIT' | 'CREDIT', amount: '', description: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const totalDebit  = lines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredit = lines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isBalanced  = totalDebit > 0 && totalDebit === totalCredit;

  function addLine() {
    setLines(prev => [...prev, { account: '', side: 'DEBIT', amount: '', description: '' }]);
  }
  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, k: string, v: string) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  async function handleSubmit(e: React.FormEvent, andPost: boolean) {
    e.preventDefault();
    if (!header.description.trim()) { toast('Enter a description.', 'error'); return; }
    if (!isBalanced) { toast('Entry is not balanced. Debits must equal Credits.', 'error'); return; }
    const validLines = lines.filter(l => l.account && parseFloat(l.amount) > 0);
    if (validLines.length < 2) { toast('At least 2 complete lines required.', 'error'); return; }

    setLoading(true);
    try {
      const res = await api.post('/finance/journal/', {
        date: header.date,
        reference: header.reference,
        description: header.description,
        source: 'MANUAL',
        lines: validLines.map(l => ({
          account: l.account,
          side: l.side,
          amount: parseFloat(l.amount),
          description: l.description,
        })),
      });
      if (andPost) {
        await api.post(`/finance/journal/${res.data.id}/post_entry/`);
        toast('Journal entry created and posted.', 'success');
      } else {
        toast('Journal entry saved as draft.', 'success');
      }
      onSuccess(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> } };
      const msg = JSON.stringify(e.response?.data ?? 'Failed to save entry.');
      toast(msg, 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {tc}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Journal Entry</h2>
            <p className="text-xs text-slate-500 mt-0.5">Double-entry: total debits must equal total credits.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form className="p-6 space-y-6">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Date *</label>
              <input type="date" value={header.date} onChange={e => setHeader(h => ({ ...h, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Reference</label>
              <input type="text" value={header.reference} onChange={e => setHeader(h => ({ ...h, reference: e.target.value }))} placeholder="e.g. INV-001"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description *</label>
              <input type="text" value={header.description} onChange={e => setHeader(h => ({ ...h, description: e.target.value }))} placeholder="What is this entry for?"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 px-2">
              <div className="col-span-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Account</div>
              <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Dr/Cr</div>
              <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount (KES)</div>
              <div className="col-span-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</div>
              <div className="col-span-1" />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <select value={line.account} onChange={e => updateLine(i, 'account', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <select value={line.side} onChange={e => updateLine(i, 'side', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500 ${line.side === 'DEBIT' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-pink-50 border-pink-200 text-pink-700'}`}>
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" min="0.01" step="0.01" value={line.amount} onChange={e => updateLine(i, 'amount', e.target.value)} placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 tabular-nums" />
                </div>
                <div className="col-span-3">
                  <input type="text" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Optional note"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addLine}
              className="flex items-center gap-2 text-sm text-teal-600 font-bold hover:underline mt-2">
              <Plus className="h-4 w-4" /> Add line
            </button>
          </div>

          {/* Totals */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2">
              {isBalanced
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <AlertCircle className="h-5 w-5 text-red-500" />}
              <span className={`text-sm font-bold ${isBalanced ? 'text-emerald-700' : 'text-red-600'}`}>
                {isBalanced ? 'Entry is balanced' : `Not balanced — Debit: ${totalDebit.toLocaleString()} | Credit: ${totalCredit.toLocaleString()}`}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-700">
              Total: KES {Math.max(totalDebit, totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
            <button type="button" onClick={e => handleSubmit(e, false)} disabled={loading}
              className="flex-1 py-3 rounded-2xl border-2 border-teal-600 text-teal-600 text-sm font-bold hover:bg-teal-50 disabled:opacity-60 transition-all">
              Save as Draft
            </button>
            <button type="button" onClick={e => handleSubmit(e, true)} disabled={loading || !isBalanced}
              className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Post Entry</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JournalPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast, container: toastContainer } = useToast();
  const isFinanceOrAdmin = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ['journal', statusFilter, sourceFilter],
    queryFn: () => api.get('/finance/journal/', {
      params: { ...(statusFilter ? { status: statusFilter } : {}), ...(sourceFilter ? { source: sourceFilter } : {}) }
    }).then(r => r.data.results ?? r.data),
    refetchInterval: 30000,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts-active'],
    queryFn: () => api.get('/finance/accounts/', { params: { active: true } }).then(r => r.data.results ?? r.data),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => api.post(`/finance/journal/${id}/post_entry/`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journal'] }); toast('Entry posted.', 'success'); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e.response?.data?.error || 'Failed to post entry.', 'error');
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/finance/journal/${id}/reverse/`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journal'] }); toast('Entry reversed.', 'success'); },
    onError: () => toast('Failed to reverse entry.', 'error'),
  });

  const toggleExpand = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-8">
      {toastContainer}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Journal Entries</h1>
          <p className="text-slate-500 dark:text-slate-400">Double-entry bookkeeping — every transaction recorded with balanced debits and credits.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="REVERSED">Reversed</option>
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none">
            <option value="">All sources</option>
            <option value="MANUAL">Manual</option>
            <option value="PAYROLL">Payroll</option>
            <option value="EXPENSE">Expense</option>
            <option value="PETTY">Petty Cash</option>
          </select>
          {isFinanceOrAdmin && (
            <Button onClick={() => setIsModalOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6 py-6 rounded-2xl font-bold shadow-sm">
              <Plus className="h-5 w-5" /> New Entry
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <GlassCard className="p-16 text-center border border-slate-200/60">
          <FileText className="h-14 w-14 mx-auto mb-4 text-slate-300" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">No journal entries yet</h3>
          <p className="text-slate-500 text-sm mb-4">Journal entries are created manually or auto-posted from payroll and expense approvals.</p>
          {isFinanceOrAdmin && <Button onClick={() => setIsModalOpen(true)} className="bg-teal-600 text-white px-6 py-3 rounded-2xl font-bold">Create First Entry</Button>}
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden border border-slate-200/60 rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60">
                  <th className="px-4 py-4 w-8" />
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Reference</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Description</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Source</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Debit</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Credit</th>
                  <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  {isFinanceOrAdmin && <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map(entry => (
                  <>
                    <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => toggleExpand(entry.id)}>
                      <td className="px-4 py-4">
                        {expanded.has(entry.id) ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-900 dark:text-white">{format(new Date(entry.date), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">{entry.reference || '—'}</td>
                      <td className="px-4 py-4 text-sm text-slate-900 dark:text-white max-w-xs truncate">{entry.description}</td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${SOURCE_COLORS[entry.source] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{entry.source_display}</span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-sm text-blue-600 tabular-nums">{entry.total_debits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-4 text-right font-bold text-sm text-pink-600 tabular-nums">{entry.total_credits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[entry.status]}`}>{entry.status_display}</span>
                      </td>
                      {isFinanceOrAdmin && (
                        <td className="px-4 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {entry.status === 'DRAFT' && (
                              <button onClick={() => postMutation.mutate(entry.id)} disabled={postMutation.isPending}
                                title="Post entry" className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                                {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </button>
                            )}
                            {entry.status === 'POSTED' && (
                              <button onClick={() => reverseMutation.mutate(entry.id)} disabled={reverseMutation.isPending}
                                title="Reverse entry" className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded.has(entry.id) && (
                      <tr key={`${entry.id}-lines`} className="bg-slate-50/50 dark:bg-slate-900/50">
                        <td colSpan={isFinanceOrAdmin ? 9 : 8} className="px-12 py-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <th className="pb-2 text-left">Account</th>
                                <th className="pb-2 text-left">Description</th>
                                <th className="pb-2 text-right">Debit (KES)</th>
                                <th className="pb-2 text-right">Credit (KES)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {entry.lines.map(line => (
                                <tr key={line.account + line.side}>
                                  <td className="py-2 font-medium text-slate-900 dark:text-white">
                                    <span className="font-mono text-slate-500 mr-2">{line.account_code}</span>{line.account_name}
                                  </td>
                                  <td className="py-2 text-slate-500">{line.description || '—'}</td>
                                  <td className="py-2 text-right font-bold text-blue-600 tabular-nums">
                                    {line.side === 'DEBIT' ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                  </td>
                                  <td className="py-2 text-right font-bold text-pink-600 tabular-nums">
                                    {line.side === 'CREDIT' ? line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="text-xs text-slate-400 mt-2">Created by {entry.created_by_name} · {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}</p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {isModalOpen && <NewJournalModal accounts={accounts} onClose={() => setIsModalOpen(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['journal'] })} />}
    </div>
  );
}
