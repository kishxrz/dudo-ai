import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-200 rounded-[20px] bg-white select-none",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-accent/8 flex items-center justify-center mb-4 text-accent">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-xl font-bold text-zinc-900 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-zinc-500 font-semibold mt-2.5 max-w-md leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
