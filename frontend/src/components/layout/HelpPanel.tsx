'use client';

import { useState, useEffect, useRef } from 'react';
import { HelpCircle, BookOpen, MessageCircle, Video, FileText, ExternalLink, Search, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const helpLinks = [
  {
    category: 'Getting Started',
    items: [
      { icon: BookOpen, label: 'Documentation', desc: 'Full user guide & API reference', href: '#', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
      { icon: Video, label: 'Video Tutorials', desc: 'Step-by-step walkthroughs', href: '#', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/40' },
    ],
  },
  {
    category: 'Support',
    items: [
      { icon: MessageCircle, label: 'Live Chat', desc: 'Chat with our support team', href: '#', color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/40' },
      { icon: FileText, label: 'Submit a Ticket', desc: 'Get help via email support', href: '#', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40' },
    ],
  },
];

const faqs = [
  { q: 'How do I run payroll?', href: '#' },
  { q: 'How to add a new employee?', href: '#' },
  { q: 'How does leave approval work?', href: '#' },
  { q: 'How to export bank files?', href: '#' },
];

export default function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredFaqs = faqs.filter((f) => f.q.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        aria-label="Help & Support"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-14 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Help & Support</h3>
              <p className="text-xs text-slate-400 mt-0.5">Find answers or reach out to us</p>
              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search help..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-transparent rounded-lg py-2 pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-teal-500/30 transition-all text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
              {/* Quick Links */}
              {!search && (
                <div className="px-5 py-3">
                  {helpLinks.map((section) => (
                    <div key={section.category} className="mb-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{section.category}</p>
                      <div className="space-y-1.5">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <a
                              key={item.label}
                              href={item.href}
                              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.bg}`}>
                                <Icon className={`h-4 w-4 ${item.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</p>
                                <p className="text-xs text-slate-400 truncate">{item.desc}</p>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FAQs */}
              <div className="px-5 pb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {search ? 'Search Results' : 'Popular Questions'}
                </p>
                {filteredFaqs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No results for &quot;{search}&quot;</p>
                ) : (
                  <div className="space-y-1">
                    {filteredFaqs.map((faq) => (
                      <a
                        key={faq.q}
                        href={faq.href}
                        className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                      >
                        <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{faq.q}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <p className="text-xs text-center text-slate-400">
                Still stuck?{' '}
                <a href="mailto:support@workwise.co.ke" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">
                  Email support
                </a>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
