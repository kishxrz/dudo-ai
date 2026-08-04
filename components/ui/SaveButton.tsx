'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';

interface SaveButtonProps {
  onClick: () => Promise<void> | void;
  isDirty: boolean;
  label?: string;
  successLabel?: string;
  successToastTitle?: string;
  successToastDescription?: string;
  errorToastTitle?: string;
  errorToastDescription?: string;
  className?: string;
  disabled?: boolean;
}

export default function SaveButton({
  onClick,
  isDirty,
  label = 'Save Changes',
  successLabel = 'Saved ✓',
  successToastTitle = 'Changes saved',
  successToastDescription = 'Changes saved successfully.',
  errorToastTitle = 'Couldn\'t save changes',
  errorToastDescription = 'Please check your inputs and try again.',
  className,
  disabled = false,
}: SaveButtonProps) {
  const toast = useToast();
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handlePress = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!isDirty || disabled || status !== 'idle') return;

    setStatus('saving');
    try {
      await onClick();
      setStatus('success');
      toast.success(successToastTitle, successToastDescription);
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch (err) {
      setStatus('error');
      toast.error(errorToastTitle, errorToastDescription);
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    }
  };

  const isBtnDisabled = disabled || status !== 'idle' || !isDirty;

  return (
    <motion.button
      type="button"
      onClick={handlePress}
      disabled={isBtnDisabled}
      whileTap={!isBtnDisabled ? { scale: 0.98 } : {}}
      className={cn(
        "relative h-9 px-5 rounded-xl text-xs font-bold transition-all duration-300 border-none cursor-pointer flex items-center justify-center min-w-[120px] select-none text-white overflow-hidden shadow-xs",
        status === 'idle' && isDirty && (!className?.includes('bg-') ? "bg-[#22577A] hover:bg-[#1A4461] hover:shadow-md" : "opacity-100"),
        status === 'idle' && !isDirty && (!className?.includes('bg-') ? "bg-[#22577A] opacity-40 cursor-not-allowed pointer-events-none" : "opacity-40 cursor-not-allowed pointer-events-none"),
        status === 'saving' && (!className?.includes('bg-') ? "bg-[#22577A] opacity-90 cursor-not-allowed" : "opacity-90 cursor-not-allowed"),
        status === 'success' && "bg-emerald-600 cursor-default shadow-sm",
        status === 'error' && "bg-red-600 animate-shake cursor-default",
        className
      )}
    >
      <AnimatePresence mode="wait">
        {status === 'saving' && (
          <motion.span
            key="saving"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-1.5"
          >
            <Loader2 size={13} className="animate-spin shrink-0" />
            Saving...
          </motion.span>
        )}

        {status === 'success' && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            <Check size={13} className="shrink-0 animate-bounce" />
            {successLabel}
          </motion.span>
        )}

        {status === 'error' && (
          <motion.span
            key="error"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            <AlertCircle size={13} className="shrink-0" />
            Failed
          </motion.span>
        )}

        {status === 'idle' && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-center"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
