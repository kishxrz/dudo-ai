'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, List } from 'lucide-react';

interface HeadingItem {
  id: string;
  text: string;
}

interface TOCProps {
  headings: HeadingItem[];
}

export default function TOC({ headings }: TOCProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const observers = new Map();
    
    const callback = (entries: IntersectionObserverEntry[]) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length > 0) {
        // Active heading is the first one visible from top
        setActiveId(visible[0].target.id);
      }
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    });

    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) {
        observer.observe(el);
        observers.set(h.id, el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      setMobileOpen(false);
    }
  };

  if (headings.length === 0) return null;

  return (
    <>
      {/* Desktop Sticky Sidebar TOC */}
      <nav className="hidden lg:block sticky top-28 self-start space-y-3.5 select-none w-56 pr-2">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <List size={12} /> Table of Contents
        </h4>
        <ul className="space-y-2 border-l border-zinc-100 pl-3">
          {headings.map(h => (
            <li key={h.id}>
              <button
                onClick={() => scrollTo(h.id)}
                className={cn(
                  "text-left text-[11px] font-semibold block transition-colors leading-relaxed hover:text-[#22577A] focus:outline-none cursor-pointer",
                  activeId === h.id 
                    ? "text-[#22577A] font-bold scale-102 origin-left" 
                    : "text-zinc-400"
                )}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile Collapsible Dropdown TOC */}
      <div className="block lg:hidden border border-zinc-200 bg-white rounded-xl p-3.5 my-4 select-none shadow-sm">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between text-xs font-bold text-zinc-800 focus:outline-none cursor-pointer uppercase tracking-wider"
        >
          <span className="flex items-center gap-1.5">
            <List size={14} className="text-[#22577A]" /> Table of Contents
          </span>
          <ChevronDown size={14} className={cn("transition-transform duration-200", mobileOpen && "rotate-180")} />
        </button>
        {mobileOpen && (
          <ul className="mt-3.5 pl-5 list-disc list-inside space-y-2 text-xs font-semibold text-zinc-500 border-t border-zinc-250/60 pt-3">
            {headings.map(h => (
              <li key={h.id}>
                <button
                  onClick={() => scrollTo(h.id)}
                  className={cn(
                    "hover:text-[#22577A] text-left transition-colors cursor-pointer inline-block",
                    activeId === h.id ? "text-[#22577A] font-bold" : "text-zinc-450"
                  )}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
