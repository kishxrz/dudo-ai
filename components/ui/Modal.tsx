import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, className, ...props }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          "bg-white rounded-[20px] shadow-2xl w-[90%] max-w-md mx-4 overflow-hidden border border-zinc-200/60",
          className
        )}
        {...props}
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          {title && <h2 className="text-base font-semibold text-zinc-950 tracking-tight leading-tight">{title}</h2>}
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer bg-transparent border-none"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
