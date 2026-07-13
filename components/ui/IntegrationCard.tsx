import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IntegrationCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: any;
  connected: boolean;
  statusLabel?: string;
  onAction?: () => void;
  actionText?: string;
}

export function IntegrationCard({ title, description, icon: Icon, connected, statusLabel, onAction, actionText, className, ...props }: IntegrationCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-zinc-200/60 rounded-2xl p-4.5 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left",
        className
      )}
      {...props}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-200/50 flex items-center justify-center shadow-2xs">
              <Icon className="w-5 h-5 shrink-0" />
            </div>
          )}
          <span
            className={cn(
              "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
              connected
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-zinc-50 border-zinc-200 text-zinc-500"
            )}
          >
            {statusLabel || (connected ? 'Connected' : 'Not Connected')}
          </span>
        </div>
        <h4 className="text-sm font-semibold text-zinc-900 leading-tight">{title}</h4>
        <p className="text-xs text-zinc-600 font-normal mt-1 leading-relaxed">{description}</p>
      </div>
      {onAction && (
        <div className="mt-4 pt-3.5 border-t border-zinc-100">
          <Button
            onClick={onAction}
            className={cn(
              "h-8 text-xs font-semibold rounded-xl px-4 w-full cursor-pointer transition-all border-none flex items-center justify-center",
              connected
                ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                : "bg-[#22577A] hover:bg-[#1A4461] text-white shadow-md shadow-[#22577A]/10 hover:scale-[1.01]"
            )}
          >
            {actionText || (connected ? 'Manage' : 'Connect')}
          </Button>
        </div>
      )}
    </div>
  );
}
