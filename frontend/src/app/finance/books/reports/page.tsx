'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import api from '@/lib/api';
import {
  BarChart3, TrendingUp, Scale, FileSpreadsheet,
  ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type ReportType = 'income-statement' | 'balance-sheet' | 'trial-balance';

function formatKES(n: number) {
  return `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
function cls(n: number) {
  return n >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500';
}

export default function FinancialReportsPage() {
  const today = new Date();
  const [activeReport, setActiveReport] = useState<ReportType>('income-statement');
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [tbDate, setTbDate] = useState(format(today, 'yyyy-MM-dd'));

  const dateFrom = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const dateTo   = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

  function prevMonth() { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() {
    if (month === today.getMonth() + 1 && year === today.getFullYear()) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  const { data: incomeStatement, isLoading: isLoading } = useQuery({
    queryKey: ['income-statement', dateFrom, dateTo],
    queryFn: () => api.get('/finance/income-statement/', { params: { date_from: dateFrom, date_to: dateTo } }).then(r => r.data),
    enabled: activeReport === 'income-statement',
  });

  const { data: balanceSheet, isLoading: bsLoading } = useQuery({
    queryKey: ['balance-sheet', dateTo],
    queryFn: () => api.get('/finance/balance-sheet/', { params: { date_to: dateTo } }).then(r => r.data),
    enabled: activeReport === 'balance-sheet',
  });

  const { data: trialBalance, isLoading: tbLoading } = useQuery({
    queryKey: ['trial-balance', tbDate],
    queryFn: () => api.get('/finance/trial-balance/', { params: { date_to: tbDate } }).then(r => r.data),
    enabled: activeReport === 'trial-balance',
  });

  const tabs = [
    { id: 'income-statement' as ReportType, label: 'Income Statement', icon: TrendingUp,    desc: 'Profit & Loss' },
    { id: 'balance-sheet'   as ReportType, label: 'Balance Sheet',     icon: Scale,         desc: 'Assets = Liabilities + Equity' },
    { id: 'trial-balance'   as ReportType, label: 'Trial Balance',      icon: FileSpreadsheet, desc: 'All account balances' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Financial Reports</h1>
          <p className="text-slate-500 dark:text-slate-400">Standard accounting reports generated from your journal entries.</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-sm">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4 text-slate-500" /></button>
          <span className="text-sm font-bold text-slate-900 dark:text-white w-28 text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} disabled={month === today.getMonth()+1 && year === today.getFullYear()}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="h-4 w-4 text-slate-500" /></button>
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex gap-3 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveReport(tab.id)}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border font-bold text-sm transition-all ${activeReport === tab.id ? 'bg-slate-950 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <tab.icon className="h-5 w-5" />
            <div className="text-left">
              <div>{tab.label}</div>
              <div className={`text-[10px] font-normal ${activeReport === tab.id ? 'text-slate-400 dark:text-slate-600' : 'text-slate-400'}`}>{tab.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Income Statement ──────────────────────────────────────────────── */}
      {activeReport === 'income-statement' && (
        <GlassCard className="p-8 border border-slate-200/60">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">Income Statement</h2>
              <p className="text-slate-500 text-sm mt-0.5">{MONTHS[month-1]} {year} · {dateFrom} to {dateTo}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-slate-300" />
          </div>
          {isLoading ? <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" /> : !incomeStatement ? null : (
            <div className="space-y-0">
              {/* Revenue */}
              <div className="border-b-2 border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs mb-3">Revenue</h3>
                {incomeStatement.revenue.map((r: { code: string; name: string; amount: number }) => (
                  <div key={r.code} className="flex justify-between py-1.5 pl-4">
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{r.code} — {r.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums text-sm">{formatKES(r.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 pl-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                  <span className="font-bold text-slate-900 dark:text-white">Total Revenue</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{formatKES(incomeStatement.total_revenue)}</span>
                </div>
              </div>
              {/* COGS */}
              {incomeStatement.cogs.length > 0 && (
                <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                  <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs mb-3">Cost of Goods Sold</h3>
                  {incomeStatement.cogs.map((r: { code: string; name: string; amount: number }) => (
                    <div key={r.code} className="flex justify-between py-1.5 pl-4">
                      <span className="text-slate-700 dark:text-slate-300 text-sm">{r.code} — {r.name}</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums text-sm">{formatKES(r.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 pl-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                    <span className="font-bold text-slate-900 dark:text-white">Gross Profit</span>
                    <span className={`font-bold tabular-nums ${cls(incomeStatement.gross_profit)}`}>{formatKES(incomeStatement.gross_profit)}</span>
                  </div>
                </div>
              )}
              {/* Operating Expenses */}
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-xs mb-3">Operating Expenses</h3>
                {incomeStatement.expenses.map((r: { code: string; name: string; amount: number }) => (
                  <div key={r.code} className="flex justify-between py-1.5 pl-4">
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{r.code} — {r.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums text-sm">{formatKES(r.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 pl-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                  <span className="font-bold text-slate-900 dark:text-white">Total Expenses</span>
                  <span className="font-bold text-red-500 tabular-nums">{formatKES(incomeStatement.total_expenses)}</span>
                </div>
              </div>
              {/* Net Profit */}
              <div className={`flex justify-between py-4 px-4 rounded-2xl ${incomeStatement.net_profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <span className="text-lg font-black text-slate-900 dark:text-white">Net {incomeStatement.net_profit >= 0 ? 'Profit' : 'Loss'}</span>
                <span className={`text-xl font-black tabular-nums ${incomeStatement.net_profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatKES(Math.abs(incomeStatement.net_profit))}
                </span>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Balance Sheet ─────────────────────────────────────────────────── */}
      {activeReport === 'balance-sheet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <GlassCard className="p-8 border border-slate-200/60">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-1">Assets</h2>
            <p className="text-slate-500 text-sm mb-6">As at {dateTo}</p>
            {bsLoading ? <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" /> : !balanceSheet ? null : (
              <>
                {balanceSheet.assets.map((a: { code: string; name: string; balance: number }) => (
                  <div key={a.code} className="flex justify-between py-2 pl-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{a.code} — {a.name}</span>
                    <span className="font-semibold tabular-nums text-sm text-slate-900 dark:text-white">{formatKES(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3 mt-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 px-3">
                  <span className="font-black text-slate-900 dark:text-white">Total Assets</span>
                  <span className="font-black text-teal-600 tabular-nums">{formatKES(balanceSheet.total_assets)}</span>
                </div>
              </>
            )}
          </GlassCard>
          {/* Liabilities + Equity */}
          <GlassCard className="p-8 border border-slate-200/60">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-1">Liabilities & Equity</h2>
            <p className="text-slate-500 text-sm mb-6">As at {dateTo}</p>
            {bsLoading ? <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" /> : !balanceSheet ? null : (
              <>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Liabilities</p>
                {balanceSheet.liabilities.map((a: { code: string; name: string; balance: number }) => (
                  <div key={a.code} className="flex justify-between py-2 pl-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{a.code} — {a.name}</span>
                    <span className="font-semibold tabular-nums text-sm text-slate-900 dark:text-white">{formatKES(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 pl-2 mt-1 mb-4">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Total Liabilities</span>
                  <span className="font-bold text-red-500 tabular-nums text-sm">{formatKES(balanceSheet.total_liabilities)}</span>
                </div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Equity</p>
                {balanceSheet.equity.map((a: { code: string; name: string; balance: number }) => (
                  <div key={a.code} className="flex justify-between py-2 pl-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300 text-sm">{a.code} — {a.name}</span>
                    <span className="font-semibold tabular-nums text-sm text-slate-900 dark:text-white">{formatKES(a.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 pl-2">
                  <span className="text-slate-700 dark:text-slate-300 text-sm">Net Profit / (Loss)</span>
                  <span className={`font-semibold tabular-nums text-sm ${cls(balanceSheet.net_income)}`}>{formatKES(balanceSheet.net_income)}</span>
                </div>
                <div className="flex justify-between py-3 mt-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 px-3">
                  <span className="font-black text-slate-900 dark:text-white">Total Equity</span>
                  <span className="font-black text-purple-600 tabular-nums">{formatKES(balanceSheet.total_equity)}</span>
                </div>
                <div className={`flex justify-between py-3 mt-3 rounded-xl px-3 ${balanceSheet.balanced ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <span className="font-black text-slate-900 dark:text-white">Liabilities + Equity</span>
                  <span className={`font-black tabular-nums ${balanceSheet.balanced ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatKES(balanceSheet.total_liabilities + balanceSheet.total_equity)}
                    {!balanceSheet.balanced && ' ⚠ Imbalanced'}
                  </span>
                </div>
              </>
            )}
          </GlassCard>
        </div>
      )}

      {/* ── Trial Balance ─────────────────────────────────────────────────── */}
      {activeReport === 'trial-balance' && (
        <GlassCard className="overflow-hidden border border-slate-200/60 rounded-3xl">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">Trial Balance</h2>
              <div className="flex items-center gap-3 mt-2">
                <label className="text-sm text-slate-500">As at:</label>
                <input type="date" value={tbDate} onChange={e => setTbDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            {trialBalance && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${trialBalance.balanced ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <Scale className="h-4 w-4" />
                <span className="text-sm font-bold">{trialBalance.balanced ? 'Balanced ✓' : 'Imbalanced ✗'}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest w-24">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Account Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Total Debit</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Total Credit</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Net Debit</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Net Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tbLoading ? (
                  [...Array(8)].map((_,i) => <tr key={i} className="animate-pulse">{[...Array(7)].map((_,j) => <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded" /></td>)}</tr>)
                ) : !trialBalance?.accounts?.length ? (
                  <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-500 text-sm">No transactions recorded yet. Post journal entries to generate the trial balance.</td></tr>
                ) : (
                  <>
                    {trialBalance.accounts.map((row: { code: string; name: string; account_type: string; debit: number; credit: number; net_debit: number; net_credit: number }) => (
                      <tr key={row.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-sm font-bold text-slate-600 dark:text-slate-400">{row.code}</td>
                        <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{row.name}</td>
                        <td className="px-6 py-3 text-xs font-bold text-slate-500">{row.account_type}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-sm text-blue-600">{row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-sm text-pink-600">{row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-sm font-bold text-blue-700">{row.net_debit > 0 ? row.net_debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-6 py-3 text-right tabular-nums text-sm font-bold text-pink-700">{row.net_credit > 0 ? row.net_credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 dark:bg-slate-800 font-black border-t-2 border-slate-300 dark:border-slate-600">
                      <td colSpan={5} className="px-6 py-4 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Totals</td>
                      <td className="px-6 py-4 text-right tabular-nums text-blue-700 font-black">
                        {trialBalance.total_debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-pink-700 font-black">
                        {trialBalance.total_credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
