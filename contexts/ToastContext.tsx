'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    // Parse JSON error messages if any to look clean to users
    let displayMessage = message;
    if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.error) displayMessage = parsed.error;
        else if (parsed.message) displayMessage = parsed.message;
      } catch (e) {}
    }

    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message: displayMessage, type, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((msg: string, dur?: number) => showToast(msg, 'success', dur), [showToast]);
  const error = useCallback((msg: string, dur?: number) => showToast(msg, 'error', dur), [showToast]);
  const info = useCallback((msg: string, dur?: number) => showToast(msg, 'info', dur), [showToast]);
  const warning = useCallback((msg: string, dur?: number) => showToast(msg, 'warning', dur), [showToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Toast container floating on top of all UI components */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2.5 max-w-[90%] sm:max-w-md w-full pointer-events-none select-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const isError = toast.type === 'error';
            const isSuccess = toast.type === 'success';
            const isWarning = toast.type === 'warning';

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className={cn(
                  "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg w-full transition-all duration-200",
                  isError && "bg-red-50 border-red-200 text-red-900",
                  isSuccess && "bg-emerald-50 border-emerald-200 text-emerald-900",
                  isWarning && "bg-amber-50 border-amber-200 text-amber-900",
                  toast.type === 'info' && "bg-[#FFF8F0] border-[#EED9B4] text-[#22577A]"
                )}
              >
                {/* Status Icons */}
                <div className="shrink-0 mt-0.5">
                  {isError && <AlertCircle size={16} className="text-red-600" />}
                  {isSuccess && <CheckCircle2 size={16} className="text-emerald-600" />}
                  {isWarning && <AlertCircle size={16} className="text-amber-600" />}
                  {toast.type === 'info' && <Info size={16} className="text-[#22577A]" />}
                </div>

                {/* Message Body */}
                <div className="flex-1 text-[12px] font-bold leading-normal break-words pr-2">
                  {toast.message}
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className={cn(
                    "shrink-0 p-0.5 rounded-md border-none bg-transparent hover:bg-black/5 cursor-pointer transition-colors mt-0.5",
                    isError && "text-red-500 hover:text-red-800",
                    isSuccess && "text-emerald-500 hover:text-emerald-800",
                    isWarning && "text-amber-500 hover:text-amber-800",
                    toast.type === 'info' && "text-zinc-400 hover:text-[#22577A]"
                  )}
                >
                  <X size={13} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
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
