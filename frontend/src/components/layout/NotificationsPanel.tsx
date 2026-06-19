'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Info, AlertTriangle, DollarSign, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import Link from 'next/link';

type NotifType = 'payroll' | 'leave' | 'employee' | 'system';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  is_read: boolean;
  action_url: string;
  created_at: string;
}

const typeConfig: Record<NotifType, { icon: React.ElementType; bg: string; color: string }> = {
  payroll:  { icon: DollarSign,    bg: 'bg-teal-100 dark:bg-teal-900/40',   color: 'text-teal-600 dark:text-teal-400' },
  leave:    { icon: AlertTriangle, bg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400' },
  employee: { icon: Users,         bg: 'bg-purple-100 dark:bg-purple-900/40', color: 'text-purple-600 dark:text-purple-400' },
  system:   { icon: Info,          bg: 'bg-blue-100 dark:bg-blue-900/40',   color: 'text-blue-600 dark:text-blue-400' },
};

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<Notification[]>('/notifications/');
      return res.data;
    }
  });

  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const dismiss = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}/`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read/`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 border-2 border-white dark:border-slate-900 rounded-full text-[10px] text-white font-bold flex items-center justify-center px-0.5">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-14 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Notifications</h3>
                {unread > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">{unread} unread</p>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 font-medium transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-slate-400">
                  <Bell className="h-8 w-8 mb-3 opacity-30" />
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                notifications.slice(0, 5).map((n) => {
                  const cfg = typeConfig[n.type] || typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markRead(n.id)}
                      className={`group flex gap-3 px-5 py-3.5 cursor-pointer transition-colors ${
                        n.is_read
                          ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          : 'bg-teal-50/60 dark:bg-teal-900/10 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                      }`}
                    >
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium leading-snug ${n.is_read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                            {n.title}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatRelativeTime(n.created_at)}</span>
                          {!n.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <Link href="/notifications" onClick={() => setOpen(false)} className="block w-full text-center text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 font-medium transition-colors">
                View all notifications →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
