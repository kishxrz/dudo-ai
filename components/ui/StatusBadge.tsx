import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'active' | 'inactive' | 'warning' | 'error' | string;
  label?: string;
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const currentLabel = label || status;
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold select-none capitalize leading-none",
        (status === 'active' || status === 'live' || status === 'connected') && "bg-green-50 border-green-200 text-green-700",
        (status === 'inactive' || status === 'disconnected' || status === 'none') && "bg-zinc-50 border-zinc-200 text-zinc-500",
        (status === 'warning' || status === 'pending') && "bg-amber-50 border-amber-200 text-amber-700",
        (status === 'error' || status === 'failed') && "bg-red-50 border-red-200 text-red-700",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          (status === 'active' || status === 'live' || status === 'connected') && "bg-green-500 animate-pulse",
          (status === 'inactive' || status === 'disconnected' || status === 'none') && "bg-zinc-400",
          (status === 'warning' || status === 'pending') && "bg-amber-500",
          (status === 'error' || status === 'failed') && "bg-red-500"
        )}
      />
      {currentLabel}
    </span>
  );
}
