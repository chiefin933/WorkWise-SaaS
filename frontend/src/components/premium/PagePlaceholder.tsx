'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/premium/GlassCard';
import { Construction } from 'lucide-react';

interface PagePlaceholderProps {
  title: string;
  description: string;
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <div className="mb-8 inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 animate-float">
          <Construction className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-4">{title}</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mb-10">
          {description}
        </p>
        
        <GlassCard className="p-8 border border-slate-200/60 shadow-xl rounded-3xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 text-left">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Module Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Under Construction</span>
              <div className="h-2 w-32 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 w-[60%] animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
              Our engineering team is finalizing the data models and premium interface for this module. Expected release: Q3 2026.
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
