'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/**
 * Generic page-number pagination bar.
 * Shows up to 7 page buttons with ellipsis for large page counts.
 */
export function Pagination({ page, pageSize, totalCount, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  // Build page number array with ellipsis markers (-1)
  const buildPages = (): (number | -1)[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | -1)[] = [1];
    if (page > 3) pages.push(-1);
    const start = Math.max(2, page - 1);
    const end   = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push(-1);
    pages.push(totalPages);
    return pages;
  };

  const from = Math.min((page - 1) * pageSize + 1, totalCount);
  const to   = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
      <p className="text-xs text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-700 dark:text-slate-300">{from}–{to}</span> of{' '}
        <span className="font-bold text-slate-700 dark:text-slate-300">{totalCount}</span> results
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700
            text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {buildPages().map((p, i) =>
          p === -1 ? (
            <span key={`ellipsis-${i}`} className="h-9 w-9 flex items-center justify-center text-slate-400 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-colors
                ${p === page
                  ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-sm'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700
            text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
