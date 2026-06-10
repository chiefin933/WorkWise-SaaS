'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { 
  Building, 
  Wallet, 
  Shield, 
  Bell, 
  Save,
  CreditCard,
  CheckCircle2,
  Lock,
  Zap,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [isSaving, setIsSaving] = useState(false);
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const tabs = [
    { id: 'company', name: 'Company Profile', icon: Building },
    { id: 'billing', name: 'Billing & Plan', icon: CreditCard },
    { id: 'payroll', name: 'Payroll Config', icon: Wallet },
    { id: 'security', name: 'Security & Access', icon: Shield },
    { id: 'notifications', name: 'Notifications', icon: Bell },
  ];

  const plans = [
    { id: 'STARTER', name: 'Starter', price: '3,500', limit: '15' },
    { id: 'GROWTH', name: 'Growth', price: '12,000', limit: '75' },
    { id: 'BUSINESS', name: 'Business', price: '35,000', limit: '300' },
  ];

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert('Settings saved successfully!');
    }, 1000);
  };

  const handleUpgrade = async () => {
    const targetPlan = selectedPlan;
    if (!targetPlan) {
      alert('Please select a plan from the list below to upgrade.');
      return;
    }
    if (targetPlan === user?.plan) {
      alert('You are already on the selected plan!');
      return;
    }

    setIsUpgrading(true);
    try {
      const res = await api.post('/settings/company/upgrade-plan/', { plan: targetPlan });
      alert(res.data.message || 'Plan successfully upgraded!');
      await fetchUser();
      setSelectedPlan(null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to upgrade plan.');
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Platform Settings</h1>
          <p className="text-slate-500 dark:text-slate-400">Configure your workspace and global preferences.</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-105 dark:text-slate-950 text-white gap-2 px-8 py-6 rounded-2xl transition-all shadow-sm font-bold"
        >
          {isSaving ? 'Saving...' : <><Save className="h-5 w-5" /> Save Changes</>}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
           <GlassCard className="p-2 border border-slate-200/60 flex flex-col">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id 
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.name}
                </button>
              ))}
           </GlassCard>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <GlassCard className="p-8 border border-slate-200/60">
            {activeTab === 'company' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Company Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Legal Name</label>
                      <input type="text" defaultValue={user?.company_name || "Crystal Gen Ltd"} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">KRA PIN</label>
                      <input type="text" placeholder="P051XXXXXX" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" />
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-8">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl bg-slate-950 dark:bg-slate-900 text-white border border-slate-850 relative overflow-hidden">
                    <div className="relative z-10">
                       <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-slate-400" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Current Plan</span>
                       </div>
                       <h3 className="text-3xl font-bold font-outfit mb-2">{user?.plan} PLAN</h3>
                       <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
                          <div className="flex items-center gap-1.5">
                             <Users className="h-4 w-4" /> {user?.max_employees} Max Employees
                          </div>
                          <div className="flex items-center gap-1.5">
                             <CheckCircle2 className="h-4 w-4" /> {user?.subscription_status}
                          </div>
                       </div>
                    </div>
                    <Button 
                      onClick={handleUpgrade}
                      disabled={isUpgrading || !selectedPlan || selectedPlan === user?.plan}
                      className="bg-white text-slate-950 hover:bg-slate-100 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 font-bold px-8 py-6 rounded-2xl relative z-10 shadow-sm disabled:bg-slate-800/40 disabled:text-slate-500"
                    >
                       {isUpgrading ? 'Upgrading...' : selectedPlan ? `Upgrade to ${plans.find(pl => pl.id === selectedPlan)?.name}` : 'Select a Plan Below'}
                    </Button>
                    <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-slate-800/10 rounded-full blur-2xl" />
                 </div>

                <div className="space-y-6">
                   <h4 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Plan Overview</h4>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       {plans.map((p) => {
                          const isCurrent = user?.plan === p.id;
                          const isSelected = selectedPlan === p.id;
                          return (
                             <div 
                               key={p.id} 
                               onClick={() => {
                                  if (!isCurrent) {
                                     setSelectedPlan(p.id);
                                  }
                               }}
                               className={`p-5 rounded-2xl border-2 transition-all select-none ${
                                  isCurrent 
                                    ? 'border-slate-950 dark:border-white bg-slate-50 dark:bg-slate-900 cursor-default opacity-85' 
                                    : isSelected
                                      ? 'border-slate-600 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer shadow-md ring-2 ring-slate-950/20 scale-[1.02]'
                                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer hover:shadow-sm'
                               }`}
                             >
                                <div className="flex justify-between items-start mb-1">
                                   <div className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</div>
                                   {isCurrent && (
                                      <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950 border border-slate-950 dark:border-white tracking-wider">Active</span>
                                   )}
                                   {isSelected && (
                                      <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800 tracking-wider">Selected</span>
                                   )}
                                </div>
                                <div className="text-xl font-black text-slate-900 dark:text-white">KES {p.price}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Up to {p.limit} Employees</div>
                             </div>
                          );
                       })}
                   </div>
                </div>

                 {user?.subscription_status === 'TRIAL' && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                       <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 flex items-center justify-center text-slate-950 dark:text-white shadow-sm">
                          <Calendar className="h-5 w-5" />
                       </div>
                       <div>
                          <div className="text-sm font-bold text-slate-950 dark:text-white">Your free trial is active.</div>
                          <div className="text-xs text-slate-500">Expires on {user?.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString() : 'N/A'}. Add a payment method to avoid interruption.</div>
                       </div>
                    </div>
                 )}
              </div>
            )}

            {activeTab === 'payroll' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Payroll Configuration</h3>
                <div className="space-y-4">
                   <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                      <div>
                         <div className="font-bold text-slate-900 dark:text-white">Auto-Calculate NHIF/SHIF</div>
                         <div className="text-xs text-slate-500">Enable automatic statutory deduction based on latest KRA guidelines.</div>
                      </div>
                      <div className="h-6 w-11 bg-slate-950 dark:bg-white rounded-full relative">
                         <div className="absolute right-1 top-1 h-4 w-4 bg-white dark:bg-slate-950 rounded-full shadow-sm" />
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
               <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Security & Access</h3>
                  <div className="space-y-6">
                     <div className="flex items-start gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <Lock className="h-6 w-6 text-slate-400 mt-1" />
                        <div>
                           <div className="font-bold text-slate-900 dark:text-white">Two-Factor Authentication</div>
                           <p className="text-sm text-slate-500 mb-4">Add an extra layer of security to your admin account.</p>
                           <Button variant="outline" className="rounded-xl border-slate-200">Enable 2FA</Button>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6 text-center py-12">
                 <Bell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Notification Preferences</h3>
                 <p className="text-slate-500 max-w-sm mx-auto">Configure how you receive alerts for payroll runs, leave requests, and system updates.</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Calendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
