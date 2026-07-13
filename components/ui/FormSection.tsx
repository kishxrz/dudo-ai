import React from 'react';
import { cn } from '@/lib/utils';

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children, className, ...props }: FormSectionProps) {
  return (
    <div className={cn("bg-white border border-zinc-200/60 rounded-2xl p-4.5 shadow-sm space-y-3.5 text-left", className)} {...props}>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">{title}</h3>
        {description && <p className="text-xs text-zinc-600 font-normal mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="pt-3.5 border-t border-zinc-200/60 space-y-3">
        {children}
      </div>
    </div>
  );
}
