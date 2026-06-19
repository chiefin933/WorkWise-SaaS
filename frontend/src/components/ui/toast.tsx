'use client';

/**
 * Lightweight, self-contained toast notification system.
 *
 * Usage:
 *   const { toast, ToastContainer } = useToast();
 *   toast('Saved!');
 *   toast('Something went wrong', 'error');
 *
 *   // In JSX:
 *   <ToastContainer />
 */

import { useState, useCallback, useRef } from 'react';
import { CheckCheck, X, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCheck,
  error:   AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-teal-600 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-slate-800 text-white',
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = ICONS[item.type];
  return (
    <div
      className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl text-sm font-bold
        transition-all animate-in slide-in-from-bottom-4 ${STYLES[item.type]}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * ToastContainer renders the portal-free stack in the bottom-right corner.
 * Drop it once anywhere in your page or layout.
 */
export function ToastContainer({ toasts, onDismiss }: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * useToast — hook that manages the toast list and returns a trigger function
 * plus the container element.
 *
 * @param duration  Auto-dismiss delay in ms (default 4000)
 */
export function useToast(duration = 4000) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss, duration],
  );

  const container = <ToastContainer toasts={toasts} onDismiss={dismiss} />;

  return { toast, container };
}
