'use client';

import Link from 'next/link';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
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
        <div className="h-24 w-24 rounded-3xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-8">
          <FileQuestion className="h-12 w-12 text-teal-400" />
        </div>

        {/* Message */}
        <h1 className="text-6xl font-black text-white font-outfit mb-4">404</h1>
        <h2 className="text-xl font-bold text-slate-300 mb-3">Page not found</h2>
        <p className="text-slate-500 text-sm mb-10 leading-relaxed">
          The page you are looking for doesn&apos;t exist or has been moved.
          Check the URL or go back to your dashboard.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all text-sm font-bold w-full sm:w-auto justify-center"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
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
