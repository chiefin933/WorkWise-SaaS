'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, Briefcase, DollarSign, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import api from '@/lib/api';
import type { ApiErrorResponse } from '@/lib/types';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  job_title: string;
  kra_pin: string;
  employment_type: string;
  salary_basic: string;
  payment_method: string;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const [formData, setFormData] = useState<EmployeeFormData>({
    name: '',
    email: '',
    phone: '',
    department: '',
    job_title: '',
    kra_pin: '',
    employment_type: 'monthly',
    salary_basic: '',
    payment_method: 'bank',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/employees/', formData);
      onSuccess();
      onClose();
      setFormData({
        name: '',
        email: '',
        phone: '',
        department: '',
        job_title: '',
        kra_pin: '',
        employment_type: 'monthly',
        salary_basic: '',
        payment_method: 'bank',
      });
    } catch (error) {
      const apiError = error as { response?: { data?: ApiErrorResponse } };
      setError(apiError.response?.data?.message || 'Failed to add employee. Check your plan limits.');
    } finally {
      setLoading(false);
    }
  };

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
            <GlassCard className="overflow-hidden border border-slate-200/80 shadow-2xl bg-white">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 font-outfit">Add New Employee</h3>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        placeholder="+254..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Department</label>
                    <input
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                      placeholder="Finance, HR, Operations..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Job Title</label>
                    <input
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                      placeholder="Accountant"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">KRA PIN</label>
                    <input
                      value={formData.kra_pin}
                      onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                      placeholder="A001234567X"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Employment Type</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <select
                        value={formData.employment_type}
                        onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Basic Salary (KES)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="number"
                        required
                        value={formData.salary_basic}
                        onChange={(e) => setFormData({ ...formData, salary_basic: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        placeholder="50000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Payment Method</label>
                    <div className="relative">
                      <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                      >
                        <option value="bank">Bank Transfer</option>
                        <option value="mpesa">M-Pesa</option>
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
                    className="flex-1 py-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm"
                  >
                    {loading ? 'Adding...' : 'Add Employee'}
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
