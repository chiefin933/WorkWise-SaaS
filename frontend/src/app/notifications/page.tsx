'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { formatRelativeTime } from '@/lib/format';
import { 
  Bell, 
  CheckCheck, 
  X, 
  Check, 
  DollarSign, 
  Palmtree, 
  Users, 
  Info, 
  ArrowRight 
} from 'lucide-react';
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

const typeConfig: Record<NotifType, { icon: React.ElementType; bg: string; color: string; label: string; emoji: string }> = {
  payroll:  { icon: DollarSign,    bg: 'bg-teal-50 dark:bg-teal-950/40 border-teal-100 dark:border-teal-900/50',   color: 'text-teal-600 dark:text-teal-400', label: 'Payroll', emoji: '💰' },
  leave:    { icon: Palmtree,      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50', color: 'text-amber-600 dark:text-amber-400', label: 'Leave', emoji: '🌴' },
  employee: { icon: Users,         bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/50', color: 'text-purple-600 dark:text-purple-400', label: 'Employee', emoji: '👥' },
  system:   { icon: Info,          bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50',   color: 'text-blue-600 dark:text-blue-400', label: 'System', emoji: '⚙️' },
};

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [activeType, setActiveType] = useState<NotifType | 'all'>('all');
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<Notification[]>('/notifications/');
      return res.data;
    }
  });

  // Calculate counts based on current data
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const readCount = notifications.filter((n) => n.is_read).length;

  // Filter based on selected tab and category type
  const filteredNotifications = notifications.filter((n) => {
    // Tab filter
    if (activeTab === 'unread' && n.is_read) return false;
    if (activeTab === 'read' && !n.is_read) return false;
    
    // Category type filter
    if (activeType !== 'all' && n.type !== activeType) return false;
    
    return true;
  });

  // Split filtered list into Unread and Read sections
  const unreadSectionList = filteredNotifications.filter((n) => !n.is_read);
  const readSectionList = filteredNotifications.filter((n) => n.is_read);

  // API Actions
  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read/`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}/`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 py-4 md:py-8">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white font-outfit mb-2">Notifications</h1>
        <p className="text-slate-500 dark:text-slate-400">Stay updated on payroll, leave requests, and team activity.</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Tab bar */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow'
                  : 'text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              All <span className="ml-1 opacity-70">({totalCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center ${
                activeTab === 'unread'
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow'
                  : 'text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Unread
              {unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                activeTab === 'read'
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow'
                  : 'text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Read <span className="ml-1 opacity-70">({readCount})</span>
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveType('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                activeType === 'all'
                  ? 'bg-slate-950 border-slate-950 text-white dark:bg-white dark:border-white dark:text-slate-950'
                  : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              All Types
            </button>
            {(Object.keys(typeConfig) as NotifType[]).map((type) => {
              const cfg = typeConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    activeType === type
                      ? 'bg-slate-950 border-slate-950 text-white dark:bg-white dark:border-white dark:text-slate-950'
                      : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bulk Action */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 font-bold transition-colors md:self-center self-start"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 h-24 rounded-2xl p-6" />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-20 text-center border border-slate-200/60 shadow-md">
          <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 mb-4 shadow-sm">
            <Bell className="h-8 w-8 text-slate-400 opacity-80" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit mb-1">All caught up!</h3>
          <p className="text-sm text-slate-500">You have no notifications matching your filters.</p>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {/* Unread Section */}
          {unreadSectionList.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-450 uppercase tracking-widest px-1">
                Unread — {unreadSectionList.length}
              </div>
              <div className="space-y-3">
                {unreadSectionList.map((notif) => (
                  <NotificationCard
                    key={notif.id}
                    notification={notif}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Read Section */}
          {readSectionList.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-slate-450 uppercase tracking-widest px-1">
                Read — {readSectionList.length}
              </div>
              <div className="space-y-3">
                {readSectionList.map((notif) => (
                  <NotificationCard
                    key={notif.id}
                    notification={notif}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
  onDismiss,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cfg = typeConfig[notification.type] || typeConfig.system;
  const Icon = cfg.icon;

  return (
    <div
      className={`group relative flex gap-4 p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 ${
        notification.is_read
          ? 'border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          : 'border-teal-200/80 bg-teal-50/20 dark:border-teal-900/30 dark:bg-teal-950/10 shadow-sm hover:border-teal-350/50'
      }`}
    >
      {/* Icon */}
      <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${cfg.bg}`}>
        <Icon className={`h-5 w-5 ${cfg.color}`} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`text-base font-bold leading-snug truncate ${
            notification.is_read 
              ? 'text-slate-800 dark:text-slate-200' 
              : 'text-slate-950 dark:text-white'
          }`}>
            {notification.title}
          </h4>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0 animate-pulse" />
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
          {notification.message}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
          <span>{formatRelativeTime(notification.created_at)}</span>
          {notification.action_url && (
            <Link 
              href={notification.action_url}
              className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              View details <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="absolute right-5 top-5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-650 dark:bg-teal-900/20 dark:hover:bg-teal-900/40 dark:text-teal-450 transition-colors"
            title="Mark as read"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDismiss(notification.id)}
          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
