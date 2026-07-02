'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { AddLeaveModal } from '@/components/premium/AddLeaveModal';
import { useToast } from '@/components/ui/toast';
import { Pagination } from '@/components/ui/Pagination';
import type { LeaveRequest, LeaveStats } from '@/lib/types';
import { useAuthStore } from '@/lib/store';
import { Check, X } from 'lucide-react';
import {
  Palmtree,
  Clock,
  CheckCircle2,
  Plus,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Filter state ──────────────────────────────────────────────────────────────
interface LeaveFilters {
  leave_type: string;
  status: string;
}

const EMPTY_FILTERS: LeaveFilters = { leave_type: '', status: '' };

const LEAVE_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'annual', label: 'Annual' },
  { value: 'sick', label: 'Sick' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'unpaid', label: 'Unpaid' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'manager_approved', label: 'Manager Approved' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// ── Filter panel ──────────────────────────────────────────────────────────────
function LeaveFilterPanel({
  filters,
  onChange,
  onClear,
  onClose,
}: {
  filters: LeaveFilters;
  onChange: (f: Partial<LeaveFilters>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const hasActiveFilters = filters.leave_type || filters.status;

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
      {/* Leave type */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Leave Type</label>
        <select
          value={filters.leave_type}
          onChange={(e) => onChange({ leave_type: e.target.value })}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
        >
          {LEAVE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
        <select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value })}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={onClear}
          disabled={!hasActiveFilters}
          className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Clear all
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-950 dark:bg-white text-white dark:text-slate-950 rounded-xl text-xs font-bold hover:opacity-90 transition-all"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState<LeaveFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canManageLeave = user?.role === 'ADMIN' || user?.role === 'HR';
  const { toast, container: toastContainer } = useToast();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  const { data: leavesData, isLoading } = useQuery<{ count: number; results: LeaveRequest[] } | LeaveRequest[]>({
    queryKey: ['leave', page],
    queryFn: async () => {
      const res = await api.get('/leave/', { params: { page, page_size: PAGE_SIZE } });
      return res.data;
    }
  });

  const leaves = Array.isArray(leavesData)
    ? leavesData
    : (leavesData as { count: number; results: LeaveRequest[] })?.results ?? [];
  const leaveTotalCount = Array.isArray(leavesData)
    ? leaves.length
    : (leavesData as { count: number; results: LeaveRequest[] })?.count ?? 0;

  const { data: leaveStats } = useQuery<LeaveStats>({
    queryKey: ['leave-stats'],
    queryFn: async () => {
      const res = await api.get<LeaveStats>('/leave/stats/');
      return res.data;
    },
  });

  // Client-side filter on top of server-paged results
  const filteredLeaves = leaves.filter((lv) => {
    const matchesType = !filters.leave_type || lv.leave_type === filters.leave_type;
    const matchesStatus = !filters.status || lv.status === filters.status;
    return matchesType && matchesStatus;
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.post(`/leave/${id}/${action}/`);
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast(`Leave request ${action}d successfully.`);
    } catch {
      toast(`Could not ${action} leave request.`, 'error');
    }
  };

  return (
    <div className="space-y-8">
      {toastContainer}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Leave Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Handle time-off requests and track workforce availability.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white gap-2 px-6 py-6 rounded-2xl transition-all shadow-sm font-bold"
          >
            <Plus className="h-5 w-5" /> Request Leave
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{leaves.filter((l) => l.status === 'pending').length || 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Pending Approvals</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{leaves.filter((l) => l.status === 'approved').length || 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Approved Leaves</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Palmtree className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{leaveStats?.policy.annual ?? 21} Days</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Annual Entitlement</div>
          </div>
        </GlassCard>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <GlassCard className="overflow-hidden border border-slate-200/60 shadow-xl rounded-3xl">
            {/* Table header with filter button */}
            <div className="p-6 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Recent Requests</h3>
                {activeFilterCount > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing {filteredLeaves.length} of {leaves.length} · <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-slate-700 dark:text-slate-300 font-bold hover:underline">Clear filters</button>
                  </p>
                )}
              </div>

              {/* Filter button */}
              <div className="relative" ref={filterRef}>
                <Button
                  variant="ghost"
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`gap-2 rounded-xl ${activeFilterCount > 0 ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-500'}`}
                >
                  <Filter className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                </Button>

                {filterOpen && (
                  <LeaveFilterPanel
                    filters={filters}
                    onChange={(partial) => setFilters((f) => ({ ...f, ...partial }))}
                    onClear={() => setFilters(EMPTY_FILTERS)}
                    onClose={() => setFilterOpen(false)}
                  />
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Period</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-6 py-8"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                        No leave requests found{activeFilterCount > 0 ? ' matching your filters' : ''}.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 font-bold text-xs">
                              {leave.employee_name?.[0] || 'E'}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{leave.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{leave.leave_type}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{new Date(leave.start_date).toLocaleDateString()}</span>
                            <span className="text-[10px] text-slate-400">to {new Date(leave.end_date).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            leave.status === 'approved'
                              ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800'
                              : leave.status === 'pending'
                              ? 'bg-slate-50 text-slate-650 border-slate-250 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-850'
                              : 'bg-slate-50 text-slate-450 border-slate-200 dark:bg-slate-950 dark:text-slate-550 dark:border-slate-850'
                          }`}>
                            {leave.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {leave.status === 'pending' && canManageLeave ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAction(leave.id, 'approve')}
                                className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white rounded-xl h-9 px-3 gap-1 font-bold text-xs shadow-sm"
                              >
                                <Check className="h-4 w-4" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(leave.id, 'reject')}
                                className="rounded-xl h-9 px-3 gap-1 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 font-bold text-xs shadow-sm"
                              >
                                <X className="h-4 w-4" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 uppercase font-bold">{leave.status}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={leaveTotalCount}
              onPageChange={setPage}
            />
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Leave Policy</h3>
          <GlassCard className="p-6 border border-slate-200/60 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Annual Leave</span>
              <span className="font-bold text-slate-900 dark:text-white">{leaveStats?.policy.annual ?? 21} Days</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Sick Leave</span>
              <span className="font-bold text-slate-900 dark:text-white">{leaveStats?.policy.sick ?? 30} Days</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Maternity</span>
              <span className="font-bold text-slate-900 dark:text-white">{leaveStats?.policy.maternity ?? 90} Days</span>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-2">Notice Period</p>
              <p className="text-xs text-slate-500">Regular leave requests must be submitted {leaveStats?.policy.notice_days ?? 14} days in advance.</p>
            </div>
          </GlassCard>
        </div>
      </div>

      <AddLeaveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['leave'] });
          queryClient.invalidateQueries({ queryKey: ['leave-stats'] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }}
      />
    </div>
  );
}
