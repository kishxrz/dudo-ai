import React from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageLayout({ children, className, ...props }: PageLayoutProps) {
  return (
    <div
      className={cn(
        "max-w-[1440px] mx-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 flex flex-col gap-5 sm:gap-6 md:gap-8 animate-fade-in",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
