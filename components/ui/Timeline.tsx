import React from 'react';
import { cn } from '@/lib/utils';

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Timeline({ children, className, ...props }: TimelineProps) {
  return (
    <div className={cn("relative pl-6 border-l border-zinc-200/80 space-y-6 text-left", className)} {...props}>
      {children}
    </div>
  );
}
