import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContentRepository } from '@/lib/resources/ContentRepository';
import { ChevronRight, ArrowLeft, Award } from 'lucide-react';

import AuthorAvatar from '@/components/resources/AuthorAvatar';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AuthorProfilePage({ params }: PageProps) {
  const { id } = await params;
  const author = ContentRepository.getAuthorById(id);
  if (!author) {
    notFound();
  }

  const articles = ContentRepository.getArticles({ authorId: id });

  return (
    <div className="space-y-5 select-none">
      <nav className="text-[10px] font-bold text-zinc-400">
        <Link href="/resources" className="hover:text-[#22577A] flex items-center gap-1">
          <ArrowLeft size={11} /> Back to Directory
        </Link>
      </nav>

      {/* Profile Card */}
      <section className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm">
        <AuthorAvatar 
          avatar={author.avatar} 
          name={author.name} 
          className="w-16 h-16 border-2 border-[#22577A]/10 shadow-2xs"
        />
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-black text-[#22577A] leading-none">{author.name}</h1>
            <span className="text-[9px] font-bold text-[#22577A] bg-[#22577A]/5 border border-[#22577A]/15 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Award size={10} /> Verified Author
            </span>
          </div>
          <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
            {author.bio}
          </p>

          <div className="flex gap-2 pt-1.5 text-zinc-400">
            {author.twitter && (
              <a 
                href={author.twitter} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-black transition-colors"
                title="Twitter Profile"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            )}
            {author.linkedin && (
              <a 
                href={author.linkedin} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-700 transition-colors"
                title="LinkedIn Profile"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Publications index */}
      <section className="space-y-4">
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-1">Articles Published by {author.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {articles.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-white border border-zinc-200 rounded-xl text-zinc-400 text-xs font-bold">
              No publications loaded for this author profile.
            </div>
          ) : (
            articles.map(article => (
              <div key={article.slug} className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col justify-between space-y-3.5 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] text-zinc-400 font-bold">
                    <span className="text-[#22577A] uppercase">{article.category}</span>
                    <span>{article.publishDate}</span>
                  </div>
                  <h3 className="text-xs font-bold text-zinc-900 leading-snug">
                    <Link href={`/resources/blog/${article.slug}`} className="hover:underline hover:text-[#22577A]">
                      {article.title}
                    </Link>
                  </h3>
                </div>
                <Link href={`/resources/blog/${article.slug}`} className="text-[10px] font-bold text-[#22577A] hover:underline flex items-center gap-1 self-start">
                  Read Article <ChevronRight size={10} />
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
