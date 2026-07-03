'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
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

type Tab = 'basic' | 'statutory' | 'payment';

const KRA_PIN_REGEX = /^[A-Z]\d{9}[A-Z]$/;

const inputCls =
  'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-700 outline-none text-slate-900 dark:text-white transition-all text-sm';

const labelCls = 'text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider';

export function EditEmployeeModal({
  employee,
  isOpen,
  onClose,
  onSuccess,
}: EditEmployeeModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kraPinError, setKraPinError] = useState('');

  const [formData, setFormData] = useState({
    // Basic
    name: '', email: '', phone: '', department: '', job_title: '',
    employment_type: 'monthly', salary_basic: '', status: 'active',
    nationality: 'Kenyan', county: '',
    // Statutory
    kra_pin: '', national_id: '', nssf_number: '', shif_number: '',
    payroll_number: '', work_permit_number: '',
    // Payment
    payment_method: 'bank',
  });

  useEffect(() => {
    if (employee) {
      const e = employee as Employee & {
        national_id?: string; nssf_number?: string; shif_number?: string;
        payroll_number?: string; nationality?: string; county?: string;
        work_permit_number?: string;
      };
      setFormData({
        name:               e.name || '',
        email:              e.email || '',
        phone:              e.phone || '',
        department:         e.department || '',
        job_title:          e.job_title || '',
        employment_type:    e.employment_type || 'monthly',
        salary_basic:       String(e.salary_basic ?? ''),
        status:             e.status || 'active',
        nationality:        e.nationality || 'Kenyan',
        county:             e.county || '',
        kra_pin:            e.kra_pin || '',
        national_id:        e.national_id || '',
        nssf_number:        e.nssf_number || '',
        shif_number:        e.shif_number || '',
        payroll_number:     e.payroll_number || '',
        work_permit_number: e.work_permit_number || '',
        payment_method:     e.payment_method || 'bank',
      });
      setError('');
      setKraPinError('');
      setActiveTab('basic');
    }
  }, [employee]);

  const set = (k: string, v: string) => setFormData(f => ({ ...f, [k]: v }));

  const validateKraPin = (pin: string) => {
    if (!pin) return true;
    if (!KRA_PIN_REGEX.test(pin.toUpperCase())) {
      setKraPinError('Format: A001234567X (letter, 9 digits, letter)');
      return false;
    }
    setKraPinError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    if (!validateKraPin(formData.kra_pin)) { setActiveTab('statutory'); return; }
    setLoading(true);
    setError('');
    try {
      await api.patch(`/employees/${employee.id}/`, {
        ...formData,
        kra_pin: formData.kra_pin ? formData.kra_pin.toUpperCase() : '',
      });
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
    if (!employee || !confirm(`Remove ${employee.name} from the directory? This cannot be undone.`)) return;
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basic',     label: 'Basic Info' },
    { id: 'statutory', label: 'Statutory IDs' },
    { id: 'payment',   label: 'Payment' },
  ];

  return (
    <AnimatePresence>
      {isOpen && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-2xl"
          >
            <GlassCard className="overflow-hidden border border-slate-200/80 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Edit Employee</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{employee.name}</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 px-6">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-4 text-sm font-bold border-b-2 transition-all ${
                      activeTab === tab.id
                        ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="p-6 max-h-[55vh] overflow-y-auto space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                      {error}
                    </div>
                  )}

                  {/* ── Basic Info Tab ─────────────────────────────────── */}
                  {activeTab === 'basic' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Full Name *</label>
                        <input required value={formData.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Jane Wanjiku" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Work Email</label>
                        <input type="email" value={formData.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="jane@company.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Phone</label>
                        <input value={formData.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+254 700 000 000" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Department</label>
                        <input value={formData.department} onChange={e => set('department', e.target.value)} className={inputCls} placeholder="Finance, HR..." />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Job Title</label>
                        <input value={formData.job_title} onChange={e => set('job_title', e.target.value)} className={inputCls} placeholder="Accountant" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Basic Salary (KES) *</label>
                        <input required type="number" value={formData.salary_basic} onChange={e => set('salary_basic', e.target.value)} className={inputCls} placeholder="50000" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Employment Type</label>
                        <select value={formData.employment_type} onChange={e => set('employment_type', e.target.value)} className={inputCls}>
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                          <option value="daily">Daily</option>
                          <option value="hourly">Hourly</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Status</label>
                        <select value={formData.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="terminated">Terminated</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Nationality</label>
                        <input value={formData.nationality} onChange={e => set('nationality', e.target.value)} className={inputCls} placeholder="Kenyan" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>County</label>
                        <input value={formData.county} onChange={e => set('county', e.target.value)} className={inputCls} placeholder="Nairobi" />
                      </div>
                    </div>
                  )}

                  {/* ── Statutory IDs Tab ──────────────────────────────── */}
                  {activeTab === 'statutory' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelCls}>KRA PIN</label>
                        <input
                          value={formData.kra_pin}
                          onChange={e => { set('kra_pin', e.target.value.toUpperCase()); if (kraPinError) validateKraPin(e.target.value); }}
                          onBlur={e => validateKraPin(e.target.value)}
                          className={`${inputCls} uppercase ${kraPinError ? '!border-red-400' : ''}`}
                          placeholder="A001234567X"
                          maxLength={11}
                        />
                        {kraPinError && <p className="text-xs text-red-500">{kraPinError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>National ID / Passport</label>
                        <input value={formData.national_id} onChange={e => set('national_id', e.target.value)} className={inputCls} placeholder="12345678" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>NSSF Number</label>
                        <input value={formData.nssf_number} onChange={e => set('nssf_number', e.target.value)} className={inputCls} placeholder="NSSF membership number" />
                        <p className="text-xs text-slate-400">Required for NSSF remittance schedule upload</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>SHIF Number</label>
                        <input value={formData.shif_number} onChange={e => set('shif_number', e.target.value)} className={inputCls} placeholder="SHIF membership number" />
                        <p className="text-xs text-slate-400">Required for SHIF remittance schedule upload</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Payroll Number</label>
                        <input value={formData.payroll_number} onChange={e => set('payroll_number', e.target.value)} className={inputCls} placeholder="Internal payroll number" />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Work Permit Number</label>
                        <input value={formData.work_permit_number} onChange={e => set('work_permit_number', e.target.value)} className={inputCls} placeholder="For non-citizen employees" />
                      </div>
                    </div>
                  )}

                  {/* ── Payment Tab ────────────────────────────────────── */}
                  {activeTab === 'payment' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Payment Method</label>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { value: 'bank',  label: 'Bank Transfer', desc: 'Equity, KCB, Co-op, Stanbic' },
                            { value: 'mpesa', label: 'M-Pesa',        desc: 'Direct to M-Pesa number' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => set('payment_method', opt.value)}
                              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                                formData.payment_method === opt.value
                                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <p className={`font-bold text-sm ${formData.payment_method === opt.value ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-300'}`}>{opt.label}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                        <p className="font-bold text-slate-600 dark:text-slate-400 mb-1">Note on sensitive fields</p>
                        M-Pesa number and bank account details are stored encrypted (AES-256-GCM).
                        To update them, use the Bulk CSV import or contact your system administrator.
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDelete}
                    disabled={loading}
                    className="rounded-xl py-5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                  >
                    Delete
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-5 font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save Changes'}
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
