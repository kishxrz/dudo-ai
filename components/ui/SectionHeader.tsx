import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({ title, description, actions, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 pb-3 border-b border-zinc-200/50", className)} {...props}>
      <div className="text-left">
        <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-zinc-500 font-semibold mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
