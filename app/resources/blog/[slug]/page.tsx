import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import MdxRenderer from '@/components/resources/MdxRenderer';
import TOC from '@/components/resources/TOC';
import AskDudoAI from '@/components/resources/AskDudoAI';
import ReadingProgressBar from '@/components/resources/ReadingProgressBar';
import SocialShare from '@/components/resources/SocialShare';
import AuthorAvatar from '@/components/resources/AuthorAvatar';
import { Sparkles, Calendar, Clock, ChevronRight, BookOpen } from 'lucide-react';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = ContentRepository.getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: `${article.title} | Dudo Resources`,
    description: article.seoDescription || article.description,
    keywords: article.seoKeywords || article.tags,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      url: `/resources/blog/${slug}`,
      publishedTime: article.publishDate,
      tags: article.tags
    }
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const article = ContentRepository.getArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const author = ContentRepository.getAuthorById(article.authorId);
  const readTime = ContentRepository.calculateReadingTime(article.rawMdx);
  const related = ContentRepository.getRelatedArticles(article, 3);

  // Auto-generate headings checklist from headings inside rawMdx
  const headingRegex = /(?:^|\n)(#{2,3})\s+(.+)/g;
  const headings: { id: string; text: string }[] = [];
  let headingMatch;
  let keyCount = 1;

  while ((headingMatch = headingRegex.exec(article.rawMdx)) !== null) {
    const text = headingMatch[2].trim();
    const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    headings.push({ id: id || `heading-${keyCount++}`, text });
  }

  // Pre-process rawMdx to inject IDs to heading targets
  let processedMdx = article.rawMdx;
  headings.forEach(h => {
    // Escape string for regex replacement safely
    const escapedText = h.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rx = new RegExp(`(##|###)\\s+${escapedText}`, 'g');
    processedMdx = processedMdx.replace(rx, `$1 id="${h.id}" ${h.text}`);
  });

  // Schema structured JSON-LD data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    'headline': article.title,
    'description': article.description,
    'datePublished': article.publishDate,
    'author': {
      '@type': 'Person',
      'name': author?.name || 'Dudo Team',
      'url': `/resources/authors/${article.authorId}`
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Dudo AI',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://dudo.ai/logo.png'
      }
    }
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Resources',
        'item': 'https://dudo.ai/resources'
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Blog',
        'item': 'https://dudo.ai/resources/blog'
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': article.title,
        'item': `https://dudo.ai/resources/blog/${article.slug}`
      }
    ]
  };

  return (
    <article className="space-y-8 select-text relative">
      <ReadingProgressBar />

      {/* JSON-LD Script Injections */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 select-none">
        <Link href="/resources" className="hover:text-[#22577A]">Resources</Link>
        <ChevronRight size={10} />
        <Link href="/resources/blog" className="hover:text-[#22577A]">Blog</Link>
        <ChevronRight size={10} />
        <span className="text-zinc-500 truncate max-w-xs">{article.title}</span>
      </nav>

      {/* Main Grid Layout: left column spans 3, right column spans 1 */}
      <div className="max-w-[1080px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
        {/* Left Side: Header, Article Body, QA, Playlist */}
        <div className="lg:col-span-3 max-w-[720px] w-full mx-auto space-y-8">
          {/* Main Metadata Header */}
          <header className="space-y-4">
            <h1 className="text-2xl sm:text-3xl font-black text-[#22577A] tracking-tight leading-tight">
              {article.title}
            </h1>

            <p className="text-sm sm:text-base text-zinc-500 font-medium leading-relaxed italic">
              {article.description}
            </p>
          </header>

          {/* Curated Cover Image Hero Block */}
          {article.coverImage && (
            <div className="w-full h-48 sm:h-72 rounded-xl overflow-hidden border border-zinc-150 shadow-3xs select-none">
              <img 
                src={article.coverImage} 
                alt={article.title} 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Guide MDX Body */}
          <section className="prose prose-zinc max-w-none text-zinc-800">
            <MdxRenderer content={processedMdx} />
          </section>

          {/* Tags list */}
          <div className="flex flex-wrap gap-1.5 pt-6 select-none border-t border-zinc-100">
            {article.tags.map(t => (
              <span key={t} className="text-[8px] font-bold bg-zinc-100 border border-zinc-150 text-zinc-500 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                #{t}
              </span>
            ))}
          </div>

          {/* Contextual Ask Dudo AI Prompt */}
          <AskDudoAI articleSlug={article.slug} articleTitle={article.title} />

          {/* Series Navigation Footer Section */}
          {article.seriesId && (
            <section className="border-t border-zinc-100 pt-8 select-none">
              <div className="bg-zinc-50/50 border border-zinc-150 rounded-xl p-5 space-y-3 shadow-3xs">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Series Playlist</span>
                  <h4 className="text-xs font-bold text-[#22577A] mt-1 uppercase tracking-wider">AI Employee Masterclass</h4>
                </div>
                <div className="space-y-2">
                  {ContentRepository.getSeriesArticles(article.seriesId).map(s => (
                    <div key={s.slug} className="flex justify-between items-center text-xs">
                      <Link 
                        href={`/resources/blog/${s.slug}`} 
                        className={`hover:underline font-semibold ${s.slug === article.slug ? 'text-[#22577A] font-bold' : 'text-zinc-500'}`}
                      >
                        Part {s.seriesPart}: {s.title}
                      </Link>
                      {s.slug === article.slug && <span className="text-[9px] font-bold bg-[#22577A]/10 text-[#22577A] px-2 py-0.5 rounded-md">Current</span>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Subtle Try Dudo CTA */}
          <div className="pt-8 select-none text-center">
            <p className="text-xs text-zinc-500 font-semibold">
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
                    <span className="text-[9px] text-zinc-400 mt-1 block">Contributor</span>
                  </div>
                </div>
              </div>
            )}

            {/* Reading Center metrics */}
            <div className="space-y-4 border-b border-zinc-100 pb-6">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Reading Info</span>
              <div className="space-y-2.5 text-xs font-semibold text-zinc-600">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-450">Read Time:</span>
                  <span className="text-zinc-800 font-bold">{readTime} min read</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-450">Published:</span>
                  <span className="text-zinc-800 font-bold">{article.publishDate}</span>
                </div>
              </div>
            </div>

            {/* Sticky Table of Contents */}
            <TOC headings={headings} />

            {/* Share tools */}
            <SocialShare title={article.title} slug={article.slug} />
          </div>
        </div>
      </div>

      {/* Recommended Related Articles */}
      <section className="border-t border-zinc-100 pt-10 space-y-4 select-none">
        <h3 className="text-xs font-bold text-zinc-850 uppercase tracking-widest flex items-center gap-1.5">
          <BookOpen size={13} className="text-[#22577A]" /> Related Content recommendations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {related.map(r => (
            <div key={r.slug} className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between space-y-3.5 shadow-3xs hover:shadow-2xs hover:border-zinc-300 transition-all duration-200">
              <div className="space-y-2">
                <span className="text-[8px] font-bold text-[#22577A] uppercase bg-[#22577A]/5 border border-[#22577A]/15 px-2 py-0.5 rounded-md">{r.category}</span>
                <h4 className="text-xs font-bold text-zinc-900 leading-snug">
                  <Link href={`/resources/blog/${r.slug}`} className="hover:underline hover:text-[#22577A] transition-colors">
                    {r.title}
                  </Link>
                </h4>
              </div>
              <Link href={`/resources/blog/${r.slug}`} className="text-[10px] font-bold text-[#22577A] hover:underline flex items-center gap-1">
                Read Article <ChevronRight size={10} />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
