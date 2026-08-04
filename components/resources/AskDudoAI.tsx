'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AskDudoAIProps {
  articleSlug: string;
  articleTitle: string;
}

export default function AskDudoAI({ articleSlug, articleTitle }: AskDudoAIProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setAnswer(null);

    try {
      const res = await fetch('/api/resources/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), articleSlug, articleTitle }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setAnswer(data.answer);
      } else {
        setAnswer(data.error || 'Unable to process question at this time.');
      }
    } catch (err) {
      console.error(err);
      setAnswer('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 my-8 select-none shadow-sm">
      <div className="flex items-center gap-2">
        <Bot className="text-[#22577A] shrink-0" size={18} />
        <div>
          <h4 className="text-xs font-bold text-zinc-900 leading-none uppercase tracking-wider">Still have questions?</h4>
          <span className="text-[10px] text-zinc-400 mt-1 block">Ask Dudo AI for instant answers about this article</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Ask about "${articleTitle}"...`} 
          className="flex-1 text-xs h-8.5 border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 rounded-lg"
          disabled={loading}
        />
        <Button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="h-8.5 text-xs px-4 bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-lg border-none cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
        >
          {loading ? 'Thinking...' : <><Send size={11} /> Ask</>}
        </Button>
      </form>

      {loading && (
        <div className="flex items-center gap-2 text-xs font-bold text-[#22577A] py-1.5 animate-pulse pl-1">
          <Sparkles size={12} /> Dudo AI is reading the article and drafting an answer...
        </div>
      )}

      {answer && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs text-zinc-700 leading-relaxed font-semibold flex items-start gap-3 shadow-2xs animate-in fade-in duration-200">
          <Bot className="text-[#22577A] shrink-0 mt-0.5" size={15} />
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-400 block uppercase">Dudo AI Assistant</span>
            <p className="whitespace-pre-line">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
