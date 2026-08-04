import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import MdxRenderer from '@/components/resources/MdxRenderer';
import ReadingProgressBar from '@/components/resources/ReadingProgressBar';
import SocialShare from '@/components/resources/SocialShare';
import TOC from '@/components/resources/TOC';
import { ArrowLeft, Calendar, Clock, ChevronRight } from 'lucide-react';

import AuthorAvatar from '@/components/resources/AuthorAvatar';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompetitorComparisonPage({ params }: PageProps) {
  const { slug } = await params;
  const comparison = ContentRepository.getComparisonBySlug(slug);
  if (!comparison) {
    notFound();
  }

  const author = ContentRepository.getAuthorById(comparison.authorId);
  const readTime = ContentRepository.calculateReadingTime(comparison.rawMdx);

  // Auto-generate headings checklist from headings inside rawMdx
  const headingRegex = /(?:^|\n)(#{2,3})\s+(.+)/g;
  const headings: { id: string; text: string }[] = [];
  let headingMatch;
  let keyCount = 1;

  while ((headingMatch = headingRegex.exec(comparison.rawMdx)) !== null) {
    const text = headingMatch[2].trim();
    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    headings.push({ id: id || `heading-${keyCount++}`, text });
  }

  // Pre-process rawMdx to inject IDs to heading targets
  let processedMdx = comparison.rawMdx;
  headings.forEach(h => {
    const escapedText = h.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rx = new RegExp(`(##|###)\\s+${escapedText}`, 'g');
    processedMdx = processedMdx.replace(rx, `$1 id="${h.id}" ${h.text}`);
  });

  return (
    <div className="space-y-8 select-text relative">
      <ReadingProgressBar />

      {/* Breadcrumbs navigation */}
      <nav className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 select-none">
        <Link href="/resources" className="hover:text-[#22577A]">Resources</Link>
        <ChevronRight size={10} />
        <Link href="/resources/compare" className="hover:text-[#22577A]">Compare</Link>
        <ChevronRight size={10} />
        <span className="text-zinc-500 truncate max-w-xs">{comparison.title}</span>
      </nav>

      {/* Main Grid Layout: left column spans 3, right column spans 1 */}
      <div className="max-w-[1080px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
        {/* Left Side: Header, Article Body, QA, Playlist */}
        <div className="lg:col-span-3 max-w-[720px] w-full mx-auto space-y-8">
          {/* Comparison Header */}
          <header className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-black text-[#22577A] tracking-tight leading-tight">
              {comparison.title}
            </h1>

            <div className="flex items-center gap-2 select-none">
              <span className="text-[9px] font-bold px-2.5 py-0.5 bg-orange-55 text-orange-600 border border-orange-100 rounded-md uppercase tracking-wider">
                VS {comparison.competitor}
              </span>
            </div>
          </header>

          {/* Curated Cover Image Hero Block */}
          {comparison.coverImage && (
            <div className="w-full h-48 sm:h-72 rounded-xl overflow-hidden border border-zinc-150 shadow-3xs select-none">
              <img 
                src={comparison.coverImage} 
                alt={comparison.title} 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Comparison body */}
          <section className="prose prose-zinc max-w-none text-zinc-800">
            <MdxRenderer content={processedMdx} />
          </section>

          {/* Back link */}
          <div className="pt-6 border-t border-zinc-100 select-none">
            <Link href="/resources/compare" className="text-xs font-bold text-[#22577A] hover:underline flex items-center gap-1.5">
              <ArrowLeft size={13} /> Back to Competitor Comparisons
            </Link>
          </div>

          {/* Subtle Try Dudo CTA */}
          <div className="pt-8 select-none text-center">
            <p className="text-xs text-zinc-550 font-semibold">
              Looking to deploy your own AI Employee?{' '}
              <Link href="/" className="text-[#22577A] font-bold hover:underline">
                Try Dudo Free &rarr;
              </Link>
            </p>
          </div>
        </div>

        {/* Right Side: Sticky Reading Utilities & TOC */}
        <div className="space-y-8 select-none">
          <div className="sticky top-24 space-y-8">
            {/* Author profile info details */}
            {author && (
              <div className="space-y-3.5 border-b border-zinc-100 pb-6">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Author</span>
                <div className="flex items-center gap-3">
                  <AuthorAvatar avatar={author.avatar} name={author.name} className="w-8 h-8 shrink-0" />
                  <div>
                    <Link href={`/resources/authors/${author.id}`} className="text-xs font-extrabold text-zinc-900 hover:text-[#22577A] block leading-none">
                      {author.name}
                    </Link>
                    <span className="text-[9px] text-zinc-400 mt-1 block">Roster Lead</span>
                  </div>
                </div>
              </div>
            )}

            {/* Reading Center metrics */}
            <div className="space-y-4 border-b border-zinc-100 pb-6">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Reading Info</span>
              <div className="space-y-2.5 text-xs font-semibold text-zinc-660">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-450">Read Time:</span>
                  <span className="text-zinc-800 font-bold">{readTime} min read</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-450">Published:</span>
                  <span className="text-zinc-800 font-bold">{comparison.publishDate}</span>
                </div>
              </div>
            </div>

            {/* Sticky Table of Contents */}
            <TOC headings={headings} />

            {/* Share tools */}
            <SocialShare title={comparison.title} slug={comparison.slug} />
          </div>
        </div>
      </div>
    </div>
  );
}
