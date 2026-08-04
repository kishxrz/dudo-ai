'use client';

import React from 'react';
import Link from 'next/link';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { HelpCircle, ArrowRight, ShieldAlert } from 'lucide-react';

export default function CompareIndexPage() {
  const comparisons = ContentRepository.getComparisons();

  return (
    <div className="space-y-6 select-none">
      {/* Centered Top Header Section */}
      <div className="text-center max-w-2xl mx-auto space-y-2 pb-6 border-b border-zinc-200/50 select-none">
        <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
          Platform Competitor Comparisons
        </h1>
        <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-xl mx-auto">
          See how Dudo features compare against legacy marketing flowcharts and traditional live-chat support widgets.
        </p>
      </div>

      {/* Comparisons grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {comparisons.map(c => (
          <div key={c.slug} className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:shadow-md hover:border-zinc-300 transition-all duration-200 shadow-sm">
            <div className="space-y-3">
              <span className="text-[8px] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-md uppercase tracking-wider">vs {c.competitor}</span>
              <h3 className="text-sm sm:text-base font-black text-zinc-900 leading-snug">{c.title}</h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">In-depth feature matching, integration scopes, and operational cost differences review.</p>
            </div>
            
            <Link 
              href={`/resources/compare/${c.slug}`} 
              className="text-[10px] font-bold text-[#22577A] hover:underline flex items-center gap-1.5 self-start"
            >
              Read Comparison Report <ArrowRight size={11} />
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
