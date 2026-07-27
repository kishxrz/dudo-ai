import React from 'react';
import Logo from '@/components/ui/logo';
import { cn } from '@/lib/utils';

export default function LoadingSpinner({
  className,
  size = "md",
  text = "Loading Dudo",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}) {
  const logoSizes = {
    sm: "w-6 h-6",
    md: "w-9 h-9",
    lg: "w-11 h-11",
  };

  // Automatically strip trailing period dots from input string so strictly 3 animated dots render
  const cleanText = text.replace(/[\.\s]+$/, '');

  return (
    <div className={cn("flex flex-col items-center justify-center p-8 space-y-3.5 text-center min-h-[320px] select-none w-full my-auto", className)}>
      {/* Pure spinning Dudo SVG logo without any background box */}
      <div className="relative flex items-center justify-center">
        <Logo className={cn("animate-spin duration-1000", logoSizes[size])} />
      </div>

      {/* Bold brand blue uppercase text with strictly 3 animated dots */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <span className="text-[11px] font-extrabold text-[#22577A] uppercase tracking-wider">
          {cleanText}
        </span>
        <span className="inline-flex items-center gap-1 ml-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-bounce" />
        </span>
      </div>
    </div>
  );
}
