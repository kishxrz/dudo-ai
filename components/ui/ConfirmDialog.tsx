'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmClassName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 px-4 select-none">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200/80 p-5 max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-[14px] font-extrabold text-[#22577A] tracking-tight mb-1.5">{title}</h3>
        <p className="text-[11.5px] text-zinc-500 font-semibold leading-relaxed mb-5">{description}</p>
        <div className="flex justify-end gap-2">
          <Button
            onClick={onCancel}
            className="h-8 px-4 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-lg text-[12px] font-bold cursor-pointer"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            className={cn(
              'h-8 px-4 rounded-lg text-[12px] font-bold cursor-pointer border-none text-white transition-all hover:scale-[1.02]',
              confirmClassName || 'bg-[#22577A] hover:bg-[#1A4461]'
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
