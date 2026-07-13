import React from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageLayout({ children, className, ...props }: PageLayoutProps) {
  return (
    <div
      className={cn(
        "max-w-[1440px] mx-auto px-8 py-8 flex flex-col gap-8 animate-fade-in",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
