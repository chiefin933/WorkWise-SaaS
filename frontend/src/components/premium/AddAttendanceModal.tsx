'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from './GlassCard';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { ApiErrorResponse, Employee } from '@/lib/types';

interface AddAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AttendanceFormData {
  employee: string;
  date: string;
  clock_in: string;
  clock_out: string;
  location: string;
}

export function AddAttendanceModal({ isOpen, onClose, onSuccess }: AddAttendanceModalProps) {
  const [formData, setFormData] = useState<AttendanceFormData>({
    employee: '',
    date: new Date().toISOString().split('T')[0],
    clock_in: '08:00',
    clock_out: '17:00',
    location: 'Office',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees-minimal'],
    queryFn: async () => {
      const res = await api.get<Employee[]>('/employees/');
      return res.data;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/attendance/', formData);
      onSuccess();
      onClose();
    } catch (error) {
      const apiError = error as { response?: { data?: ApiErrorResponse } };
      setError(apiError.response?.data?.message || 'Failed to add attendance log.');
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
            className="w-full max-w-lg"
          >
            <GlassCard className="overflow-hidden border border-slate-200/80 shadow-2xl bg-white">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 font-outfit">Add Attendance Log</h3>
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
                    <label className="text-sm font-semibold text-slate-700 ml-1">Employee</label>
                    <select
                      required
                      value={formData.employee}
                      onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all appearance-none"
                    >
                      <option value="">Select Employee</option>
                      {employees?.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Clock In</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="time"
                          required
                          value={formData.clock_in}
                          onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 ml-1">Clock Out</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="time"
                          required
                          value={formData.clock_out}
                          onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white outline-none text-slate-900 transition-all"
                        placeholder="Office, Remote, Field"
                      />
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
                    className="flex-1 py-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading ? 'Logging...' : (
                      <>Log Attendance <Plus className="h-5 w-5" /></>
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
