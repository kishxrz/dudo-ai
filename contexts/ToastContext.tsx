'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (title: string, description?: string, type?: ToastType, duration?: number) => void;
  success: (title: string, description?: string, duration?: number) => void;
  error: (title: string, description?: string, duration?: number) => void;
  info: (title: string, description?: string, duration?: number) => void;
  warning: (title: string, description?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname() || '';

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((title: string, description?: string, type: ToastType = 'info', duration = 3500) => {
    // Parse JSON error messages if any to look clean to users
    let displayTitle = title;
    if (title.trim().startsWith('{') || title.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(title);
        if (parsed.error) displayTitle = parsed.error;
        else if (parsed.message) displayTitle = parsed.message;
      } catch (e) {}
    }

    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title: displayTitle, description, type, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((title: string, desc?: string, dur?: number) => showToast(title, desc, 'success', dur), [showToast]);
  const error = useCallback((title: string, desc?: string, dur?: number) => showToast(title, desc, 'error', dur), [showToast]);
  const info = useCallback((title: string, desc?: string, dur?: number) => showToast(title, desc, 'info', dur), [showToast]);
  const warning = useCallback((title: string, desc?: string, dur?: number) => showToast(title, desc, 'warning', dur), [showToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const isDashboard = pathname.startsWith('/dashboard');

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Toast container floating in the top-right of the screen */}
      {mounted && (
        <div 
          className={cn(
            "fixed right-6 z-[9999] flex flex-col gap-3 max-w-[90%] sm:max-w-sm w-full pointer-events-none select-none transition-all duration-300",
            isDashboard ? "top-[116px]" : "top-20"
          )}
        >
          <AnimatePresence>
            {toasts.map((toast) => {
              const isError = toast.type === 'error';
              const isSuccess = toast.type === 'success';
              const isWarning = toast.type === 'warning';

              return (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, x: 300 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 300 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-md w-full bg-white/95 backdrop-blur-xs transition-all duration-200",
                    isError && "border-red-100 shadow-red-100/5",
                    isSuccess && "border-emerald-100 shadow-emerald-100/5",
                    isWarning && "border-amber-100 shadow-amber-100/5",
                    toast.type === 'info' && "border-[#EED9B4]/60 shadow-[#FFF8F0]/10"
                  )}
                >
                  {/* Status Icons */}
                  <div className="shrink-0 mt-0.5">
                    {isError && <AlertCircle size={17} className="text-red-500" />}
                    {isSuccess && <CheckCircle2 size={17} className="text-emerald-500" />}
                    {isWarning && <AlertCircle size={17} className="text-amber-500" />}
                    {toast.type === 'info' && <Info size={17} className="text-[#22577A]" />}
                  </div>

                  {/* Message Body */}
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "text-xs font-bold leading-snug",
                      isError && "text-red-900",
                      isSuccess && "text-emerald-900",
                      isWarning && "text-amber-900",
                      toast.type === 'info' && "text-[#22577A]"
                    )}>
                      {toast.title}
                    </h4>
                    {toast.description && (
                      <p className="text-[10px] font-semibold text-zinc-500 mt-0.5 leading-normal">
                        {toast.description}
                      </p>
                    )}
                  </div>

                  {/* Dismiss Button */}
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="shrink-0 p-0.5 rounded-lg border-none bg-transparent hover:bg-zinc-100 cursor-pointer text-zinc-400 hover:text-zinc-650 transition-colors mt-0.5"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
