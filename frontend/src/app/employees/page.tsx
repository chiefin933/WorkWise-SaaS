'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { GlassCard } from '@/components/premium/GlassCard';
import { AddEmployeeModal } from '@/components/premium/AddEmployeeModal';
import { EditEmployeeModal } from '@/components/premium/EditEmployeeModal';
import type { Employee } from '@/lib/types';
import Link from 'next/link';
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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
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
      alert(res.data.message || 'Import successful!');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to import CSV');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await api.get<Employee[]>('/employees/');
      return res.data;
    }
  });

  const filteredEmployees = employees?.filter((emp) => 
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header Section */}
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
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Import CSV
          </Button>
          <Button className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 gap-2 px-5 py-6 rounded-2xl border transition-all shadow-sm">
            <Filter className="h-4 w-4" /> Filter
          </Button>
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
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{employees?.length || 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Total Employees</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <BadgeCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">{employees?.filter((e) => e.status === 'active').length || 0}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Active Now</div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 border border-slate-200/60 flex items-center gap-5">
          <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-outfit">4</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Departments</div>
          </div>
        </GlassCard>
      </div>

      {/* Search and Filters */}
      <GlassCard className="p-4 border border-slate-200/60 mb-6">
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
              ) : filteredEmployees?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    No employees found matching your search.
                  </td>
                </tr>
              ) : (
                filteredEmployees?.map((employee) => (
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
      
      <AddEmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />
      <EditEmployeeModal 
        employee={selectedEmployee}
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEmployee(null);
        }} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />
    </div>
  );
}
