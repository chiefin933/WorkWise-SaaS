'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { AddEmployeeModal } from '@/components/premium/AddEmployeeModal';
import { EditEmployeeModal } from '@/components/premium/EditEmployeeModal';
import { useToast } from '@/components/ui/toast';
import { Pagination } from '@/components/ui/Pagination';
import type { Employee } from '@/lib/types';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Mail,
  BadgeCheck,
  Building,
  UploadCloud,
  Loader2,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Filter state ──────────────────────────────────────────────────────────────
interface EmployeeFilters {
  status: string;
  department: string;
  employment_type: string;
}

const EMPTY_FILTERS: EmployeeFilters = { status: '', department: '', employment_type: '' };

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
];

// ── Filter panel component ────────────────────────────────────────────────────
function FilterPanel({
  filters,
  departments,
  onChange,
  onClear,
  onClose,
}: {
  filters: EmployeeFilters;
  departments: string[];
  onChange: (f: Partial<EmployeeFilters>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const hasActiveFilters = filters.status || filters.department || filters.employment_type;

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
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

      {/* Department */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
        <select
          value={filters.department}
          onChange={(e) => onChange({ department: e.target.value })}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Employment type */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employment Type</label>
        <select
          value={filters.employment_type}
          onChange={(e) => onChange({ employment_type: e.target.value })}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
        >
          {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
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
export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<EmployeeFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast, container: toastContainer } = useToast();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Close filter panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/employees/bulk_import/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast(res.data.message || 'Import successful!');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string }; status?: number } };
      const errMsg = error.response?.data?.error || '';

      // Detect plan limit error and show a specific upgrade toast
      const isPlanLimit =
        errMsg.toLowerCase().includes('plan limit') ||
        errMsg.toLowerCase().includes('exceed') ||
        errMsg.toLowerCase().includes('upgrade');

      if (isPlanLimit) {
        const plan = user?.plan ?? 'current';
        const limit = user?.max_employees ?? '—';
        toast(
          `Your ${plan} plan allows up to ${limit} employees. Upgrade your plan to import more.`,
          'error',
        );
        // Show a second follow-up toast with the action link after a short delay
        setTimeout(() => {
          toast('Go to Settings → Billing to upgrade your plan.', 'info');
        }, 800);
      } else {
        toast(errMsg || 'Failed to import CSV. Please check the file and try again.', 'error');
      }
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const { data: employeesData, isLoading } = useQuery<{ count: number; results: Employee[] } | Employee[]>({
    queryKey: ['employees', page],
    queryFn: async () => {
      const res = await api.get('/employees/', { params: { page, page_size: PAGE_SIZE } });
      return res.data;
    }
  });

  // Support both paginated envelope {count, results} and plain array (legacy)
  const employees = Array.isArray(employeesData)
    ? employeesData
    : (employeesData as { count: number; results: Employee[] })?.results ?? [];
  const totalCount = Array.isArray(employeesData)
    ? employees.length
    : (employeesData as { count: number; results: Employee[] })?.count ?? 0;

  // Derive unique department list from loaded page
  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean))) as string[];
  const departmentCount = departments.length;

  // Client-side filter application (applied on top of server-side page)
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      (emp.email?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = !filters.status || emp.status === filters.status;
    const matchesDept = !filters.department || emp.department === filters.department;
    const matchesType = !filters.employment_type || emp.employment_type === filters.employment_type;
    return matchesSearch && matchesStatus && matchesDept && matchesType;
  });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {toastContainer}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit mb-2">Employee Directory</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your organization&apos;s talent and profiles.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImport}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 px-5 py-6 rounded-2xl border transition-all shadow-sm"
            title={user?.max_employees ? `Your ${user.plan} plan allows up to ${user.max_employees} employees` : undefined}
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Import CSV
            {user?.max_employees && (
              <span className="ml-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                max {user.max_employees}
              </span>
            )}
          </Button>

          {/* Filter button with panel */}
          <div className="relative" ref={filterRef}>
            <Button
              onClick={() => setFilterOpen((v) => !v)}
              className={`gap-2 px-5 py-6 rounded-2xl border transition-all shadow-sm ${
                activeFilterCount > 0
                  ? 'bg-slate-950 dark:bg-white text-white dark:text-slate-950 border-slate-950 dark:border-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 bg-white text-slate-950 dark:bg-slate-950 dark:text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </Button>

            {filterOpen && (
              <FilterPanel
                filters={filters}
                departments={departments}
                onChange={(partial) => setFilters((f) => ({ ...f, ...partial }))}
                onClear={() => setFilters(EMPTY_FILTERS)}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-950 hover:bg-slate-900 dark:bg-white dark:hover:bg-slate-105 dark:text-slate-950 text-white gap-2 px-6 py-6 rounded-2xl transition-all shadow-sm font-bold"
          >
            <Plus className="h-5 w-5" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{employees.length || 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Employees</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <BadgeCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{employees.filter((e) => e.status === 'active').length || 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Active Now</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{departmentCount}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Departments</div>
          </div>
        </GlassCard>
      </div>

      {/* Search bar + active filter chips */}
      <GlassCard className="p-4 border border-slate-200/60 mb-2">
        <div className="flex flex-col gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-950 dark:group-focus-within:text-white transition-colors" />
            <input
              type="text"
              placeholder="Search by name, email or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-transparent border-none outline-none text-slate-900 dark:text-white"
            />
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              {filters.status && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300">
                  Status: {filters.status}
                  <button onClick={() => setFilters((f) => ({ ...f, status: '' }))} className="hover:text-slate-950 dark:hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.department && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300">
                  Dept: {filters.department}
                  <button onClick={() => setFilters((f) => ({ ...f, department: '' }))} className="hover:text-slate-950 dark:hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {filters.employment_type && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300">
                  Type: {filters.employment_type.replace('_', ' ')}
                  <button onClick={() => setFilters((f) => ({ ...f, employment_type: '' }))} className="hover:text-slate-950 dark:hover:text-white">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors px-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Employees Table */}
      <GlassCard className="overflow-hidden border border-slate-200/60 shadow-sm rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-700/60">
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Employment</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Salary (Ksh)</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5"><div className="h-10 w-48 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                    <td className="px-6 py-5"><div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                    <td className="px-6 py-5"><div className="h-10 w-24 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                    <td className="px-6 py-5"><div className="h-10 w-20 bg-slate-100 dark:bg-slate-800 rounded-xl" /></td>
                    <td className="px-6 py-5"><div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl ml-auto" /></td>
                  </tr>
                ))
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    No employees found matching your search{activeFilterCount > 0 ? ' or filters' : ''}.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <Link
                        href={`/employees/${employee.id}`}
                        className="flex items-center gap-4 hover:opacity-80 transition-all group/link"
                      >
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold font-outfit shadow-sm group-hover/link:scale-105 transition-transform duration-200">
                          {employee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white group-hover/link:underline transition-colors">
                            {employee.name}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                            <Mail className="h-3 w-3" /> {employee.email || 'No email'}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{employee.employment_type}</span>
                        <span className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{employee.payment_method}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {parseFloat(String(employee.salary_basic ?? 0)).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        employee.status === 'active'
                          ? 'bg-slate-100 text-slate-800 border-slate-350 dark:bg-slate-900 dark:text-slate-250 dark:border-slate-800'
                          : 'bg-slate-50 text-slate-450 border-slate-200 dark:bg-slate-950 dark:text-slate-550 dark:border-slate-850'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 transition-all"
                      >
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

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      <AddEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
      />
      <EditEmployeeModal
        employee={selectedEmployee}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEmployee(null);
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
      />
    </div>
  );
}
