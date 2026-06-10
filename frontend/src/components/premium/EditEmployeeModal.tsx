'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import api from '@/lib/api';
import type { ApiErrorResponse, Employee } from '@/lib/types';

interface EditEmployeeModalProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditEmployeeModal({ employee, isOpen, onClose, onSuccess }: EditEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    job_title: '',
    kra_pin: '',
    employment_type: 'monthly',
    salary_basic: '',
    payment_method: 'bank',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (employee) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        department: employee.department || '',
        job_title: employee.job_title || '',
        kra_pin: employee.kra_pin || '',
        employment_type: employee.employment_type || 'monthly',
        salary_basic: String(employee.salary_basic ?? ''),
        payment_method: employee.payment_method || 'bank',
        status: employee.status || 'active',
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setLoading(true);
    setError('');
    try {
      await api.patch(`/employees/${employee.id}/`, formData);
      onSuccess();
      onClose();
    } catch (err) {
      const apiError = err as { response?: { data?: ApiErrorResponse } };
      setError(apiError.response?.data?.error || 'Failed to update employee.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!employee || !confirm(`Remove ${employee.name} from the directory?`)) return;
    setLoading(true);
    try {
      await api.delete(`/employees/${employee.id}/`);
      onSuccess();
      onClose();
    } catch {
      setError('Could not delete employee.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-2xl"
          >
            <GlassCard className="overflow-hidden border border-slate-200/80 shadow-2xl bg-white">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 font-outfit">Edit Employee</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto bg-white">
                {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['name', 'Full Name'],
                    ['email', 'Email'],
                    ['phone', 'Phone'],
                    ['department', 'Department'],
                    ['job_title', 'Job Title'],
                    ['kra_pin', 'KRA PIN'],
                    ['salary_basic', 'Basic Salary (KES)'],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</label>
                      <input
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        value={formData[key as keyof typeof formData]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Employment Type</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                      <option value="hourly">Hourly</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleDelete} disabled={loading} className="rounded-xl py-6 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors">
                    Delete
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-6 font-bold shadow-sm transition-colors">
                    {loading ? 'Saving...' : 'Save Changes'}
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
