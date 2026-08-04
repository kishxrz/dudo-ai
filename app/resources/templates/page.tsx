'use client';

import React, { useState } from 'react';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/ToastContext';
import { Clipboard, Check, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { FadeUp, FadeIn, StaggerWrap, StaggerItem } from '@/components/resources/Animations';

export default function TemplatesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const templates = ContentRepository.getTemplates();

  const filtered = templates.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Prompt Copied', 'Template instructions copied to clipboard.');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Centered Top Header Section */}
      <div className="text-center max-w-2xl mx-auto space-y-2 pb-6 border-b border-zinc-200/50 select-none">
        <FadeUp delay={0}>
          <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
            AI Employee Prompts &amp; System Templates
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-xl mx-auto">
            Plug-and-play prompt templates engineered to optimize customer onboarding, booking calendars, and lead qualifications safely.
          </p>
        </FadeUp>
      </div>

      {/* Search Bar */}
      <FadeIn delay={0.15}>
        <div className="flex justify-center pb-2">
          <div className="relative w-full max-w-md flex items-center shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter prompts by industry or category..."
              className="w-full text-xs h-9 pl-9 pr-4 border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 rounded-lg placeholder:text-zinc-400 shadow-3xs"
            />
          </div>
        </div>
      </FadeIn>

      {/* Templates cards list */}
      {filtered.length === 0 ? (
        <FadeIn>
          <div className="py-12 text-center bg-white border border-zinc-200 rounded-2xl text-zinc-400 text-xs font-bold">
            No prompt templates match your search category.
          </div>
        </FadeIn>
      ) : (
        <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map(t => (
            <StaggerItem key={t.id} className="bg-white border border-zinc-200/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-md uppercase tracking-wider">{t.category}</span>
                </div>
                <h3 className="text-sm font-black text-zinc-900 leading-snug">{t.title}</h3>
                <p className="text-xs text-zinc-550 font-medium leading-relaxed">{t.description}</p>
                
                {/* Code block box */}
                <div className="bg-zinc-50/50 border border-zinc-200/60 rounded-xl p-3.5 max-h-36 overflow-y-auto select-text font-mono text-[10px] text-zinc-650 leading-relaxed whitespace-pre-wrap">
                  {t.promptText}
                </div>
              </div>

              <Button
                onClick={() => handleCopyPrompt(t.id, t.promptText)}
                className="w-full h-8.5 text-xs font-extrabold bg-[#22577A] hover:bg-[#1A4461] text-white rounded-lg cursor-pointer border-none flex items-center justify-center gap-1.5"
              >
                {copiedId === t.id ? <><Check size={13} /> Copied to Clipboard</> : <><Clipboard size={13} /> Copy System Prompt</>}
              </Button>
            </StaggerItem>
          ))}
        </StaggerWrap>
      )}
    </div>
  );
}
