'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import {
  BookOpen, Plus, RefreshCw, Pencil, Trash2,
  ChevronDown, ChevronRight, Loader2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Account {
  id: string; code: string; name: string;
  account_type: string; account_type_display: string;
  parent: string | null; parent_name: string | null;
  description: string; is_active: boolean; is_system: boolean;
  normal_balance: string; balance: number;
}

const TYPE_COLORS: Record<string, string> = {
  ASSET:     'bg-teal-50 text-teal-700 border-teal-200',
  LIABILITY: 'bg-red-50 text-red-700 border-red-200',
  EQUITY:    'bg-purple-50 text-purple-700 border-purple-200',
  REVENUE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPENSE:   'bg-amber-50 text-amber-700 border-amber-200',
};

const TYPES = ['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'];

function AccountModal({ account, accounts, onClose, onSuccess }: {
  account?: Account; accounts: Account[];
  onClose: () => void; onSuccess: () => void;
}) {
  const { toast, container: tc } = useToast();
  const [form, setForm] = useState({
    code:         account?.code ?? '',
    name:         account?.name ?? '',
    account_type: account?.account_type ?? 'EXPENSE',
    parent:       account?.parent ?? '',
    description:  account?.description ?? '',
    is_active:    account?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const parentOptions = accounts.filter(a =>
    a.id !== account?.id && a.account_type === form.account_type
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) { toast('Code and name are required.', 'error'); return; }
    setLoading(true);
    try {
      const payload = { ...form, parent: form.parent || null };
      if (account) {
        await api.patch(`/finance/accounts/${account.id}/`, payload);
        toast('Account updated.', 'success');
      } else {
        await api.post('/finance/accounts/', payload);
        toast('Account created.', 'success');
      }
      onSuccess(); onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, string[]> } };
      const msg = Object.values(e.response?.data ?? {}).flat().join(', ') || 'Failed to save account.';
      toast(msg, 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {tc}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{account ? 'Edit Account' : 'New Account'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Account Code *</label>
              <input type="text" value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. 1105" disabled={account?.is_system}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Type *</label>
              <select value={form.account_type} onChange={e => set('account_type', e.target.value)} disabled={!!account}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50">
                {TYPES.map(t => <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Account Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Savings Account"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Parent Account</label>
            <select value={form.parent} onChange={e => set('parent', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">None (top-level)</option>
              {parentOptions.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : account ? 'Update' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ChartOfAccountsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast, container: toastContainer } = useToast();
  const isFinanceOrAdmin = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const [filterType, setFilterType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | undefined>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(TYPES));

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['accounts', filterType],
    queryFn: () => api.get('/finance/accounts/', { params: { active: false, ...(filterType ? { type: filterType } : {}) } }).then(r => r.data.results ?? r.data),
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post('/finance/accounts/seed/'),
    onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); toast(res.data.message, 'success'); },
    onError: () => toast('Failed to seed accounts.', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/accounts/${id}/`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounts'] }); toast('Account removed.', 'success'); },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      toast(e.response?.data?.error || 'Cannot delete this account.', 'error');
    },
  });

  // Group by type
  const grouped = TYPES.reduce((acc, t) => {
    acc[t] = accounts.filter(a => a.account_type === t);
    return acc;
  }, {} as Record<string, Account[]>);

  const typeLabel = (t: string) => t[0] + t.slice(1).toLowerCase() + 's';
  const total = accounts.length;

  return (
    <div className="space-y-8">
      {toastContainer}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Chart of Accounts</h1>
          <p className="text-slate-500 dark:text-slate-400">{total} accounts · organised by type following Kenyan SME standard</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none">
            <option value="">All types</option>
            {TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          {isFinanceOrAdmin && (
            <>
              <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
                className="gap-2 px-5 py-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-sm">
                {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Seed Standard
              </Button>
              <Button onClick={() => { setEditAccount(undefined); setIsModalOpen(true); }}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6 py-6 rounded-2xl font-bold shadow-sm">
                <Plus className="h-5 w-5" /> Add Account
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : (
        TYPES.filter(t => !filterType || t === filterType).map(type => {
          const typeAccounts = grouped[type] ?? [];
          if (typeAccounts.length === 0) return null;
          const isOpen = expanded.has(type);
          const totalBalance = typeAccounts.reduce((s, a) => s + a.balance, 0);

          return (
            <GlassCard key={type} className="overflow-hidden border border-slate-200/60 rounded-3xl">
              <button
                onClick={() => setExpanded(prev => { const n = new Set(prev); isOpen ? n.delete(type) : n.add(type); return n; })}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${TYPE_COLORS[type]}`}>{type}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{typeLabel(type)}</span>
                  <span className="text-xs text-slate-500">({typeAccounts.length} accounts)</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  KES {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest w-24">Code</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Account Name</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Parent</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Normal Balance</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Balance (KES)</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Status</th>
                        {isFinanceOrAdmin && <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {typeAccounts.map(acct => (
                        <tr key={acct.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${!acct.is_active ? 'opacity-50' : ''}`}>
                          <td className="px-6 py-3 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{acct.code}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              {acct.parent && <span className="w-3 border-t border-slate-300 dark:border-slate-600" />}
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{acct.name}</span>
                              {acct.is_system && <span className="text-[9px] font-black uppercase text-slate-400">SYS</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-xs text-slate-500">{acct.parent_name ?? '—'}</td>
                          <td className="px-6 py-3">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${acct.normal_balance === 'DEBIT' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                              {acct.normal_balance}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                            {acct.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${acct.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              {acct.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {isFinanceOrAdmin && (
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => { setEditAccount(acct); setIsModalOpen(true); }}
                                  className="p-2 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {!acct.is_system && (
                                  <button onClick={() => deleteMutation.mutate(acct.id)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          );
        })
      )}

      {isModalOpen && (
        <AccountModal
          account={editAccount}
          accounts={accounts}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['accounts'] })}
        />
      )}
    </div>
  );
}
