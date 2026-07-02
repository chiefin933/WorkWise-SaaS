'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Global error boundary — catches errors in the root layout itself.
 * Must include <html> and <body> since the layout is broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global app error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="h-20 w-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Critical Error</h1>
          <p className="text-slate-500 text-sm mb-8">
            A critical error occurred and the application could not load.
            {error?.digest && (
              <span className="block mt-2 text-xs text-slate-600 font-mono">
                Error ID: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-all"
          >
            <RefreshCw className="h-4 w-4" /> Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
