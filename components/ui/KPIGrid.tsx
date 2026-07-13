import React from 'react';
import { cn } from '@/lib/utils';

interface KPIGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function KPIGrid({ children, className, ...props }: KPIGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6", className)} {...props}>
      {children}
    </div>
  );
}
