import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 pb-8 border-b border-zinc-200/70",
        className
      )}
      {...props}
    >
      <div className="flex flex-col">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-3">
            {breadcrumbs.map((b, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <span className="text-zinc-300">/</span>
                )}
                <span className="hover:text-zinc-900 transition-colors cursor-default">
                  {b.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        <h1 className="text-5xl font-black tracking-tight text-zinc-950 leading-none">
          {title}
        </h1>

        {description && (
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-500">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}