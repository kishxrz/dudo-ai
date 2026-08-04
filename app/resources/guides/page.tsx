'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { ArrowRight, Search } from 'lucide-react';
import { FadeUp, FadeIn, StaggerWrap, StaggerItem } from '@/components/resources/Animations';

export default function GuidesIndexPage() {
  const guides = ContentRepository.getGuides();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? guides.filter(g =>
        g.title.toLowerCase().includes(query.toLowerCase()) ||
        g.industry.toLowerCase().includes(query.toLowerCase()) ||
        g.description.toLowerCase().includes(query.toLowerCase())
      )
    : guides;

  return (
    <div className="space-y-8 select-none">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto space-y-3 pb-8 border-b border-zinc-200/50">
        <FadeUp delay={0}>
          <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
            Industry Deployment Guides
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-xl mx-auto">
            Deep operational blueprints outlining how distinct sectors structure Dudo AI Employees to schedule appointments and answer inquiries contextually.
          </p>
        </FadeUp>

        {/* Search bar */}
        <FadeIn delay={0.2}>
          <div className="relative w-full max-w-md mx-auto pt-2">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search guides..."
              className="w-full pl-9 pr-4 py-2.5 text-xs font-medium bg-white border border-zinc-200 rounded-xl text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A]/20 focus:border-[#22577A]/50 transition-all"
            />
          </div>
        </FadeIn>
      </div>

      {/* ── Guides Grid ────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(g => (
            <StaggerItem
              key={g.slug}
              className="bg-white border border-zinc-200/60 rounded-2xl p-6 flex flex-col justify-between gap-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex flex-col gap-3">
                <span className="inline-block self-start text-[8px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md uppercase tracking-widest">
                  {g.industry}
                </span>
                <div className="space-y-2">
                  <h3 className="text-sm sm:text-base font-black text-zinc-900 leading-snug">{g.title}</h3>
                  <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed">{g.description}</p>
                </div>
              </div>
              <Link
                href={`/resources/guides/${g.slug}`}
                className="text-[10px] font-bold text-[#22577A] hover:underline flex items-center gap-1.5 self-start"
              >
                Explore Deployment Guide <ArrowRight size={11} />
              </Link>
            </StaggerItem>
          ))}
        </StaggerWrap>
      ) : (
        <FadeIn>
          <div className="text-center py-20 text-zinc-400 text-sm font-medium">
            No guides match &ldquo;{query}&rdquo;.
          </div>
        </FadeIn>
      )}
    </div>
  );
}
