'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error tracking service here (e.g. Sentry)
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="h-10 w-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-900/50">
            <span className="text-white font-bold font-outfit text-2xl">W</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white font-outfit">WorkWise</span>
        </div>

        {/* Icon */}
        <div className="h-24 w-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-8">
          <AlertTriangle className="h-12 w-12 text-red-400" />
        </div>

        {/* Message */}
        <h1 className="text-4xl font-black text-white font-outfit mb-4">Something went wrong</h1>
        <p className="text-slate-500 text-sm mb-3 leading-relaxed">
          An unexpected error occurred. Our team has been notified.
          You can try again or return to your dashboard.
        </p>
        {error?.digest && (
          <p className="text-xs text-slate-600 font-mono mb-8">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all text-sm font-bold w-full sm:w-auto justify-center"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white transition-all text-sm font-bold w-full sm:w-auto justify-center"
          >
            <Home className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
