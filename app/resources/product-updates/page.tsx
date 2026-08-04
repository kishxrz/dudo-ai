'use client';

import React from 'react';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { Calendar, PlusCircle, CheckCircle2, AlertOctagon, GitPullRequest } from 'lucide-react';
import { FadeUp, StaggerWrap, StaggerItem } from '@/components/resources/Animations';

export default function ProductUpdatesPage() {
  const updates = ContentRepository.getProductUpdates();

  return (
    <div className="space-y-6 select-none">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto space-y-2 pb-6 border-b border-zinc-200/50">
        <FadeUp delay={0}>
          <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
            Changelog &amp; Product Updates
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-xl mx-auto">
            Follow the progress of Dudo engineering · Stay up to date on new API connectors, security layers, and UI enhancements.
          </p>
        </FadeUp>
      </div>

      {/* ── Vertical Timeline ──────────────────────────────────── */}
      <StaggerWrap className="relative border-l border-zinc-200 ml-3 pl-6 space-y-8 py-2">
        {updates.map(u => (
          <StaggerItem key={u.slug} className="relative">
            {/* Timeline node */}
            <span className="absolute -left-9.5 top-1 w-7 h-7 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[#22577A] shadow-3xs">
              <GitPullRequest size={12} />
            </span>

            {/* Content card */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200 max-w-2xl">
              <div className="flex flex-wrap gap-2 items-center justify-between border-b border-zinc-100 pb-3">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold bg-zinc-100 border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-md uppercase tracking-wider">{u.version}</span>
                  <h2 className="text-sm font-extrabold text-zinc-950 mt-1.5 uppercase tracking-wider">{u.title}</h2>
                </div>
                <span className="text-[9px] text-zinc-400 font-bold flex items-center gap-1"><Calendar size={11} /> {u.publishDate}</span>
              </div>

              <div className="space-y-4 text-xs font-semibold text-zinc-650 leading-relaxed pr-2">
                {u.features.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-bold text-[#22577A] uppercase tracking-widest flex items-center gap-1.5"><PlusCircle size={12} /> Features &amp; Key Upgrades</h4>
                    <ul className="list-disc list-inside pl-1 space-y-1 text-zinc-550">
                      {u.features.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {u.improvements.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={12} /> Improvements</h4>
                    <ul className="list-disc list-inside pl-1 space-y-1 text-zinc-550">
                      {u.improvements.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {u.fixes.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><AlertOctagon size={12} /> Fixes</h4>
                    <ul className="list-disc list-inside pl-1 space-y-1 text-zinc-550">
                      {u.fixes.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerWrap>

    </div>
  );
}
