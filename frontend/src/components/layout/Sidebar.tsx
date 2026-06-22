'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useAuthStore } from '@/lib/store';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  Calendar, 
  DollarSign, 
  FileText, 
  Settings, 
  LogOut,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Shield,
  CreditCard,
  UserCircle,
  Receipt,
  PiggyBank,
  Banknote,
  BookOpen,
  BarChart3,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const profile = useAuthStore((s) => s.user);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const role = profile?.role;
  const canManagePeople = role === 'ADMIN' || role === 'HR';
  const canManageFinance = role === 'ADMIN' || role === 'FINANCE';
  const isCEO = role === 'ADMIN';

  const navItems = [
    // ── CEO / Admin only ────────────────────────────────────────────────────
    ...(isCEO
      ? [{ name: 'CEO Dashboard', href: '/', icon: LayoutDashboard }]
      : []),

    // ── HR section ──────────────────────────────────────────────────────────
    ...(canManagePeople
      ? [
          { name: 'HR Dashboard',  href: '/hr',        icon: Briefcase },
          { name: 'Employees',     href: '/employees', icon: Users },
          { name: 'Attendance',    href: '/attendance', icon: Clock },
          { name: 'Leave',         href: '/leave',     icon: Calendar },
          { name: 'Payroll',       href: '/payroll',   icon: DollarSign },
          { name: 'Reports',       href: '/reports',   icon: FileText },
        ]
      : []),

    // ── Finance section ─────────────────────────────────────────────────────
    ...(canManageFinance
      ? [
          { name: 'Finance',        href: '/finance',                   icon: DollarSign },
          { name: 'Expenses',       href: '/finance/expenses',          icon: Receipt },
          { name: 'Budgets',        href: '/finance/budgets',           icon: PiggyBank },
          { name: 'Petty Cash',     href: '/finance/petty-cash',        icon: Banknote },
          { name: 'Accounts',       href: '/finance/books/accounts',    icon: BookOpen },
          { name: 'Journal',        href: '/finance/books/journal',     icon: FileText },
          { name: 'Reports',        href: '/finance/books/reports',     icon: BarChart3 },
        ]
      : []),

    // ── Employee self-service ────────────────────────────────────────────────
    ...(role === 'EMPLOYEE'
      ? [
          { name: 'My Dashboard',   href: '/employee',                 icon: LayoutDashboard },
          { name: 'My Attendance',  href: '/attendance',               icon: Clock },
          { name: 'My Leave',       href: '/leave',                    icon: Calendar },
          { name: 'My Payslips',    href: '/manager/self-service',     icon: FileText },
          { name: 'My Expenses',    href: '/finance/expenses',         icon: Receipt },
        ]
      : []),

    // ── Admin-only ───────────────────────────────────────────────────────────
    ...(isCEO
      ? [
          { name: 'Audit Trail', href: '/audit',           icon: Shield },
          { name: 'Billing',     href: '/settings/billing', icon: CreditCard },
        ]
      : []),

    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await signOut();
    router.push('/auth/login');
  };

  const initials = user 
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
    : '...';

  return (
    <div className={`flex h-full flex-col bg-slate-900 text-slate-300 shadow-xl relative z-20 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'}`}>
      <div className="flex h-20 shrink-0 items-center px-4 justify-between">
        <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'px-1' : 'px-4'}`}>
          <div className="h-10 w-10 shrink-0 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-slate-900 font-bold font-outfit text-xl leading-none">W</span>
          </div>
          {!isCollapsed && <span className="text-2xl font-bold tracking-tight text-white font-outfit whitespace-nowrap">Workwise</span>}
        </div>
      </div>

      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 bg-slate-800 border border-slate-700 text-white rounded-full p-1.5 hover:bg-slate-700 hover:border-slate-600 transition-colors z-50 shadow-md"
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className="flex flex-1 flex-col overflow-y-auto pt-6 pb-4 custom-scrollbar overflow-x-hidden">
        <div className={`px-4 mb-6 ${isCollapsed ? 'items-center flex flex-col' : ''}`}>
           {!isCollapsed && <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">Main Menu</div>}
           <nav className="space-y-1.5 w-full">
             {navItems.map((item) => {
               const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
               return (
                 <Link
                   key={item.name}
                   href={item.href}
                   title={isCollapsed ? item.name : undefined}
                   className="relative group block"
                 >
                   <div
                     className={`flex items-center rounded-xl py-3 text-sm font-medium transition-all duration-200 ${
                       isCollapsed ? 'justify-center px-0' : 'px-4'
                     } ${
                       isActive
                         ? 'text-white'
                         : 'text-slate-400 hover:text-white hover:bg-white/5'
                     }`}
                   >
                     {isActive && (
                       <div className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl" />
                     )}
                     <item.icon
                       className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 transition-all duration-200 ${
                         isActive ? 'text-white scale-105' : 'text-slate-500 group-hover:text-slate-300'
                       }`}
                     />
                     {!isCollapsed && <span className="relative z-10">{item.name}</span>}
                     {!isCollapsed && isActive && (
                       <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                     )}
                   </div>
                 </Link>
               );
             })}
           </nav>
           {!isCollapsed && role === 'EMPLOYEE' && (
             <div className="mt-6 rounded-xl border border-slate-800 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-500">
               Your HR team manages Payroll &amp; Reports. Use the menu above for self-service.
             </div>
           )}
           {!isCollapsed && role === 'FINANCE' && (
             <div className="mt-6 rounded-xl border border-teal-800/30 bg-teal-500/5 px-4 py-3 text-xs leading-relaxed text-teal-400/80">
               You have access to the Finance module. Contact your Admin for HR or Payroll access.
             </div>
           )}
           {!isCollapsed && role === 'HR' && (
             <div className="mt-6 rounded-xl border border-slate-800 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-500">
               You manage HR operations. Contact your Admin for Finance or Billing access.
             </div>
           )}
          {!isCollapsed && !role && (
             <div className="mt-6 rounded-xl border border-amber-800/30 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-500/80">
               Your account is being set up. If this persists, contact your administrator.
             </div>
           )}
        </div>
      </div>

      <div className="flex shrink-0 p-4 mb-4 border-t border-slate-800/40">
        <div className="w-full">
          <div className={`flex items-center mb-4 ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
            <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-bold shadow-sm">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-white truncate">
                  {user ? user.fullName : 'Loading...'}
                </span>
                <span className="text-[10px] text-slate-500 truncate">
                  {profile?.company_name || user?.primaryEmailAddress?.emailAddress || 'Organization'}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Logout' : undefined}
            className={`group flex items-center rounded-xl py-2 text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 ${isCollapsed ? 'justify-center w-full px-0' : 'w-full px-3'}`}
          >
            <LogOut className={`${isCollapsed ? '' : 'mr-2.5'} h-4 w-4 transition-colors`} />
            {!isCollapsed && 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}
