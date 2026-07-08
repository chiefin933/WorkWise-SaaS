'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import Sidebar from './Sidebar';
import { Search, Sun, Moon, Users, Loader2, X, AlertTriangle } from 'lucide-react';
import NotificationsPanel from './NotificationsPanel';
import HelpPanel from './HelpPanel';
import ProfileDropdown from './ProfileDropdown';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';

// ── Search types ──────────────────────────────────────────────────────────────
interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  status: string;
}

// ── Global Search bar ─────────────────────────────────────────────────────────
function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — fires 300 ms after the user stops typing
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.get('/employees/', {
        params: { search: q, page_size: 8 },
      });
      // Handle both paginated envelope and plain array
      const raw = res.data;
      const items: SearchResult[] = Array.isArray(raw)
        ? raw
        : (raw.results ?? []);
      setResults(items);
      setIsOpen(true);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (result: SearchResult) => {
    router.push(`/employees/${result.id}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') handleClear();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="relative group">
        {isLoading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search employees..."
          aria-label="Global search"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          className="w-full bg-slate-100 dark:bg-slate-800/50 border-transparent focus:bg-white dark:focus:bg-slate-800 border focus:border-teal-500/30 rounded-xl py-2.5 pl-10 pr-8 text-sm outline-none transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div
          ref={panelRef}
          role="listbox"
          className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              No employees found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((r, idx) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(r)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs flex-shrink-0">
                    {r.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {r.email ?? ''}
                      {r.department ? ` · ${r.department}` : ''}
                    </p>
                  </div>
                  {/* Status badge */}
                  <span className={`flex-shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    r.status === 'active'
                      ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800'
                  }`}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            <span className="ml-auto text-xs text-slate-400 hidden sm:block">
              ↑↓ navigate · Enter select · Esc close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, isSignedIn, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const { theme, setTheme } = useTheme();
  const isAuthPage = pathname.startsWith('/auth');

  // ClerkTokenProvider owns fetchUser — we only read the result here.
  const { user, hasFetched, isLoading, fetchError } = useAuthStore();

  // Compute days remaining on trial
  const trialDaysLeft = (() => {
    if (!user?.trial_ends_at || user?.subscription_status !== 'TRIAL') return null;
    const diff = new Date(user.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();
  const showTrialBanner = trialDaysLeft !== null && trialDaysLeft <= 7;

  // Public pages bypass the auth guard — marketing page and pricing are accessible without login
  const isPublicPage = pathname === '/' || pathname.startsWith('/pricing');

  useEffect(() => {
    if (!isAuthPage && !isPublicPage && clerkLoaded && !isSignedIn) {
      router.push('/auth/login');
    }
  }, [isAuthPage, isPublicPage, clerkLoaded, isSignedIn, router]);

  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  if (!clerkLoaded || (!hasFetched && !fetchError) || isLoading) {
    return (
      <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 items-center justify-center">
        <div className="h-10 w-10 border-4 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  // User logged into Clerk but not in WorkWise DB — not a registered company
  if (fetchError === 'no_user') {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="h-16 w-16 mx-auto bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white font-outfit mb-3">Account not found</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Your account is not registered in WorkWise. You need to be invited by your company&apos;s administrator,
            or create a new company workspace.
          </p>
          <div className="flex flex-col gap-3">
            <a href="/auth/register"
              className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-all">
              Create a Company Workspace
            </a>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="px-6 py-3 rounded-2xl border border-white/10 text-slate-400 hover:text-white font-bold text-sm transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center px-8 z-30 sticky top-0">
          <GlobalSearch />
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
          {/* Trial expiry warning banner */}
          {showTrialBanner && (
            <div className={`mb-6 flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium ${
              trialDaysLeft === 0
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
            }`}>
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="flex-1">
                {trialDaysLeft === 0
                  ? 'Your free trial has ended. Upgrade now to keep using WorkWise.'
                  : `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}. Upgrade to keep uninterrupted access.`
                }
              </span>
              <Link
                href="/settings/billing"
                className="shrink-0 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
              >
                Upgrade Now
              </Link>
            </div>
          )}
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
