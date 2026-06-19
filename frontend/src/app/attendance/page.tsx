'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { AddAttendanceModal } from '@/components/premium/AddAttendanceModal';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/toast';
import type { AttendanceLog, AttendanceStats, Employee } from '@/lib/types';

interface PresenceMatrixItem {
  employee_id: string;
  employee_name: string;
  department: string;
  status: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number;
}
import { 
  Clock, 
  MapPin, 
  Calendar, 
  Search, 
  Filter, 
  MoreHorizontal,
  Plus,
  ArrowRight,
  UserCheck,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'timecard' | 'matrix' | 'directory'>('timecard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clockLocation, setClockLocation] = useState('Office');
  const [clocking, setClocking] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast, container: toastContainer } = useToast();
  const now = new Date();
  const canManageAttendance = ['ADMIN', 'HR'].includes(user?.role ?? '');

  // Queries
  const { data: stats } = useQuery<AttendanceStats>({
    queryKey: ['attendance-stats', now.getMonth() + 1, now.getFullYear()],
    queryFn: async () => {
      const res = await api.get<AttendanceStats>('/attendance/stats/', {
        params: { month: now.getMonth() + 1, year: now.getFullYear() },
      });
      return res.data;
    },
  });

  const { data: logs, isLoading: isLogsLoading } = useQuery<AttendanceLog[]>({
    queryKey: ['attendance'],
    queryFn: async () => {
      const res = await api.get<AttendanceLog[]>('/attendance/');
      return res.data;
    }
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<Employee[]>('/employees/');
      return res.data;
    }
  });

  const { data: presenceMatrix, isLoading: isMatrixLoading } = useQuery<PresenceMatrixItem[]>({
    queryKey: ['presence-matrix'],
    queryFn: async () => {
      const res = await api.get<PresenceMatrixItem[]>('/attendance/presence-matrix/');
      return res.data;
    }
  });

  // Resolve matching employee profile for logged in user
  const myEmployee = employees?.find(emp => emp.email === user?.email);
  
  // Resolve today's clock log for current employee
  const todayStr = now.toISOString().split('T')[0];
  const myTodayLog = logs?.find(
    log => log.employee_name === myEmployee?.name && log.date === todayStr
  );

  const filteredLogs = logs?.filter(
    (log) =>
      log.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.date.includes(search)
  );

  const filteredMatrix = presenceMatrix?.filter(
    (item) =>
      item.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.status?.toLowerCase().includes(search.toLowerCase())
  );

  const handleClockIn = () => {
    if (!myEmployee) return;
    setClocking(true);
    
    // Attempt capturing coordinates via HTML5 Geolocation API
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await api.post('/attendance/clock-in/', {
            employee: myEmployee.id,
            location: clockLocation,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
          queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
          queryClient.invalidateQueries({ queryKey: ['presence-matrix'] });
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: string } } };
          toast(error.response?.data?.error || 'Failed to clock in', 'error');
        } finally {
          setClocking(false);
        }
      },
      async () => {
        // Fallback: Clock-in without coordinates if geolocation blocked
        try {
          await api.post('/attendance/clock-in/', {
            employee: myEmployee.id,
            location: clockLocation
          });
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
          queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
          queryClient.invalidateQueries({ queryKey: ['presence-matrix'] });
        } catch (err: unknown) {
          const error = err as { response?: { data?: { error?: string } } };
          toast(error.response?.data?.error || 'Failed to clock in', 'error');
        } finally {
          setClocking(false);
        }
      }
    );
  };

  const handleClockOut = async () => {
    if (!myEmployee) return;
    setClocking(true);
    try {
      await api.post('/attendance/clock-out/', {
        employee: myEmployee.id
      });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['presence-matrix'] });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast(error.response?.data?.error || 'Failed to clock out', 'error');
    } finally {
      setClocking(false);
    }
  };

  return (
    <div className="space-y-8">
      {toastContainer}
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Time & Attendance</h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor workforce punctuality, logging hours and status in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          {canManageAttendance && (
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white gap-2 px-6 py-6 rounded-2xl transition-all shadow-sm font-bold"
            >
              <Plus className="h-5 w-5" /> Log Manual Entry
            </Button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{stats?.on_time_rate ?? 0}%</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">On-Time Arrival</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{Math.round(stats?.total_hours ?? 0)}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Hours (This Month)</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{stats?.total_logs ?? 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Active Daily Logs</div>
          </div>
        </GlassCard>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button 
          onClick={() => setActiveTab('timecard')}
          className={`pb-4 text-sm font-bold transition-all relative ${
            activeTab === 'timecard' ? 'text-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          My Timecard
          {activeTab === 'timecard' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 dark:bg-white rounded-full" />}
        </button>
        {canManageAttendance && (
          <button 
            onClick={() => setActiveTab('matrix')}
            className={`pb-4 text-sm font-bold transition-all relative ${
              activeTab === 'matrix' ? 'text-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Workforce Presence
            {activeTab === 'matrix' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 dark:bg-white rounded-full" />}
          </button>
        )}
        {canManageAttendance && (
          <button 
            onClick={() => setActiveTab('directory')}
            className={`pb-4 text-sm font-bold transition-all relative ${
              activeTab === 'directory' ? 'text-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Daily Logs Directory
            {activeTab === 'directory' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950 dark:bg-white rounded-full" />}
          </button>
        )}
      </div>

      {/* Tab Panels */}
      {activeTab === 'timecard' && (
        <div className="max-w-2xl mx-auto py-4">
          <GlassCard className="p-8 border border-slate-200/80 shadow-lg bg-white relative overflow-hidden">
            <h2 className="text-2xl font-bold font-outfit text-slate-900 mb-2">Time Clock</h2>
            <p className="text-slate-500 text-sm mb-6">Select your location and register your attendance for today.</p>
            
            {!myEmployee ? (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl">
                No employee profile linked to your user account email ({user?.email}). Please ask your administrator to create an employee record with this email.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Select Location</label>
                  <select 
                    value={clockLocation}
                    onChange={(e) => setClockLocation(e.target.value)}
                    disabled={!!myTodayLog}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
                  >
                    <option value="Office">HQ Office</option>
                    <option value="Remote">Remote Work</option>
                    <option value="Field">On-Site / Field</option>
                  </select>
                </div>

                {/* Clock Panel Details */}
                {myTodayLog ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">Clock-In Registered:</span>
                      <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg font-mono">{myTodayLog.clock_in}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">Clock-Out Registered:</span>
                      {myTodayLog.clock_out ? (
                        <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg font-mono">{myTodayLog.clock_out}</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Still Active</span>
                      )}
                    </div>
                    {myTodayLog.hours_worked != null && (
                      <div className="flex items-center justify-between text-sm border-t border-slate-200/60 pt-3">
                        <span className="text-slate-500 font-medium">Hours Worked:</span>
                        <span className="font-bold text-slate-900">{Number(myTodayLog.hours_worked).toFixed(2)} hours</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-650 text-sm">
                    <Compass className="h-5 w-5 text-slate-500 shrink-0" />
                    Geolocation verification is active. Capturing location stamps on trigger.
                  </div>
                )}

                {/* Clock Triggers */}
                <div className="flex gap-4">
                  <Button
                    onClick={handleClockIn}
                    disabled={clocking || !!myTodayLog}
                    className="flex-1 py-7 rounded-2xl bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white font-bold text-lg shadow-sm flex items-center justify-center gap-2"
                  >
                    {clocking ? 'Connecting...' : 'Clock In'}
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={clocking || !myTodayLog || !!myTodayLog.clock_out}
                    className="flex-1 py-7 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg border border-slate-300 shadow-sm flex items-center justify-center gap-2"
                  >
                    Clock Out
                  </Button>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {activeTab === 'matrix' && canManageAttendance && (
        <div className="space-y-6">
          {/* Presence Filter bar */}
          <GlassCard className="p-4 border border-slate-200/60 flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-850 transition-colors" />
              <input 
                type="text" 
                placeholder="Search staff state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-transparent border-none outline-none text-slate-900 dark:text-white"
              />
            </div>
          </GlassCard>

          {/* Matrix Grid */}
          <GlassCard className="overflow-hidden border border-slate-200/60 shadow-sm rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200/60">
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Department</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Status Today</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock-In</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock-Out</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Hours Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {isMatrixLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-6 py-8"><div className="h-8 bg-slate-100 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : filteredMatrix?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                        No employees found matching filter terms.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix?.map((row) => (
                      <tr key={row.employee_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs">
                              {row.employee_name?.[0]}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{row.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold text-slate-500">
                          {row.department || 'General'}
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            row.status === 'Present' 
                              ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800' 
                              : row.status === 'Late'
                              ? 'bg-slate-50 text-slate-650 border-slate-250 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-850'
                              : row.status === 'On Leave'
                              ? 'bg-slate-50 text-slate-650 border-slate-250 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-850'
                              : 'bg-slate-50 text-slate-450 border-slate-200 dark:bg-slate-950 dark:text-slate-550 dark:border-slate-850'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-slate-600 tabular-nums">
                          {row.clock_in || '—'}
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-slate-600 tabular-nums">
                          {row.clock_out || '—'}
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-slate-900 tabular-nums">
                          {row.hours_worked > 0 ? `${row.hours_worked.toFixed(1)}h` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'directory' && canManageAttendance && (
        <div className="space-y-6">
          <GlassCard className="p-4 border border-slate-200/60 flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-850 transition-colors" />
              <input 
                type="text" 
                placeholder="Search employee logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-transparent border-none outline-none text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-3">
               <Button variant="ghost" className="text-slate-500 gap-2 px-4 rounded-xl">
                 <Calendar className="h-4 w-4" /> This Week
               </Button>
               <Button variant="ghost" className="text-slate-500 gap-2 px-4 rounded-xl">
                 <Filter className="h-4 w-4" /> Advanced
               </Button>
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden border border-slate-200/60 shadow-sm rounded-3xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200/60">
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Clock In/Out</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Total Hours</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Location</th>
                    <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60">
                  {isLogsLoading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={6} className="px-6 py-8"><div className="h-8 bg-slate-100 rounded-xl" /></td>
                      </tr>
                    ))
                  ) : filteredLogs?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-500">
                        No attendance logs recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs?.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-105 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs">
                              {log.employee_name?.[0] || 'E'}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{log.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-600 font-medium">
                          {new Date(log.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-900 bg-slate-105 border border-slate-250 dark:text-slate-205 dark:bg-slate-900 dark:border-slate-800 px-2 py-0.5 rounded-md">{log.clock_in}</span>
                             <ArrowRight className="h-3 w-3 text-slate-400" />
                             <span className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 dark:text-slate-450 dark:bg-slate-950 dark:border-slate-850 px-2 py-0.5 rounded-md">{log.clock_out || '--:--'}</span>
                           </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-slate-900 tabular-nums">
                          {log.hours_worked != null ? `${Number(log.hours_worked).toFixed(1)}h` : '—'}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                            <MapPin className="h-3 w-3" /> {log.location || 'Office'}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                             <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      <AddAttendanceModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['attendance'] });
          queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
          queryClient.invalidateQueries({ queryKey: ['presence-matrix'] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }}
      />
    </div>
  );
}
