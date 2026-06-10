'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useAuthStore } from '@/lib/store';
import {
  User, Settings, CreditCard, Shield, LogOut, ChevronRight, Building2, Mail, BadgeCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { user } = useUser();
  const profile = useAuthStore((s) => s.user);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
    : '?';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/auth/login');
  };

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrator',
    HR: 'HR Manager',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  };

  const menuItems = [
    { icon: User,      label: 'My Profile',     desc: 'View & edit your details',    href: '/settings/profile', },
    { icon: Settings,  label: 'Settings',        desc: 'Account & preferences',       href: '/settings', },
    ...(profile?.role === 'ADMIN'
      ? [
          { icon: CreditCard, label: 'Billing & Plans', desc: 'Subscription management', href: '/settings/billing' },
          { icon: Shield,     label: 'Security',         desc: 'Permissions & audit log', href: '/audit' },
        ]
      : []),
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 group cursor-pointer"
        aria-label="User profile"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-sm font-bold shadow-sm group-hover:scale-105 transition-transform ring-2 ring-transparent group-hover:ring-teal-500/30">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">
            {user?.firstName || 'User'}
          </span>
          <span className="text-[11px] text-slate-400 leading-tight">
            {roleLabel[profile?.role || ''] || 'Member'}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-14 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Profile Header */}
            <div className="px-5 py-4 bg-gradient-to-br from-teal-50 to-slate-50 dark:from-teal-900/20 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-base font-bold shadow">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {user?.fullName || 'User'}
                    </p>
                    <BadgeCheck className="h-4 w-4 text-teal-500 shrink-0" />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                    <p className="text-xs text-slate-400 truncate">
                      {user?.primaryEmailAddress?.emailAddress || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                    <p className="text-xs text-slate-400 truncate">
                      {profile?.company_name || 'Organization'}
                    </p>
                  </div>
                </div>
              </div>
              {/* Role Badge */}
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-[11px] font-medium">
                  <Shield className="h-3 w-3" />
                  {roleLabel[profile?.role || ''] || 'Member'}
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-teal-50 dark:group-hover:bg-teal-900/30 transition-colors">
                      <Icon className="h-4 w-4 text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</p>
                      <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>

            {/* Logout */}
            <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-colors">
                  <LogOut className="h-4 w-4 text-slate-500 group-hover:text-red-500 transition-colors" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  Sign out
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
