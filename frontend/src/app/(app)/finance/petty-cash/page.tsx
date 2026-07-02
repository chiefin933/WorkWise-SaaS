'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/store';
import { financeApi } from '@/lib/api';
import type { PettyCashFund, PettyCashTransaction } from '@/lib/types';
import {
  Banknote, Plus, X, Loader2, CheckCircle2,
  XCircle, Clock, ArrowUpCircle, ArrowDownCircle, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    approved:  'bg-blue-50 text-blue-700 border-blue-200',
    rejected:  'bg-red-50 text-red-600 border-red-200',
    disbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${map[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}

function CreateFundModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast, container: tc } = useToast();
  const [form, setForm] = useState({ name: 'Main Petty Cash Fund', opening_balance: '' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.opening_balance || Number(form.opening_balance) < 0) { toast('Enter a valid opening balance.', 'error'); return; }
    setLoading(true);
    try {
      await financeApi.createPettyCashFund({ name: form.name, opening_balance: Number(form.opening_balance) });
      toast('Petty cash fund created.', 'success');
      onSuccess(); onClose();
    } catch { toast('Failed to create fund.', 'error'); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {tc}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Petty Cash Fund</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Fund Name</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Opening Balance (KES)</label>
            <input type="number" min="0" step="0.01" value={form.opening_balance} onChange={e => set('opening_balance', e.target.value)} placeholder="e.g. 50000" required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequestModal({ fund, onClose, onSuccess }: { fund: PettyCashFund; onClose: () => void; onSuccess: () => void }) {
  const { toast, container: tc } = useToast();
  const [form, setForm] = useState({ transaction_type: 'request', amount: '', purpose: '', category: '', receipt_url: '' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { toast('Enter a valid amount.', 'error'); return; }
    if (!form.purpose.trim()) { toast('Enter a purpose.', 'error'); return; }
    if (form.transaction_type === 'request' && Number(form.amount) > fund.current_balance) {
      toast(`Insufficient fund balance. Available: KES ${fund.current_balance.toLocaleString()}`, 'error'); return;
    }
    setLoading(true);
    try {
      await financeApi.createPettyCashRequest(fund.id, { transaction_type: form.transaction_type, amount: Number(form.amount), purpose: form.purpose.trim(), category: form.category.trim(), receipt_url: form.receipt_url.trim() });
      toast('Request submitted.', 'success');
      onSuccess(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e.response?.data?.error || 'Failed to submit request.', 'error');
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {tc}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Petty Cash Request</h2>
            <p className="text-xs text-slate-500">Fund: {fund.name} · Balance: KES {Number(fund.current_balance).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Request Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: 'request', label: 'Disbursement', icon: ArrowDownCircle }, { value: 'topup', label: 'Top-Up', icon: ArrowUpCircle }, { value: 'replenish', label: 'Replenish', icon: Banknote }].map(t => (
                <button key={t.value} type="button" onClick={() => set('transaction_type', t.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-bold transition-all ${form.transaction_type === t.value ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <t.icon className="h-4 w-4" />{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Amount (KES)</label>
              <input type="number" min="1" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Category</label>
              <input type="text" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Stationery"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Purpose *</label>
            <input type="text" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="What is this money for?" required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Receipt URL (optional)</label>
            <input type="url" value={form.receipt_url} onChange={e => set('receipt_url', e.target.value)} placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PettyCashPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast, container: toastContainer } = useToast();
  const isFinanceOrAdmin = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFund, setSelectedFund] = useState<PettyCashFund | null>(null);
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [activeFundId, setActiveFundId] = useState<string | null>(null);

  const { data: funds = [], isLoading: fundsLoading } = useQuery<PettyCashFund[]>({
    queryKey: ['petty-cash-funds'],
    queryFn: financeApi.getPettyCashFunds,
  });

  const { data: transactions = [], isLoading: txnLoading } = useQuery<PettyCashTransaction[]>({
    queryKey: ['petty-cash-txns', activeFundId],
    queryFn: () => activeFundId ? financeApi.getFundTransactions(activeFundId) : Promise.resolve([]),
    enabled: !!activeFundId,
  });

  const approveTxn = useMutation({
    mutationFn: ({ fundId, txnId }: { fundId: string; txnId: string }) =>
      financeApi.approvePettyCashTxn(fundId, txnId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] }); queryClient.invalidateQueries({ queryKey: ['petty-cash-txns'] }); toast('Transaction approved and disbursed.', 'success'); },
    onError: (err: unknown) => { const e = err as { response?: { data?: { error?: string } } }; toast(e.response?.data?.error || 'Approval failed.', 'error'); },
  });

  const rejectTxn = useMutation({
    mutationFn: ({ fundId, txnId, comment }: { fundId: string; txnId: string; comment: string }) =>
      financeApi.rejectPettyCashTxn(fundId, txnId, comment),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['petty-cash-txns'] }); toast('Transaction rejected.', 'success'); },
    onError: () => toast('Rejection failed.', 'error'),
  });

  const totalBalance = funds.reduce((s, f) => s + Number(f.current_balance), 0);
  const pendingTxns = transactions.filter(t => t.status === 'pending').length;

  return (
    <div className="space-y-8">
      {toastContainer}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Petty Cash</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage petty cash funds, requests, and disbursements.</p>
        </div>
        <div className="flex items-center gap-3">
          {isFinanceOrAdmin && (
            <Button onClick={() => setIsCreateOpen(true)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 gap-2 px-5 py-6 rounded-2xl shadow-sm">
              <Plus className="h-4 w-4" /> New Fund
            </Button>
          )}
          <Button onClick={() => { if (funds.length > 0) { setSelectedFund(funds[0]); setIsRequestOpen(true); } else toast('Create a fund first.', 'error'); }}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6 py-6 rounded-2xl font-bold shadow-sm">
            <Plus className="h-5 w-5" /> New Request
          </Button>
        </div>
      </div>

      {/* Fund Cards */}
      {fundsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2].map(i => <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : funds.length === 0 ? (
        <GlassCard className="p-12 text-center border border-slate-200/60">
          <Banknote className="h-14 w-14 mx-auto mb-4 text-slate-300" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">No Petty Cash Funds</h3>
          <p className="text-slate-500 text-sm mb-4">Create a fund to start tracking petty cash requests and disbursements.</p>
          {isFinanceOrAdmin && <Button onClick={() => setIsCreateOpen(true)} className="bg-teal-600 text-white px-6 py-3 rounded-2xl font-bold">Create Fund</Button>}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {funds.map(fund => (
            <GlassCard key={fund.id} onClick={() => setActiveFundId(activeFundId === fund.id ? null : fund.id)}
              className={`p-6 border cursor-pointer transition-all hover:shadow-md ${activeFundId === fund.id ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200/60'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${fund.current_balance < 5000 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-teal-50 dark:bg-teal-900/20'}`}>
                  <Banknote className={`h-6 w-6 ${fund.current_balance < 5000 ? 'text-red-500' : 'text-teal-600'}`} />
                </div>
                {fund.current_balance < 5000 && <span className="flex items-center gap-1 text-xs text-red-500 font-bold"><AlertCircle className="h-3.5 w-3.5" /> Low balance</span>}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{fund.name}</h3>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-outfit">KES {Number(fund.current_balance).toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Opening: KES {Number(fund.opening_balance).toLocaleString()}</p>
              {activeFundId === fund.id && <p className="text-xs text-teal-600 font-bold mt-2">▼ Viewing transactions</p>}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Transactions */}
      {activeFundId && (
        <GlassCard className="overflow-hidden border border-slate-200/60 rounded-3xl">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Transactions — {funds.find(f => f.id === activeFundId)?.name}</h3>
            {pendingTxns > 0 && <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pendingTxns} pending</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Requested By</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Purpose</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  {isFinanceOrAdmin && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {txnLoading ? (
                  [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse">{[...Array(isFinanceOrAdmin ? 7 : 6)].map((_, j) => <td key={j} className="px-6 py-4"><div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg" /></td>)}</tr>)
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={isFinanceOrAdmin ? 7 : 6} className="px-6 py-12 text-center text-slate-500 text-sm">No transactions yet.</td></tr>
                ) : (
                  transactions.map(txn => (
                    <tr key={txn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-sm text-slate-900 dark:text-white">{txn.requested_by_name}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-900 dark:text-white">{txn.purpose}</p>
                        {txn.category && <p className="text-xs text-slate-500">{txn.category}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${txn.transaction_type === 'request' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {txn.transaction_type === 'request' ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                          {txn.type_display}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-sm text-slate-900 dark:text-white tabular-nums">KES {Number(txn.amount).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{format(new Date(txn.created_at), 'dd MMM yyyy')}</td>
                      <td className="px-6 py-4">{statusBadge(txn.status)}</td>
                      {isFinanceOrAdmin && (
                        <td className="px-6 py-4 text-right">
                          {txn.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => approveTxn.mutate({ fundId: activeFundId, txnId: txn.id })}
                                disabled={approveTxn.isPending}
                                className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all" title="Approve & Disburse">
                                {approveTxn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              </button>
                              <button onClick={() => rejectTxn.mutate({ fundId: activeFundId, txnId: txn.id, comment: 'Rejected by manager' })}
                                disabled={rejectTxn.isPending}
                                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all" title="Reject">
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {isCreateOpen && <CreateFundModal onClose={() => setIsCreateOpen(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] })} />}
      {isRequestOpen && selectedFund && (
        <RequestModal fund={selectedFund} onClose={() => setIsRequestOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] }); queryClient.invalidateQueries({ queryKey: ['petty-cash-txns'] }); }} />
      )}
    </div>
  );
}
