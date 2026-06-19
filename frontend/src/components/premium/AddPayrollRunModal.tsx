'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import api from '@/lib/api';
import type { ApiErrorResponse } from '@/lib/types';

interface AddPayrollRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (runId: string) => void;
}

interface PayrollRunFormData {
  month: number;
  year: number;
}

export function AddPayrollRunModal({ isOpen, onClose, onSuccess }: AddPayrollRunModalProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState<PayrollRunFormData>({
    month: currentMonth,
    year: currentYear,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post<{ id: string }>('/payroll/', formData);
      onSuccess(res.data.id);
      onClose();
    } catch (error) {
      const apiError = error as { response?: { data?: ApiErrorResponse } };
      setError(apiError.response?.data?.non_field_errors?.[0] || 'Failed to create payroll run. Check if it already exists.');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md"
          >
            <GlassCard className="overflow-hidden border border-slate-200/80 shadow-2xl bg-white">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 font-outfit">New Payroll Run</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-medium">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Payroll Month</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <select
                        value={formData.month}
                        onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                      >
                        {months.map((name, i) => (
                           <option key={i + 1} value={i + 1}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Year</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <select
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                      >
                        {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="flex-1 py-6 rounded-2xl text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm flex items-center justify-center gap-2 group"
                  >
                    {loading ? 'Creating...' : (
                      <>Initialize Run <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></>
                    )}
                  </Button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
