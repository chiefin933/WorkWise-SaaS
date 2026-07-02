'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import type { LeaveRequest, DashboardStats } from '@/lib/types';
import { formatKES } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Calendar,
  Users,
  Coins,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ArrowRight,
  Activity,
  Check,
  X,
  UserCheck,
} from 'lucide-react';

interface AttendanceMatrixItem {
  employee_id: string;
  employee_name: string;
  department: string;
  status: 'Present' | 'Late' | 'Absent' | 'On Leave';
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number;
  date: string;
}

export default function ManagerPortal() {
  const profile = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [actioningId, setActioningId] = useState<string | number | null>(null);

  // Role Gate: Redirect non-HR/non-ADMIN users to home page
  useEffect(() => {
    if (profile && profile.role !== 'ADMIN' && profile.role !== 'HR') {
      router.push('/');
    }
  }, [profile, router]);

  // ── Queries ────────────────────────────────────────────────────────────────

  // 1. Dashboard stats (for payroll cost, active employees, etc.)
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/dashboard/stats/');
      return res.data;
    },
  });

  // 2. Pending leaves queue
  const { data: leaves, isLoading: leavesLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['leave'],
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>('/leave/');
      return res.data;
    },
  });

  // 3. Today's attendance presence matrix
  const { data: attendanceMatrix, isLoading: attendanceLoading } = useQuery<AttendanceMatrixItem[]>({
    queryKey: ['attendance-presence-matrix'],
    queryFn: async () => {
      const res = await api.get<AttendanceMatrixItem[]>('/attendance/presence-matrix/');
      return res.data;
    },
  });

  const pendingLeaves = leaves?.filter((leave) => leave.status === 'pending') || [];

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleLeaveAction = async (id: string | number, action: 'approve' | 'reject') => {
    setActioningId(id);
    try {
      await api.post(`/leave/${id}/${action}/`);
      queryClient.invalidateQueries({ queryKey: ['leave'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    } catch {
      alert(`Failed to ${action} leave request.`);
    } finally {
      setActioningId(null);
    }
  };

  // ── Attendance Metrics & Filtering ─────────────────────────────────────────

  const departments = ['All', ...Array.from(new Set(attendanceMatrix?.map(item => item.department || 'General') || []))];

  const filteredAttendance = attendanceMatrix?.filter(item => {
    const matchesSearch = item.employee_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'All' || (item.department || 'General') === selectedDept;
    return matchesSearch && matchesDept;
  }) || [];

  const presentCount = attendanceMatrix?.filter(item => item.status === 'Present' || item.status === 'Late').length || 0;
  const lateCount = attendanceMatrix?.filter(item => item.status === 'Late').length || 0;
  const leaveCount = attendanceMatrix?.filter(item => item.status === 'On Leave').length || 0;
  const absentCount = attendanceMatrix?.filter(item => item.status === 'Absent').length || 0;

  // Show loading spinner while role check finishes
  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
      </div>
    );
  }

  // Double check role guard before rendering to avoid flashes
  if (profile.role !== 'ADMIN' && profile.role !== 'HR') {
    return null;
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Manager Self-Service</h1>
          <p className="text-slate-500 dark:text-slate-400">Gated administrative controls for leave approvals and today&apos;s attendance auditing.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20 text-xs font-bold font-outfit">
            <UserCheck className="h-4 w-4" /> Role: {profile.role}
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{pendingLeaves.length}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Pending Leaves</div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{presentCount}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Present Today</div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600 shrink-0">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit tabular-nums">{formatKES(stats?.monthly_payroll_cost)}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Monthly Payroll Cost</div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{stats?.total_employees ?? 0}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active Employees</div>
          </div>
        </GlassCard>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Leave Approval Queue */}
        <div className="lg:col-span-2 space-y-8">
          <GlassCard className="overflow-hidden border border-slate-200/60 shadow-md rounded-3xl">
            <div className="p-6 border-b border-slate-200/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Leave Approval Queue</h3>
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-amber-500/10 text-amber-600">
                {pendingLeaves.length} Awaiting
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Period</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {leavesLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" /></td>
                    </tr>
                  ) : pendingLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No pending leave requests to approve.
                      </td>
                    </tr>
                  ) : (
                    pendingLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{leave.employee_name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{leave.leave_type}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">{new Date(leave.start_date).toLocaleDateString()}</span>
                            <span className="text-slate-400">to {new Date(leave.end_date).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleLeaveAction(leave.id, 'approve')}
                              disabled={actioningId === leave.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 px-3 gap-1"
                            >
                              <Check className="h-4 w-4" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLeaveAction(leave.id, 'reject')}
                              disabled={actioningId === leave.id}
                              className="rounded-xl h-9 px-3 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Today's Attendance Overview */}
          <GlassCard className="overflow-hidden border border-slate-200/60 shadow-md rounded-3xl">
            <div className="p-6 border-b border-slate-200/60 bg-slate-50/50 dark:bg-slate-800/50 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">Today&apos;s Attendance Grid</h3>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filters</span>
                </div>
              </div>

              {/* Filters panel */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border-transparent rounded-xl py-2 px-3 text-xs outline-none text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-slate-800">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Department</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock In</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {attendanceLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" /></td>
                    </tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No attendance records match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((item) => (
                      <tr key={item.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">{item.employee_name}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 capitalize">{item.department || 'General'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            item.status === 'Present'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : item.status === 'Late'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : item.status === 'On Leave'
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                              : 'bg-red-500/10 text-red-600 border border-red-500/20'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.clock_in || '—'}</td>
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-medium">{item.clock_out || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Actions & Details */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-outfit">Auditing Actions</h3>

          {/* Quick Actions Card */}
          <GlassCard className="p-6 border border-slate-200/60 divide-y divide-slate-100 dark:divide-slate-800">
            <button
              onClick={() => router.push('/leave')}
              className="flex items-center justify-between w-full py-4 first:pt-0 group text-left"
            >
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">Go to Leave Management</div>
                <div className="text-xs text-slate-500 mt-0.5">Submit new requests or check policies</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/payroll')}
              className="flex items-center justify-between w-full py-4 group text-left"
            >
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">Go to Payroll Portal</div>
                <div className="text-xs text-slate-500 mt-0.5">Run monthly payroll and M-Pesa payouts</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/attendance')}
              className="flex items-center justify-between w-full py-4 last:pb-0 group text-left"
            >
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">Go to Attendance Logs</div>
                <div className="text-xs text-slate-500 mt-0.5">Audit clock in/out timings</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </GlassCard>

          {/* Attendance Stats details */}
          <GlassCard className="p-6 border border-slate-200/60 bg-slate-900 text-white space-y-4">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-400" />
              Today&apos;s Attendance Health
            </h4>
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total present today:</span>
                <span className="font-bold text-emerald-400">{presentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Late arrivals:</span>
                <span className="font-bold text-amber-400">{lateCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">On approved leave:</span>
                <span className="font-bold text-blue-400">{leaveCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Absent / Not clocked in:</span>
                <span className="font-bold text-red-400">{absentCount}</span>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Today&apos;s Presence Rate:</span>
                <span className="text-lg font-bold text-teal-400">
                  {attendanceMatrix && attendanceMatrix.length > 0
                    ? `${Math.round(((presentCount) / attendanceMatrix.length) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// Simple loader helper inline
function Loader2({ className }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-transparent border-t-current ${className}`} />;
}
