'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { GlassCard } from '@/components/premium/GlassCard';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Activity,
  MapPin,
  Lock,
  LogIn,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor_email: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  location: string;
  role: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE:           'bg-emerald-100 text-emerald-700 border-emerald-200',
  UPDATE:           'bg-blue-100 text-blue-700 border-blue-200',
  DELETE:           'bg-red-100 text-red-700 border-red-200',
  LOGIN:            'bg-teal-100 text-teal-700 border-teal-200',
  LOGOUT:           'bg-slate-100 text-slate-600 border-slate-200',
  PAYROLL_RUN:      'bg-purple-100 text-purple-700 border-purple-200',
  PAYROLL_APPROVE:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  PAYROLL_REJECT:   'bg-rose-100 text-rose-700 border-rose-200',
  EXPORT:           'bg-amber-100 text-amber-700 border-amber-200',
  PERMISSION_CHANGE:'bg-orange-100 text-orange-700 border-orange-200',
  WEBHOOK:          'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE:           CheckCircle,
  UPDATE:           FileText,
  DELETE:           AlertTriangle,
  LOGIN:            User,
  LOGOUT:           User,
  PAYROLL_RUN:      Activity,
  PAYROLL_APPROVE:  CheckCircle,
  PAYROLL_REJECT:   AlertTriangle,
  EXPORT:           Download,
  PERMISSION_CHANGE:Shield,
  WEBHOOK:          Activity,
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:    'bg-purple-100 text-purple-700 border-purple-200',
  HR:       'bg-blue-100 text-blue-700 border-blue-200',
  EMPLOYEE: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ALL_ACTIONS = [
  '', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
  'PAYROLL_RUN', 'PAYROLL_APPROVE', 'EXPORT', 'PERMISSION_CHANGE',
];

const ALL_RESOURCES = [
  '', 'Employee', 'PayrollRun', 'Tenant', 'User', 'Leave', 'Attendance',
];

export default function AuditTrailPage() {
  const user = useAuthStore((s) => s.user);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [search, setSearch] = useState('');

  // Admin-only gate
  if (user && user.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Lock className="h-10 w-10 text-slate-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            Access Restricted
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            The Audit Trail is only accessible to Administrators. Contact your admin if you need access to this log.
          </p>
        </div>
      </div>
    );
  }

  const { data, isLoading, refetch, isFetching } = useQuery<{
    audit_logs: AuditEntry[];
    count: number;
  }>({
    queryKey: ['audit-trail', actionFilter, resourceFilter],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '200' };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      const res = await api.get('/audit-trail/', { params });
      return res.data;
    },
  });

  const logs = (data?.audit_logs ?? []).filter((entry) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      entry.actor_email.toLowerCase().includes(q) ||
      entry.resource_type.toLowerCase().includes(q) ||
      entry.action.toLowerCase().includes(q) ||
      (entry.location ?? '').toLowerCase().includes(q)
    );
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const downloadCSV = () => {
    const header = ['Timestamp', 'Action', 'Actor', 'Role', 'Resource Type', 'Resource ID', 'IP Address', 'Location'];
    const rows = logs.map((e) => [
      e.timestamp,
      e.action,
      e.actor_email,
      e.role ?? '',
      e.resource_type,
      e.resource_id,
      e.ip_address ?? '',
      e.location ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary stats
  const stats = {
    total: data?.count ?? 0,
    logins: logs.filter((e) => e.action === 'LOGIN').length,
    payrollActions: logs.filter((e) => e.action.startsWith('PAYROLL')).length,
    permissionChanges: logs.filter((e) => e.action === 'PERMISSION_CHANGE').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-teal-500" />
            Audit Trail
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Immutable, tamper-evident log of all actions in your workspace.
            Compliant with Kenya&apos;s Data Protection Act 2019.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-2xl gap-2 border border-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={downloadCSV}
            disabled={logs.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-2xl gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Events',
            value: stats.total,
            color: 'text-slate-700',
            bg: 'bg-slate-100',
            icon: Activity,
          },
          {
            label: 'Login Events',
            value: stats.logins,
            color: 'text-teal-700',
            bg: 'bg-teal-50',
            icon: LogIn,
          },
          {
            label: 'Payroll Actions',
            value: stats.payrollActions,
            color: 'text-purple-700',
            bg: 'bg-purple-50',
            icon: FileText,
          },
          {
            label: 'Permission Changes',
            value: stats.permissionChanges,
            color: 'text-orange-700',
            bg: 'bg-orange-50',
            icon: Key,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <GlassCard key={s.label} className={`p-5 border border-slate-200/60 ${s.bg}`}>
              <div className="flex items-start justify-between">
                <div className={`text-3xl font-black font-outfit tabular-nums ${s.color}`}>
                  {isLoading ? '—' : s.value}
                </div>
                <Icon className={`h-5 w-5 mt-1 opacity-60 ${s.color}`} />
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">
                {s.label}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Filters */}
      <GlassCard className="p-5 border border-slate-200/60">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search (includes location) */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by actor, resource, action, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
            >
              <option value="">All Actions</option>
              {ALL_ACTIONS.slice(1).map((a) => (
                <option key={a} value={a}>{a.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Resource filter */}
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
            >
              <option value="">All Resources</option>
              {ALL_RESOURCES.slice(1).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Log table */}
      <GlassCard className="border border-slate-200/60 overflow-hidden rounded-3xl">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 dark:text-white">
            Events Log
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            {logs.length} events shown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60">
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Action
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Actor / Role
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Resource
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Location
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <div className="text-slate-500 font-medium">No audit events found</div>
                    <div className="text-slate-400 text-sm mt-1">
                      Events will appear here as actions are taken in your workspace.
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((entry) => {
                  const Icon = ACTION_ICONS[entry.action] ?? Activity;
                  const actionColor = ACTION_COLORS[entry.action] ?? 'bg-slate-100 text-slate-600';
                  const roleColor = ROLE_COLORS[entry.role] ?? 'bg-slate-100 text-slate-600 border-slate-200';
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs">{formatTime(entry.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${actionColor}`}
                        >
                          <Icon className="h-3 w-3" />
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 text-xs font-bold shrink-0">
                            {(entry.actor_email || 'S')[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
                              {entry.actor_email || 'System'}
                            </span>
                            {entry.role && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border w-fit ${roleColor}`}
                              >
                                {entry.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span className="font-bold text-slate-800 dark:text-white">
                            {entry.resource_type || '—'}
                          </span>
                          {entry.resource_id && (
                            <span className="text-slate-400 text-xs ml-1 font-mono">
                              #{entry.resource_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {entry.location ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">{entry.location}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-500">
                          {entry.ip_address || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
