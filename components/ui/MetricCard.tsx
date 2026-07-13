import React from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  label: string;
  sublabel?: string;
}

export function MetricCard({ value, label, sublabel, className, ...props }: MetricCardProps) {
  return (
    <div className={cn("flex flex-col text-left", className)} {...props}>
      <div className="text-3xl font-black text-zinc-950 tracking-tight leading-none">
        {value}
      </div>
      <div className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mt-1.5 leading-none">
        {label}
      </div>
      {sublabel && (
        <span className="text-[9px] text-zinc-400 font-medium mt-1">
          {sublabel}
        </span>
      )}
    </div>
  );
}
