'use client';

import { useState } from 'react';
import { Loader2, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

type ExportType = 'paye' | 'nssf' | 'shif' | 'ahl';

interface ButtonConfig {
  type: ExportType;
  label: string;
}

const EXPORT_BUTTONS: ButtonConfig[] = [
  { type: 'paye', label: 'KRA PAYE' },
  { type: 'nssf', label: 'NSSF' },
  { type: 'shif', label: 'SHIF' },
  { type: 'ahl', label: 'Housing Levy' },
];

interface StatutoryExportButtonsProps {
  payrollRunId: string;
}

export function StatutoryExportButtons({ payrollRunId }: StatutoryExportButtonsProps) {
  const [loadingType, setLoadingType] = useState<ExportType | null>(null);

  const handleExport = async (type: ExportType) => {
    setLoadingType(type);
    try {
      const response = await api.get(
        `/payroll/${payrollRunId}/export/${type}/`,
        { responseType: 'blob' },
      );

      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');

      // Try to pull the filename from Content-Disposition if the server sends it
      const disposition = response.headers?.['content-disposition'] ?? '';
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      a.download = match ? match[1] : `${type}_${payrollRunId}.csv`;

      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: Blob; status?: number };
      };

      if (axiosError.response?.status === 403 && axiosError.response.data instanceof Blob) {
        try {
          const text = await axiosError.response.data.text();
          const body = JSON.parse(text) as { error?: string };
          alert(body.error ?? 'Access denied.');
        } catch {
          alert('Access denied.');
        }
      } else {
        alert('Export failed. Please try again.');
      }
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/60">
      <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <FileDown className="h-3.5 w-3.5" />
        Statutory Exports
      </h5>
      <div className="flex flex-wrap gap-2">
        {EXPORT_BUTTONS.map((btn) => (
          <Button
            key={btn.type}
            size="sm"
            disabled={loadingType !== null}
            onClick={() => handleExport(btn.type)}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 rounded-xl h-9 px-4 text-xs font-bold"
          >
            {loadingType === btn.type ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            {btn.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
