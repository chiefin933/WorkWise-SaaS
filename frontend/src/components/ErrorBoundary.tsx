'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Global React error boundary.
 * Catches unhandled render errors and shows a friendly recovery screen
 * instead of a blank white page.
 *
 * Must be a class component — React's error boundary API is class-only.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production Sentry will pick this up automatically via its SDK.
    // Log here as a fallback for local dev visibility.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-10 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-3">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
            An unexpected error occurred while rendering this page. This has been logged automatically.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.errorMessage && (
            <pre className="mt-4 text-left text-xs bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words">
              {this.state.errorMessage}
            </pre>
          )}

          <div className="flex gap-3 mt-8 justify-center">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-6 py-3 bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white font-bold rounded-xl transition-colors text-sm shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors text-sm"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
