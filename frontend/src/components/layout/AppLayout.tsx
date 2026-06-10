'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import Sidebar from './Sidebar';
import { Search, Sun, Moon } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import HelpPanel from './HelpPanel';
import ProfileDropdown from './ProfileDropdown';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsMounted(true); }, []);
  const { theme, setTheme } = useTheme();
  const isAuthPage = pathname.startsWith('/auth');

  useEffect(() => {
    if (!isAuthPage && isLoaded && !isSignedIn) {
      router.push('/auth/login');
    }
  }, [isAuthPage, isLoaded, isSignedIn, router]);

  // Auth pages render immediately so Clerk SignIn/SignUp can mount
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Show loading spinner until Clerk is ready (dashboard only)
  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-[#F8FAFC] items-center justify-center">
        <div className="h-10 w-10 border-4 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Don't render dashboard if not signed in (redirect in progress)
  if (!isSignedIn) return null;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center px-8 z-30 sticky top-0">
          <div className="flex-1 max-w-xl">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full bg-slate-100 dark:bg-slate-800/50 border-transparent focus:bg-white dark:focus:bg-slate-800 border focus:border-teal-500/30 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all"
                />
             </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <HelpPanel />
            {!isMounted ? (
              <div className="w-10 h-10" />
            ) : (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            )}
            <NotificationsPanel />
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
            <ProfileDropdown />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
