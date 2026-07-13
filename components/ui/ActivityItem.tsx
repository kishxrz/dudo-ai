import React from 'react';
import { cn } from '@/lib/utils';

interface ActivityItemProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  time?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ActivityItem({ title, time, description, icon, className, ...props }: ActivityItemProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      {/* Circle / Icon indicator */}
      <span className="absolute -left-[31px] top-1 flex items-center justify-center w-4 h-4 rounded-full bg-white border border-zinc-300 shadow-sm text-[8px] font-bold">
        {icon || <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
      </span>
      <div>
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-xs font-bold text-zinc-900 leading-none">{title}</h4>
          {time && <span className="text-[10px] text-zinc-400 font-semibold leading-none">{time}</span>}
        </div>
        {description && <p className="text-[11px] text-zinc-500 mt-1.5 leading-normal">{description}</p>}
      </div>
    </div>
  );
}
