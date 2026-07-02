'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import type { CompanySettings } from '@/lib/types';
import {
  Crown,
  CheckCircle,
  Zap,
  Building2,
  Rocket,
  Smartphone,
  Loader2,
  ArrowRight,
  Star,
  Shield,
  Clock,
  XCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 2500,
    employees: 15,
    icon: Zap,
    color: 'from-slate-500 to-slate-700',
    accent: 'text-slate-600',
    ring: 'ring-slate-400',
    features: [
      'Up to 15 employees',
      'Payroll engine (PAYE, NSSF, SHIF, AHL)',
      'Digital payslips',
      'Basic reports',
      'Email support',
    ],
    missing: ['Bulk bank export', 'P9 annual forms', 'Audit trail', 'Priority support'],
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    price: 6500,
    employees: 75,
    icon: Rocket,
    color: 'from-teal-500 to-emerald-600',
    accent: 'text-teal-600',
    ring: 'ring-teal-400',
    popular: true,
    features: [
      'Up to 75 employees',
      'Everything in Starter',
      'Bulk bank export (Equity, KCB, Co-op, Stanbic)',
      'P9 annual tax forms',
      'M-Pesa bulk disbursement',
      'Attendance & leave management',
      'Audit trail',
    ],
    missing: ['Dedicated account manager', 'Custom integrations'],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: 15000,
    employees: 300,
    icon: Building2,
    color: 'from-purple-500 to-indigo-600',
    accent: 'text-purple-600',
    ring: 'ring-purple-400',
    features: [
      'Up to 300 employees',
      'Everything in Growth',
      'Statutory filing (KRA PAYE, NSSF, SHIF)',
      'Custom payroll rules',
      'White-label payslips',
      'Priority email & phone support',
      'SLA guarantee',
    ],
    missing: [],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 0,
    employees: 999999,
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    accent: 'text-amber-600',
    ring: 'ring-amber-400',
    features: [
      'Unlimited employees',
      'Everything in Business',
      'Dedicated account manager',
      'Custom integrations & API',
      'On-premise option',
      '99.9% uptime SLA',
    ],
    missing: [],
  },
];

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // M-Pesa STK Push Payment States
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<typeof PLANS[0] | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'initiating' | 'pending_pin' | 'success' | 'failed' | 'timeout'>('idle');
  const [paymentError, setPaymentError] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const resetPaymentState = () => {
    setPaymentStatus('idle');
    setPaymentError('');
    setCheckoutRequestId('');
  };

  const handleCloseModal = () => {
    setSelectedPlanForPayment(null);
    resetPaymentState();
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
  };

  const pollStatus = (checkoutId: string, paymentId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    let attempts = 0;
    const maxAttempts = 24; // 60 seconds (24 * 2.5s)
    
    pollingIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get('/mpesa/stk-push/status/', {
          params: { checkout_request_id: checkoutId }
        });
        if (res.data.status === 'success') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setPaymentStatus('success');
          showToast(`✅ Plan successfully upgraded to ${res.data.plan}!`);
          queryClient.invalidateQueries({ queryKey: ['companySettings'] });
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
          setTimeout(() => {
            setSelectedPlanForPayment(null);
            resetPaymentState();
          }, 3000);
        } else if (res.data.status === 'failed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setPaymentStatus('failed');
          setPaymentError(res.data.result_desc || 'Payment failed or was cancelled.');
        }
      } catch (err: any) {
        console.error("Error polling payment status:", err);
      }
      
      if (attempts >= maxAttempts) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setPaymentStatus('timeout');
        setPaymentError('Payment confirmation timed out. If you entered your PIN, please contact support.');
      }
    }, 2500);
  };

  const handleInitiatePayment = async () => {
    if (!selectedPlanForPayment) return;
    
    let trimmedPhone = phoneNumber.trim().replace('+', '');
    if (!trimmedPhone) {
      setPaymentError('Phone number is required.');
      return;
    }
    
    setPaymentStatus('initiating');
    setPaymentError('');
    
    try {
      const res = await api.post('/mpesa/stk-push/', {
        phone: trimmedPhone,
        plan: selectedPlanForPayment.id,
        amount: selectedPlanForPayment.price
      });
      
      const { checkout_request_id, payment_id } = res.data;
      setCheckoutRequestId(checkout_request_id);
      setPaymentStatus('pending_pin');
      
      pollStatus(checkout_request_id, payment_id);
      
    } catch (err: any) {
      setPaymentStatus('failed');
      setPaymentError(err?.response?.data?.error || 'Failed to initiate M-Pesa STK Push. Try again.');
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ['companySettings'],
    queryFn: async () => {
      const res = await api.get<CompanySettings>('/settings/company/');
      return res.data;
    },
  });

  const currentPlanId = settings?.plan ?? 'STARTER';

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlanId) return;
    setUpgrading(planId);
    try {
      await api.post('/settings/company/upgrade-plan/', { plan: planId });
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      showToast(`✅ Plan upgraded to ${planId}! Features are now active.`);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Could not upgrade plan. Try again.', 'error');
    } finally {
      setUpgrading(null);
    }
  };

  const statusColors: Record<string, string> = {
    TRIAL: 'bg-amber-100 text-amber-700 border-amber-300',
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    PAST_DUE: 'bg-red-100 text-red-700 border-red-300',
    SUSPENDED: 'bg-red-100 text-red-800 border-red-300',
    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-300',
  };

  const trialDaysLeft = settings?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(settings.trial_ends_at).getTime() - Date.now()) / 86400000
        )
      )
    : null;

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-3 animate-in slide-in-from-bottom-4 ${
            toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">
          Subscription &amp; Billing
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manage your WorkWise plan. All prices in KES/month, billed monthly.
        </p>
      </div>

      {/* Current plan banner */}
      {!isLoading && settings && (
        <GlassCard className="p-6 border border-slate-200/60 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/20 flex items-center justify-center">
                <Crown className="h-6 w-6 text-teal-400" />
              </div>
              <div>
                <div className="text-sm text-slate-400 uppercase tracking-widest font-semibold">
                  Current Plan
                </div>
                <div className="text-2xl font-bold text-white font-outfit">
                  {settings.plan.charAt(0) + settings.plan.slice(1).toLowerCase()} Plan
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      statusColors[settings.subscription_status] || statusColors['ACTIVE']
                    }`}
                  >
                    {settings.subscription_status}
                  </span>
                  {settings.subscription_status === 'TRIAL' && trialDaysLeft !== null && (
                    <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {trialDaysLeft} days remaining
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Max Employees</div>
              <div className="text-3xl font-bold text-teal-400 font-outfit tabular-nums">
                {settings.max_employees >= 999999 ? '∞' : settings.max_employees}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlanId === plan.id;
          const isUpgrading = upgrading === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl border bg-white dark:bg-slate-900 overflow-hidden transition-all ${
                isCurrentPlan
                  ? `ring-2 ${plan.ring} border-transparent shadow-lg`
                  : 'border-slate-200 dark:border-slate-700 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              {plan.popular && !isCurrentPlan && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[10px] font-black uppercase tracking-widest text-center py-1.5">
                  <Star className="h-3 w-3 inline-block mr-1" />
                  Most Popular
                </div>
              )}
              {isCurrentPlan && (
                <div
                  className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${plan.color} text-white text-[10px] font-black uppercase tracking-widest text-center py-1.5`}
                >
                  <CheckCircle className="h-3 w-3 inline-block mr-1" />
                  Current Plan
                </div>
              )}

              <div className={`p-6 ${plan.popular || isCurrentPlan ? 'pt-8' : ''}`}>
                {/* Icon & name */}
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-xl font-outfit">
                  {plan.name}
                </div>

                {/* Price */}
                <div className="mt-2 mb-6">
                  {plan.price === 0 ? (
                    <div className="text-3xl font-black text-slate-900 dark:text-white font-outfit">
                      Custom
                    </div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-black text-slate-900 dark:text-white font-outfit tabular-nums">
                        {plan.price.toLocaleString()}
                      </span>
                      <span className="text-sm text-slate-500 mb-1">KES/mo</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
                    Up to {plan.employees >= 999999 ? 'unlimited' : plan.employees} employees
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 mt-0.5 shrink-0 ${plan.accent}`} />
                      <span className="text-slate-700 dark:text-slate-300">{f}</span>
                    </div>
                  ))}
                  {plan.missing.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm opacity-40">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                      <span className="text-slate-500 line-through">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Action button */}
                {plan.price === 0 ? (
                  <a
                    href="mailto:sales@workwise.co.ke?subject=Enterprise Plan Inquiry"
                    className="block w-full text-center py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    Contact Sales
                  </a>
                ) : isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-sm cursor-not-allowed"
                  >
                    <Shield className="h-4 w-4 inline-block mr-2" />
                    Active Plan
                  </button>
                ) : (
                  <Button
                    onClick={() => {
                      if (plan.id === currentPlanId) return;
                      setSelectedPlanForPayment(plan);
                    }}
                    disabled={!!upgrading}
                    className={`w-full py-3 rounded-2xl bg-gradient-to-r ${plan.color} text-white font-bold text-sm hover:opacity-90 transition-opacity h-auto`}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" /> Upgrade to {plan.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* M-Pesa payment info banner */}
      <GlassCard className="p-6 border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-800 dark:text-emerald-400 text-lg mb-1">
              Pay via M-Pesa Paybill
            </h3>
            <p className="text-emerald-700 dark:text-emerald-300 text-sm mb-3">
              Send your monthly subscription payment via M-Pesa. Your plan will be activated
              within 2 hours after payment confirmation.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-emerald-900/40 rounded-2xl p-3 text-center border border-emerald-200 dark:border-emerald-700">
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
                  Paybill
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-outfit">
                  247247
                </div>
              </div>
              <div className="bg-white dark:bg-emerald-900/40 rounded-2xl p-3 text-center border border-emerald-200 dark:border-emerald-700">
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
                  Account No.
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-outfit">
                  {settings?.id?.slice(0, 8).toUpperCase() ?? 'WW-XXXX'}
                </div>
              </div>
              <div className="bg-white dark:bg-emerald-900/40 rounded-2xl p-3 text-center border border-emerald-200 dark:border-emerald-700">
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
                  Amount (Growth)
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white font-outfit">
                  KES 6,500
                </div>
              </div>
              <div className="bg-white dark:bg-emerald-900/40 rounded-2xl p-3 text-center border border-emerald-200 dark:border-emerald-700">
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider">
                  Support
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white font-outfit">
                  billing@workwise.co.ke
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Feature comparison table */}
      <GlassCard className="border border-slate-200/60 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">
            Feature Comparison
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Feature
                </th>
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-widest ${p.accent}`}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['Payroll Engine (PAYE, NSSF, SHIF, AHL)', true, true, true, true],
                ['Digital Payslips (PDF)', true, true, true, true],
                ['Attendance & Leave', false, true, true, true],
                ['Bulk Bank Export (Equity, KCB, Co-op)', false, true, true, true],
                ['M-Pesa Bulk Disbursement', false, true, true, true],
                ['P9 Annual Tax Forms', false, true, true, true],
                ['Audit Trail', false, true, true, true],
                ['Statutory Filing (KRA, NSSF, NHIF)', false, false, true, true],
                ['Dedicated Account Manager', false, false, false, true],
                ['Custom Integrations & API', false, false, false, true],
              ].map(([feature, ...vals]) => (
                <tr key={String(feature)} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-300 font-medium">
                    {feature as string}
                  </td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {v ? (
                        <CheckCircle className={`h-5 w-5 mx-auto ${PLANS[i].accent}`} />
                      ) : (
                        <XCircle className="h-5 w-5 mx-auto text-slate-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* M-Pesa STK Push Payment Modal */}
      {selectedPlanForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseModal}
          />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
            {/* Header */}
            <div className={`p-6 bg-gradient-to-r ${selectedPlanForPayment.color} text-white`}>
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors animate-in fade-in zoom-in"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="text-xl font-bold font-outfit">Pay via M-Pesa Express</h3>
              <p className="text-xs text-white/80 mt-1">Upgrade to {selectedPlanForPayment.name} Plan</p>
            </div>

            <div className="p-6 space-y-6">
              {paymentStatus === 'idle' || paymentStatus === 'initiating' ? (
                <>
                  {/* Plan Price Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Plan Cost</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{selectedPlanForPayment.name} Plan</div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-teal-600 dark:text-teal-400 font-outfit">
                        KES {selectedPlanForPayment.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 block">/month</span>
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                      M-Pesa Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
                        +254
                      </div>
                      <input
                        type="text"
                        placeholder="708374149"
                        value={phoneNumber.startsWith('254') ? phoneNumber.slice(3) : phoneNumber.startsWith('0') ? phoneNumber.slice(1) : phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPhoneNumber(val);
                        }}
                        className="w-full pl-16 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Enter your Safaricom number. We will send a payment confirmation popup to your screen.
                    </p>
                  </div>

                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>{paymentError}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <Button
                    onClick={handleInitiatePayment}
                    disabled={paymentStatus === 'initiating'}
                    className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${selectedPlanForPayment.color} text-white font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 h-auto`}
                  >
                    {paymentStatus === 'initiating' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Initiating...
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4" />
                        Confirm &amp; Pay KES {selectedPlanForPayment.price.toLocaleString()}
                      </>
                    )}
                  </Button>
                </>
              ) : paymentStatus === 'pending_pin' ? (
                <div className="text-center py-6 space-y-6">
                  {/* Premium pulse animation */}
                  <div className="relative h-20 w-20 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping" />
                    <div className="relative h-20 w-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                      <Smartphone className="h-10 w-10 text-teal-600 animate-bounce" />
                    </div>
                  </div>

                  <div className="space-y-2 max-w-sm mx-auto">
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg font-outfit">
                      Check Your Phone
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      An M-Pesa payment prompt has been sent to Safaricom number <span className="font-semibold text-slate-800 dark:text-slate-200">+{phoneNumber.startsWith('254') ? phoneNumber : phoneNumber.startsWith('0') ? '254' + phoneNumber.slice(1) : '254' + phoneNumber}</span>.
                    </p>
                    <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      Please enter your M-Pesa PIN on your mobile device to authorize payment of KES <span className="font-semibold text-teal-600">{selectedPlanForPayment.price.toLocaleString()}</span>.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-semibold">
                    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                    Waiting for payment confirmation...
                  </div>
                </div>
              ) : paymentStatus === 'success' ? (
                <div className="text-center py-8 space-y-4">
                  <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600 shadow-lg shadow-emerald-500/10">
                    <CheckCircle className="h-12 w-12" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xl font-outfit">
                      Payment Successful!
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Your subscription has been updated. Welcome to the <span className="font-semibold text-emerald-600">{selectedPlanForPayment.name}</span> features.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-6">
                  <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-center mx-auto text-red-600">
                    <XCircle className="h-12 w-12" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg font-outfit">
                      Payment Failed
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {paymentError}
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="ghost"
                      onClick={handleCloseModal}
                      className="flex-1 rounded-xl border border-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={resetPaymentState}
                      className={`flex-1 rounded-xl bg-gradient-to-r ${selectedPlanForPayment.color} text-white font-bold`}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
