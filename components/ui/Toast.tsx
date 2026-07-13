import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[300] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl bg-white animate-fade-in",
        type === 'success' && "border-green-200 text-green-700 bg-green-50/50",
        type === 'error' && "border-red-200 text-red-700 bg-red-50/50",
        type === 'warning' && "border-amber-200 text-amber-700 bg-amber-50/50"
      )}
    >
      {type === 'success' && <CheckCircle2 size={16} className="text-green-600" />}
      {type === 'error' && <AlertTriangle size={16} className="text-red-600" />}
      <span className="text-xs font-bold">{message}</span>
      <button onClick={onClose} className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 cursor-pointer border-none bg-transparent">
        <X size={12} />
      </button>
    </div>
  );
}
