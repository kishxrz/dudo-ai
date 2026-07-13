import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  type?: 'card' | 'list' | 'text';
}

export function LoadingSkeleton({ rows = 3, type = 'card', className, ...props }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4 w-full animate-pulse", className)} {...props}>
      {Array.from({ length: rows }).map((_, idx) => (
        <React.Fragment key={idx}>
          {type === 'card' && (
            <div className="bg-zinc-100 border border-zinc-200/50 rounded-[20px] h-[110px]" />
          )}
          {type === 'list' && (
            <div className="flex items-center gap-3 py-3 border-b border-zinc-100">
              <div className="w-10 h-10 rounded-full bg-zinc-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-zinc-200 rounded w-1/3" />
                <div className="h-2 bg-zinc-200 rounded w-1/2" />
              </div>
            </div>
          )}
          {type === 'text' && (
            <div className="space-y-2">
              <div className="h-3 bg-zinc-200 rounded w-full" />
              <div className="h-3 bg-zinc-200 rounded w-5/6" />
              <div className="h-3 bg-zinc-200 rounded w-2/3" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
