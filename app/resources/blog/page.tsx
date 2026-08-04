'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FadeUp, FadeIn, StaggerWrap, StaggerItem } from '@/components/resources/Animations';

export default function BlogListPage() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('search') || '';
  const [search, setSearch] = useState(urlQuery);

  useEffect(() => { setSearch(urlQuery); }, [urlQuery]);

  const filteredArticles = useMemo(() =>
    ContentRepository.getArticles({ category: 'All', search: search.trim(), sort: 'newest' }),
    [search]
  );


  return (
    <div className="space-y-6 select-none">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="text-center max-w-2xl mx-auto space-y-2 pb-6 border-b border-zinc-200/50">
        <FadeUp delay={0}>
          <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
            Resource Articles &amp; Publications
          </h1>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 leading-relaxed max-w-xl mx-auto">
            Deep dives, automation tutorials, and corporate updates written by Dudo founders and domain architects.
          </p>
        </FadeUp>
      </div>

      {/* ── Search ─────────────────────────────────────────────── */}
      <FadeIn delay={0.15}>
        <div className="flex justify-center pb-6">
          <div className="relative w-full max-w-md flex items-center shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search publications..."
              className="w-full text-xs h-9 pl-9 pr-4 border border-zinc-200 focus:outline-none focus:border-zinc-400 bg-white text-zinc-800 rounded-lg placeholder:text-zinc-400 shadow-3xs"
            />
          </div>
        </div>
      </FadeIn>

      {/* ── Articles Grid ──────────────────────────────────────── */}
      {filteredArticles.length === 0 ? (
        <FadeIn>
          <div className="col-span-full text-center py-12 bg-white border border-zinc-200 rounded-2xl">
            <Search className="mx-auto text-zinc-300 mb-3" size={32} />
            <h4 className="text-xs font-bold text-zinc-800">No resources found matching parameters</h4>
            <p className="text-[10px] text-zinc-400 mt-1">Try checking your search query.</p>
          </div>
        </FadeIn>
      ) : (
        <StaggerWrap className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map(article => {
            const author = ContentRepository.getAuthorById(article.authorId);
            const readTime = ContentRepository.calculateReadingTime(article.rawMdx);
            return (
              <StaggerItem key={article.slug} className="bg-white border border-zinc-200/60 rounded-2xl overflow-hidden hover:shadow-sm hover:-translate-y-0.5 duration-300 transition-all flex flex-col h-full">
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3.5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-zinc-450 font-bold">{article.publishDate}</span>
                    </div>
                    <h3 className="text-sm font-black text-zinc-900 leading-snug">
                      <Link href={`/resources/blog/${article.slug}`} className="hover:underline hover:text-[#22577A] transition-colors">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed font-semibold line-clamp-3">{article.description}</p>
                  </div>
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {author && (
                        <img src={author.avatar} alt={author.name} className="w-5 h-5 rounded-full object-cover border border-zinc-200" />
                      )}
                      <span className="text-[9px] text-zinc-400 font-bold">By {author?.name || 'Dudo'}</span>
                    </div>
                    <span className="text-[9px] text-zinc-400 font-bold">{readTime} min read</span>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerWrap>
      )}
    </div>
  );
}
