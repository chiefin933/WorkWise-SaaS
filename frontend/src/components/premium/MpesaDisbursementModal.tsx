'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, Loader2, AlertCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import api from '@/lib/api';
import type { PayrollRun, PayrollItem } from '@/lib/types';
import { formatKES } from '@/lib/format';

interface MpesaDisbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: PayrollRun | null;
  onSuccess?: () => void;
}

interface MpesaTx {
  id: string;
  employee_name: string;
  phone_number: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  conversation_id: string;
  result_desc: string;
  created_at: string;
  updated_at: string;
}

interface TxDataResponse {
  transactions: MpesaTx[];
  summary: {
    total: number;
    pending: number;
    success: number;
    failed: number;
    total_disbursed: number;
  };
  mode: 'live' | 'simulated';
}

export function MpesaDisbursementModal({ isOpen, onClose, run, onSuccess }: MpesaDisbursementModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txData, setTxData] = useState<TxDataResponse | null>(null);

  // Filter payroll items by payment method 'mpesa'
  const mpesaItems = run?.items?.filter((item: PayrollItem) => item.payment_method === 'mpesa') || [];
  const totalAmount = mpesaItems.reduce((acc, item) => acc + Number(item.net_pay), 0);

  const fetchTransactions = async () => {
    if (!run) return;
    try {
      const res = await api.get<TxDataResponse>(`/payroll/${run.id}/mpesa-transactions/`);
      setTxData(res.data);
    } catch (err) {
      console.error('Failed to load M-Pesa transactions:', err);
    }
  };

  // Fetch on mount / when run changes
  useEffect(() => {
    if (isOpen && run) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      fetchTransactions();
      setError('');
    } else {
      setTxData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, run]);

  // Polling logic: if there are any pending transactions, poll every 3 seconds
  useEffect(() => {
    if (!isOpen || !run || !txData) return;

    const hasPending = txData.transactions.some(tx => tx.status === 'pending');
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchTransactions();
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, txData, run]);

  const handleInitiate = async () => {
    if (!run) return;
    setLoading(true);
    setError('');
    try {
      await api.post(`/payroll/${run.id}/disburse-mpesa/`);
      await fetchTransactions();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to initiate M-Pesa disbursement.');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) =>
    new Date(2000, month - 1).toLocaleString('default', { month: 'long' });

  if (!run) return null;

  const hasTransactions = txData && txData.transactions.length > 0;
  const isSimulation = txData?.mode === 'simulated';

  // Determine overall status
  let overallStatus = 'Not Initiated';
  if (txData && txData.summary.total > 0) {
    if (txData.summary.pending > 0) {
      overallStatus = 'Processing';
    } else if (txData.summary.success === txData.summary.total) {
      overallStatus = 'Completed';
    } else {
      overallStatus = 'Partial Failure';
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-2xl"
          >
            <GlassCard className="overflow-hidden border border-slate-200/80 shadow-2xl bg-white dark:bg-slate-900">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit flex items-center gap-2">
                    <Smartphone className="h-6 w-6 text-teal-600" />
                    M-Pesa B2C Salary Payout
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Payroll Run: <span className="font-semibold text-slate-700 dark:text-slate-300">{getMonthName(run.month)} {run.year}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {txData && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      isSimulation
                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    }`}>
                      {txData.mode} Mode
                    </span>
                  )}
                  <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/10">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">M-Pesa Employees</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{mpesaItems.length}</p>
                  </div>
                  <div className="p-4 border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/10">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Total Net Pay</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white font-outfit tabular-nums">{formatKES(totalAmount)}</p>
                  </div>
                  <div className="p-4 border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/10">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Payout Status</p>
                    <p className={`text-sm font-black uppercase tracking-wider mt-1.5 inline-flex items-center gap-1.5 ${
                      overallStatus === 'Completed'
                        ? 'text-emerald-600'
                        : overallStatus === 'Processing'
                        ? 'text-amber-500'
                        : 'text-slate-500'
                    }`}>
                      {overallStatus === 'Processing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {overallStatus}
                    </p>
                  </div>
                </div>

                {/* Employee / Transaction List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Transaction Breakdown</h4>
                    {overallStatus === 'Processing' && (
                      <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Live monitoring active (polling 3s)
                      </span>
                    )}
                  </div>

                  <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200/60 dark:border-slate-800">
                          <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Employee</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Phone Number</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">Amount (KES)</th>
                          <th className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {mpesaItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                              No employees in this run are configured for M-Pesa.
                            </td>
                          </tr>
                        ) : hasTransactions ? (
                          txData?.transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{tx.employee_name}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{tx.phone_number}</td>
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white tabular-nums">{tx.amount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  tx.status === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : tx.status === 'pending'
                                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                    : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                }`}>
                                  {tx.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          mpesaItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{item.employee_name}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.mpesa_number || 'N/A'}</td>
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white tabular-nums">{Number(item.net_pay).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  Not Initiated
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 flex gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1 py-6 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Close
                </Button>
                {!hasTransactions && mpesaItems.length > 0 && (
                  <Button
                    onClick={handleInitiate}
                    disabled={loading}
                    className="flex-1 py-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-md flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="h-5 w-5" />
                        Initiate Bulk Disbursement
                      </>
                    )}
                  </Button>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
