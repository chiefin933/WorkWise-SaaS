'use client';
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '@/components/premium/GlassCard';
import { useAuthStore } from '@/lib/store';
import { useUser } from '@clerk/nextjs';
import api from '@/lib/api';
import type { TeamMember } from '@/lib/types';
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
  Users,
  UserPlus,
  Trash2,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Change Password Form ──────────────────────────────────────────────────────
function ChangePasswordForm() {
  const { user: clerkUser } = useUser();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPwd.length < 8) {
      setMessage({ text: 'New password must be at least 8 characters.', type: 'error' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await clerkUser?.updatePassword({ currentPassword: currentPwd, newPassword: newPwd });
      setMessage({ text: 'Password changed successfully.', type: 'success' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setMessage({
        text: clerkErr.errors?.[0]?.message || 'Failed to change password.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <div className="relative">
        <input
          type={showCurrent ? 'text' : 'password'}
          value={currentPwd}
          onChange={e => setCurrentPwd(e.target.value)}
          placeholder="Current password"
          required
          className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button type="button" tabIndex={-1} onClick={() => setShowCurrent(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="relative">
        <input
          type={showNew ? 'text' : 'password'}
          value={newPwd}
          onChange={e => setNewPwd(e.target.value)}
          placeholder="New password (min. 8 characters)"
          required
          className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <input
        type="password"
        value={confirmPwd}
        onChange={e => setConfirmPwd(e.target.value)}
        placeholder="Confirm new password"
        required
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      {message && (
        <p className={`text-sm font-semibold ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all flex items-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const queryClient = useQueryClient();

  // Profile form — available to ALL roles
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [companyForm, setCompanyForm] = useState({
    name: '',
    kra_pin: '',
    phone: '',
    address: '',
  });

  const [payrollForm, setPayrollForm] = useState({
    nssf_rate: '6',
    nssf_cap: '4320',
    shif_rate: '2.75',
    shif_min: '300',
    ahl_rate: '1.5',
    personal_relief: '2400',
  });

  const { data: companyData, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const res = await api.get('/settings/company/');
      return res.data;
    },
  });

  const { data: payrollConfig, isLoading: isPayrollLoading } = useQuery({
    queryKey: ['payroll-config'],
    queryFn: async () => {
      const res = await api.get('/settings/payroll/');
      return res.data;
    },
  });

  const { data: notificationPrefs, isLoading: isNotificationsLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await api.get('/settings/notifications/');
      return res.data;
    },
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || '',
        last_name:  user.last_name  || '',
      });
    }
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      await api.patch('/users/me/', {
        first_name: profileForm.first_name.trim(),
        last_name:  profileForm.last_name.trim(),
      });
      await fetchUser();
      setProfileMsg({ text: 'Profile updated successfully.', ok: true });
    } catch {
      setProfileMsg({ text: 'Failed to save profile.', ok: false });
    } finally {
      setIsSavingProfile(false);
    }
  }

  useEffect(() => {
    if (companyData) {
      setCompanyForm({
        name: companyData.name || '',
        kra_pin: companyData.kra_pin || '',
        phone: companyData.phone || '',
        address: companyData.address || '',
      });
    }
  }, [companyData]);

  useEffect(() => {
    if (payrollConfig) {
      setPayrollForm({
        nssf_rate: String((parseFloat(payrollConfig.nssf_rate) * 100).toFixed(2)),
        nssf_cap: String(parseFloat(payrollConfig.nssf_cap)),
        shif_rate: String((parseFloat(payrollConfig.shif_rate) * 100).toFixed(2)),
        shif_min: String(parseFloat(payrollConfig.shif_min)),
        ahl_rate: String((parseFloat(payrollConfig.ahl_rate) * 100).toFixed(2)),
        personal_relief: String(parseFloat(payrollConfig.personal_relief)),
      });
    }
  }, [payrollConfig]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteRole, setInviteRole] = useState<'HR' | 'FINANCE' | 'EMPLOYEE'>('EMPLOYEE');
  const [inviteError, setInviteError] = useState('');
  const [inviteToast, setInviteToast] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const tabs = [
    { id: 'profile',  name: 'My Profile',        icon: UserCircle },
    { id: 'company',  name: 'Company Profile',    icon: Building },
    { id: 'billing',  name: 'Billing & Plan',     icon: CreditCard },
    { id: 'payroll',  name: 'Payroll Config',     icon: Wallet },
    ...(user?.role === 'ADMIN' ? [{ id: 'team', name: 'Team Members', icon: Users }] : []),
    { id: 'security',       name: 'Security & Access', icon: Shield },
    { id: 'notifications',  name: 'Notifications',     icon: Bell },
  ];



  const { data: teamMembers, isLoading: isTeamLoading } = useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    enabled: user?.role === 'ADMIN',
    queryFn: async () => {
      const res = await api.get<TeamMember[]>('/users/team/');
      return res.data;
    },
  });

  const showInviteToast = (message: string) => {
    setInviteToast(message);
    setTimeout(() => setInviteToast(''), 4000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === 'company') {
        if (user?.role !== 'ADMIN') {
          alert('Only administrators can change company settings.');
          return;
        }
        await api.patch('/settings/company/', companyForm);
        await queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        await fetchUser();
      } else if (activeTab === 'payroll') {
        if (user?.role !== 'ADMIN') {
          alert('Only administrators can change payroll config.');
          return;
        }
        const payload = {
          nssf_rate: parseFloat(payrollForm.nssf_rate) / 100,
          nssf_cap: parseFloat(payrollForm.nssf_cap),
          shif_rate: parseFloat(payrollForm.shif_rate) / 100,
          shif_min: parseFloat(payrollForm.shif_min),
          ahl_rate: parseFloat(payrollForm.ahl_rate) / 100,
          personal_relief: parseFloat(payrollForm.personal_relief),
        };
        await api.patch('/settings/payroll/', payload);
        await queryClient.invalidateQueries({ queryKey: ['payroll-config'] });
      }
      alert('Settings saved successfully!');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };



  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteError('');
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError('Enter an email address to invite.');
      return;
    }

    setIsInviting(true);
    try {
      await api.post('/users/invite/', {
        email,
        role: inviteRole,
        first_name: inviteFirstName.trim(),
        last_name: inviteLastName.trim(),
      });
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      setInviteRole('EMPLOYEE');
      await queryClient.invalidateQueries({ queryKey: ['team-members'] });
      showInviteToast(`✓ Login credentials sent to ${email}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      setInviteError(error.response?.data?.error || error.response?.data?.detail || 'Could not send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (member: TeamMember) => {
    setRevokingId(member.id);
    setInviteError('');
    try {
      await api.delete(`/users/invite/${member.id}/`);
      await queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      setInviteError(error.response?.data?.error || error.response?.data?.detail || 'Could not revoke invite.');
    } finally {
      setRevokingId(null);
    }
  };

  const roleBadgeClass = (role: TeamMember['role']) => {
    if (role === 'ADMIN') return 'bg-slate-100 text-slate-700 border-slate-300';
    if (role === 'HR') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (role === 'FINANCE') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const roleLabel = (role: TeamMember['role']) => {
    if (role === 'ADMIN') return 'Admin';
    if (role === 'HR') return 'HR Manager';
    if (role === 'FINANCE') return 'Finance Manager';
    return 'Employee';
  };

  const memberName = (member: TeamMember) => {
    const fullName = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
    return fullName || member.email;
  };

  const memberInitials = (member: TeamMember) => {
    const name = memberName(member);
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-8">
      {inviteToast && (
        <div className="fixed bottom-6 right-6 z-[100] rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {inviteToast}
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Platform Settings</h1>
          <p className="text-slate-500 dark:text-slate-400">Configure your workspace and global preferences.</p>
        </div>
        {(activeTab === 'company' || activeTab === 'payroll') && (
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-105 dark:text-slate-950 text-white gap-2 px-8 py-6 rounded-2xl transition-all shadow-sm font-bold"
          >
            {isSaving ? 'Saving...' : <><Save className="h-5 w-5" /> Save Changes</>}
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
           <GlassCard className="p-2 border border-slate-200/60 flex flex-col">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'billing') {
                      router.push('/settings/billing');
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
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

            {/* ── My Profile tab — available to ALL roles ─────────────────── */}
            {activeTab === 'profile' && (
              <div className="space-y-8 max-w-lg">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-1">My Profile</h3>
                  <p className="text-sm text-slate-500">This is how your name appears across WorkWise — including greeting messages and payslips.</p>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-5">
                  <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
                    <span className="text-white font-black text-2xl font-outfit">
                      {(profileForm.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">
                      {profileForm.first_name || profileForm.last_name
                        ? `${profileForm.first_name} ${profileForm.last_name}`.trim()
                        : 'Your Name'}
                    </p>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                    <span className={`inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      user?.role === 'ADMIN'   ? 'bg-slate-100 text-slate-700 border-slate-300' :
                      user?.role === 'HR'      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      user?.role === 'FINANCE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {user?.role === 'ADMIN' ? 'Administrator' :
                       user?.role === 'HR' ? 'HR Manager' :
                       user?.role === 'FINANCE' ? 'Finance Manager' : 'Employee'}
                    </span>
                  </div>
                </div>

                {/* Name form */}
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">First Name</label>
                      <input
                        type="text"
                        value={profileForm.first_name}
                        onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                        placeholder="Simon"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                      <input
                        type="text"
                        value={profileForm.last_name}
                        onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                        placeholder="Kamau"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                    <input type="email" value={user?.email ?? ''} disabled
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm cursor-not-allowed" />
                    <p className="text-xs text-slate-400">Email is managed by your organisation. Contact your admin to change it.</p>
                  </div>
                  {profileMsg && (
                    <p className={`text-sm font-semibold ${profileMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                      {profileMsg.text}
                    </p>
                  )}
                  <button type="submit" disabled={isSavingProfile}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-bold transition-all">
                    {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save Name</>}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'company' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Company Profile</h3>
                {isCompanyLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Legal Name</label>
                        <input 
                          type="text" 
                          value={companyForm.name} 
                          onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                          disabled={user?.role !== 'ADMIN'}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">KRA PIN</label>
                        <input 
                          type="text" 
                          placeholder="P051XXXXXX" 
                          value={companyForm.kra_pin} 
                          onChange={(e) => setCompanyForm({ ...companyForm, kra_pin: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                          disabled={user?.role !== 'ADMIN'}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Phone</label>
                        <input 
                          type="text" 
                          placeholder="+254 700 000 000" 
                          value={companyForm.phone} 
                          onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                          disabled={user?.role !== 'ADMIN'}
                        />
                     </div>
                     <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Address</label>
                        <textarea 
                          placeholder="P.O. Box 12345, Nairobi" 
                          value={companyForm.address} 
                          onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none resize-none h-24" 
                          disabled={user?.role !== 'ADMIN'}
                        />
                     </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payroll' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Payroll Configuration</h3>
                {isPayrollLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">NSSF Rate (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={payrollForm.nssf_rate} 
                        onChange={(e) => setPayrollForm({ ...payrollForm, nssf_rate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">NSSF Cap (KES)</label>
                      <input 
                        type="number" 
                        value={payrollForm.nssf_cap} 
                        onChange={(e) => setPayrollForm({ ...payrollForm, nssf_cap: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">SHIF Rate (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={payrollForm.shif_rate} 
                        onChange={(e) => setPayrollForm({ ...payrollForm, shif_rate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">SHIF Minimum (KES)</label>
                      <input 
                        type="number" 
                        value={payrollForm.shif_min} 
                        onChange={(e) => setPayrollForm({ ...payrollForm, shif_min: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">AHL Rate (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={payrollForm.ahl_rate} 
                        onChange={(e) => setPayrollForm({ ...payrollForm, ahl_rate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Personal Relief (KES)</label>
                      <input 
                        type="number" 
                        value={payrollForm.personal_relief} 
                        onChange={(e) => setPayrollForm({ ...payrollForm, personal_relief: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 outline-none" 
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'team' && user?.role === 'ADMIN' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Team Members</h3>
                  <p className="mt-1 text-sm text-slate-500">Invite HR managers and employees into your workspace.</p>
                </div>

                <form
                  onSubmit={handleInvite}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Add Team Member — login credentials will be emailed automatically
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      placeholder="First name"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    <input
                      type="text"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      placeholder="Last name"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="colleague@company.co.ke"
                      required
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as 'HR' | 'FINANCE' | 'EMPLOYEE')}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="HR">HR Manager</option>
                      <option value="FINANCE">Finance Manager</option>
                      <option value="EMPLOYEE">Employee</option>
                    </select>
                    <Button
                      type="submit"
                      disabled={isInviting}
                      className="h-11 rounded-xl bg-teal-600 px-5 font-bold text-white hover:bg-teal-700"
                    >
                      {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Send Credentials</>}
                    </Button>
                  </div>
                </form>

                {inviteError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    <AlertCircle className="h-4 w-4" /> {inviteError}
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/60">
                        <tr>
                          <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-400">Member</th>
                          <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-400">Role</th>
                          <th className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                          <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-widest text-slate-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {isTeamLoading ? (
                          [...Array(3)].map((_, index) => (
                            <tr key={index} className="animate-pulse">
                              <td colSpan={4} className="px-5 py-5">
                                <div className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
                              </td>
                            </tr>
                          ))
                        ) : (teamMembers ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">
                              No team members found.
                            </td>
                          </tr>
                        ) : (
                          (teamMembers ?? []).map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {memberInitials(member)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{memberName(member)}</div>
                                    <div className="truncate text-xs text-slate-400">{member.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${roleBadgeClass(member.role)}`}>
                                  {roleLabel(member.role)}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                {member.invite_pending ? (
                                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                    Invite Pending
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                {member.invite_pending ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRevoke(member)}
                                    disabled={revokingId === member.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {revokingId === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    Revoke
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
               <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Security &amp; Access</h3>
                  <div className="space-y-4">
                     {/* Change Password */}
                     <div className="flex items-start gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <Lock className="h-6 w-6 text-teal-500 mt-0.5 shrink-0" />
                        <div className="flex-1">
                           <div className="font-bold text-slate-900 dark:text-white mb-1">Change Password</div>
                           <p className="text-sm text-slate-500 mb-4">
                             Update your password. If you were invited, change the temporary password you received by email.
                           </p>
                           <ChangePasswordForm />
                        </div>
                     </div>
                     {/* 2FA */}
                     <div className="flex items-start gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <Shield className="h-6 w-6 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                           <div className="font-bold text-slate-900 dark:text-white mb-1">Two-Factor Authentication</div>
                           <p className="text-sm text-slate-500 mb-4">
                             Add an extra layer of security. Managed via your Clerk account settings.
                           </p>
                           <a
                             href="https://accounts.clerk.dev/user"
                             target="_blank"
                             rel="noopener noreferrer"
                             className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                           >
                             Manage Security Settings →
                           </a>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit mb-6">Notification Preferences</h3>
                 {isNotificationsLoading ? (
                   <div className="flex justify-center items-center py-12">
                     <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                   </div>
                 ) : (
                   <div className="space-y-4">
                      {[
                         { key: 'payroll_run', title: 'Payroll Run Processed', desc: 'Receive email notification when a payroll run status is changed to paid.' },
                         { key: 'leave_status', title: 'Leave Request Approved/Rejected', desc: 'Receive email notification when your leave request is updated.' },
                         { key: 'new_member', title: 'New Team Member Joined', desc: 'Get notified when a new employee accepts their workspace invitation.' },
                         { key: 'trial_expiry', title: 'Trial Expiry Warning', desc: 'Receive warnings about workspace trial duration and payment status.' },
                      ].map((pref) => {
                         const isEnabled = (notificationPrefs as Record<string, boolean>)?.[pref.key] !== false; // default to true
                         return (
                            <div key={pref.key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                               <div className="text-left">
                                  <div className="font-bold text-slate-900 dark:text-white">{pref.title}</div>
                                  <div className="text-xs text-slate-500">{pref.desc}</div>
                               </div>
                               <button
                                  onClick={async () => {
                                     const currentPrefs = (notificationPrefs as Record<string, boolean>) || {};
                                     const newPrefs = {
                                        ...currentPrefs,
                                        [pref.key]: !isEnabled,
                                     };
                                     try {
                                        await api.patch('/settings/notifications/', newPrefs);
                                        queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
                                        await fetchUser();
                                     } catch (err) {
                                        console.error('Failed to update notification preferences:', err);
                                        alert('Failed to update preferences.');
                                     }
                                  }}
                                  className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                                     isEnabled ? 'bg-slate-950 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'
                                  }`}
                                >
                                  <div className={`absolute top-1 h-4 w-4 bg-white dark:bg-slate-950 rounded-full shadow-sm transition-all duration-200 ${
                                     isEnabled ? 'right-1' : 'left-1'
                                  }`} />
                               </button>
                            </div>
                         );
                      })}
                   </div>
                 )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

