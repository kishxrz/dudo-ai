import React from 'react';
import { cn } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';

interface ConversationBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  sender: 'customer' | 'bot' | 'agent' | string;
  timestamp?: string;
  status?: 'sent' | 'delivered' | 'read' | string;
}

export function ConversationBubble({ text, sender, timestamp, status, className, ...props }: ConversationBubbleProps) {
  const isMe = sender === 'customer';
  
  return (
    <div
      className={cn(
        "flex w-full mt-2.5 max-w-lg select-text",
        isMe ? "ml-auto justify-end" : "mr-auto justify-start",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm text-left max-w-sm",
          isMe
            ? "bg-accent text-white rounded-tr-none"
            : sender === 'bot'
            ? "bg-zinc-50 border border-zinc-200/60 text-zinc-800 rounded-tl-none"
            : "bg-zinc-100 text-zinc-800 rounded-tl-none"
        )}
      >
        <p className="whitespace-pre-wrap">{text}</p>
        
        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] font-bold opacity-80 select-none">
          {timestamp && <span>{timestamp}</span>}
          {isMe && status && (
            <span>
              {status === 'read' ? (
                <CheckCheck size={11} className="text-emerald-300" />
              ) : status === 'delivered' ? (
                <CheckCheck size={11} className="text-zinc-200" />
              ) : (
                <Check size={11} className="text-zinc-300" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
