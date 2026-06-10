'use client';

import React from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

export const TiltCard: React.FC<TiltCardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md ${className}`}
    >
      <div className="h-full w-full">
        {children}
      </div>
    </div>
  );
};
