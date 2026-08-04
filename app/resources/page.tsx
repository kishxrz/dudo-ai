'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { RevenueLossCalculator, RoiCalculator } from '@/components/resources/Calculators';
import { Search, FileText, RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { FadeUp, FadeIn, SlideUp, StaggerWrap, StaggerItem } from '@/components/resources/Animations';

export default function ResourcesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const articles = ContentRepository.getArticles({ sort: 'newest' });
  const featured = articles.find(a => a.featured) || articles[0];
  const latest = articles.filter(a => a.slug !== featured?.slug).slice(0, 3);
  
  const templates = ContentRepository.getTemplates().slice(0, 2);
  const updates = ContentRepository.getProductUpdates().slice(0, 1);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/resources/blog?search=${encodeURIComponent(search.trim())}`);
    }
  };


  return (
    <div className="space-y-10 pb-12">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto space-y-3 pb-6 border-b border-zinc-200/50 select-none">
        <FadeUp delay={0}>
          <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
            Dudo Resources Hub
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-xl mx-auto">
            Become an expert in autonomous operations · Estimate leakages, download prompts, and read product release changelogs.
          </p>
        </FadeUp>
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <FadeIn delay={0.15}>
        <div className="flex justify-center">
          <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md flex items-center shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles, guides, templates..."
              className="w-full text-xs h-9 pl-9 pr-4 border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 rounded-lg placeholder:text-zinc-400 shadow-3xs"
            />
          </form>
        </div>
      </FadeIn>

      {/* ── Featured + Latest Grid ────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {featured && (
          <SlideUp className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200 h-full flex flex-col">
            <div className="p-5 flex-1 flex flex-col justify-between space-y-3.5">
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 select-none">
                  <span className="text-[10px] text-zinc-400 font-bold">{featured.publishDate}</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-zinc-950 leading-tight">
                  <Link href={`/resources/blog/${featured.slug}`} className="hover:underline hover:text-[#22577A] transition-colors">
                    {featured.title}
                  </Link>
                </h2>
                <p className="text-xs text-zinc-550 leading-relaxed font-semibold">{featured.description}</p>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-zinc-100 select-none">
                <span className="text-[10px] text-zinc-400 font-bold">Author: {featured.authorId.toUpperCase()}</span>
                <Link href={`/resources/blog/${featured.slug}`} className="text-xs font-bold text-[#22577A] hover:underline flex items-center gap-1">
                  Read Article <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </SlideUp>
        )}

        <div className="flex flex-col h-full space-y-4">
          <FadeUp delay={0.05}>
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1 select-none">Latest Resources</h3>
          </FadeUp>
          <StaggerWrap className="flex-1 flex flex-col gap-3.5">
            {latest.map(article => (
              <StaggerItem key={article.slug} className="bg-white border border-zinc-200 rounded-xl p-4 hover:shadow-md hover:border-zinc-300 transition-all duration-200 shadow-sm flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 select-none">
                    <span className="text-[9px] text-zinc-400 font-bold">{article.publishDate}</span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-900 leading-snug">
                    <Link href={`/resources/blog/${article.slug}`} className="hover:underline hover:text-[#22577A] transition-colors">
                      {article.title}
                    </Link>
                  </h4>
                </div>
                <div className="pt-2 border-t border-zinc-100 flex justify-between items-center select-none">
                  <span className="text-[9px] text-zinc-400 font-bold">Author: {article.authorId.toUpperCase()}</span>
                  <Link href={`/resources/blog/${article.slug}`} className="text-[10px] font-bold text-[#22577A] hover:underline flex items-center gap-1.5">
                    Explore <ArrowRight size={10} />
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </StaggerWrap>
        </div>
      </section>

      {/* ── Calculators ──────────────────────────────────────────── */}
      <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <StaggerItem><RoiCalculator /></StaggerItem>
        <StaggerItem><RevenueLossCalculator /></StaggerItem>
      </StaggerWrap>

      {/* ── Quick Access Grid ─────────────────────────────────────── */}
      <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 select-none">
        {/* Templates */}
        <StaggerItem className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3.5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
            <span className="text-xs font-bold text-zinc-850 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={13} className="text-[#22577A]" /> Prompts
            </span>
            <Link href="/resources/templates" className="text-[10px] font-bold text-[#22577A] hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="space-y-1">
                <span className="text-xs font-semibold text-zinc-800 block">{t.title}</span>
                <p className="text-xs text-zinc-550 leading-normal line-clamp-1">{t.description}</p>
              </div>
            ))}
          </div>
        </StaggerItem>

        {/* Changelog */}
        <StaggerItem className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3.5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
            <span className="text-xs font-bold text-zinc-850 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw size={13} className="text-[#22577A]" /> Changelog
            </span>
            <Link href="/resources/product-updates" className="text-[10px] font-bold text-[#22577A] hover:underline">View Timeline</Link>
          </div>
          {updates.map(u => (
            <div key={u.slug} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-900">{u.title}</span>
                <span className="text-[8px] font-bold bg-zinc-100 border border-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded-md">{u.version}</span>
              </div>
              <ul className="list-disc list-inside pl-1 space-y-1 text-xs text-zinc-500 font-semibold line-clamp-2">
                {u.features.map((f, i) => (
                  <li key={i} className="truncate">{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </StaggerItem>
      </StaggerWrap>

    </div>
  );
}
