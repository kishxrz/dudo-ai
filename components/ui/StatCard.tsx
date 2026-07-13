import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconClass?: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  size?: 'default' | 'sm';
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  trend,
  trendType = 'positive',
  className,
  size = 'default',
  ...props
}: StatCardProps) {
  const hasTopContent = !!(Icon || trend);

  return (
    <div
      className={cn(
        "group bg-white border border-zinc-200/70 flex flex-col shadow-[0_6px_20px_rgba(15,23,42,0.06)] hover:-translate-y-1.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)] transition-all duration-300",
        hasTopContent ? "justify-between" : "justify-center",
        size === 'sm' 
          ? "p-4 h-[84px] rounded-2xl" 
          : "p-7 min-h-[180px] rounded-[24px]",
        className
      )}
      {...props}
    >
      {hasTopContent && (
        <div className="flex items-start justify-between">
          {Icon && (
            <div
              className={cn(
                "rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 transition-colors group-hover:bg-accent/10 group-hover:text-accent",
                size === 'sm' ? "w-8 h-8 rounded-lg" : "w-12 h-12 rounded-2xl",
                iconClass
              )}
            >
              <Icon size={size === 'sm' ? 14 : 22} strokeWidth={2} />
            </div>
          )}

          {trend && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                trendType === "positive" &&
                  "bg-emerald-50 text-emerald-700 border border-emerald-200",
                trendType === "negative" &&
                  "bg-red-50 text-red-700 border border-red-200",
                trendType === "neutral" &&
                  "bg-zinc-100 text-zinc-600 border border-zinc-200"
              )}
            >
              {trend}
            </span>
          )}
        </div>
      )}

      <div className={size === 'sm' ? (hasTopContent ? "mt-2" : "mt-0") : "mt-8"}>
        <h3 className={cn(
          "font-black tracking-tight text-zinc-950 leading-none",
          size === 'sm' ? "text-2xl" : "text-5xl"
        )}>
          {value}
        </h3>

        <p className={cn(
          "font-semibold text-zinc-500 leading-none",
          size === 'sm' 
            ? "mt-1.5 text-[10px] font-extrabold uppercase tracking-wide" 
            : "mt-3 text-sm uppercase tracking-[0.12em]"
        )}>
          {label}
        </p>
      </div>
    </div>
  );
}