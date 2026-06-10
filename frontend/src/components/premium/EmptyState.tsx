'use client';

import { motion } from 'framer-motion';
import { Plus, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  icon: LucideIcon;
}

export function EmptyState({ title, description, actionLabel, actionHref, icon: Icon }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-16 text-center rounded-[2.5rem] bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950 border border-slate-200/50 dark:border-white/5 shadow-2xl shadow-slate-200/20 dark:shadow-none backdrop-blur-xl relative overflow-hidden"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-500/10 dark:to-slate-900 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-8 text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/10 relative z-10">
        <Icon className="h-10 w-10 stroke-[1.5]" />
      </div>
      
      <h3 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white mb-3 font-outfit relative z-10">{title}</h3>
      <p className="text-sm font-medium text-slate-500 max-w-sm mb-10 leading-relaxed relative z-10">{description}</p>
      
      <Link href={actionHref} className="relative z-10">
        <Button className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 gap-3 px-8 py-6 rounded-2xl text-sm font-bold tracking-wide transition-all shadow-xl shadow-slate-900/10 group">
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
          {actionLabel}
        </Button>
      </Link>
    </motion.div>
  );
}
