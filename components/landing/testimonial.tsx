"use client";

import { Star } from 'lucide-react';
import { testimonials } from '@/data/testimonials';

export default function Testimonial() {
  const row1 = testimonials.slice(0, 6);
  const row2 = testimonials.slice(6, 12);

  // Duplicate arrays to create seamless looping marquee tracks
  const row1Items = [...row1, ...row1];
  const row2Items = [...row2, ...row2];

  return (
    <section className="py-24 sm:py-32 bg-white border-t border-[#EED9B4]/30 relative overflow-hidden select-none">
      
      {/* Inline styles for high-performance GPU-accelerated scrolling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scroll-right {
          0% {
            transform: translate3d(-50%, 0, 0);
          }
          100% {
            transform: translate3d(0%, 0, 0);
          }
        }
        @keyframes scroll-left {
          0% {
            transform: translate3d(0%, 0, 0);
          }
          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }
        .marquee-track-right {
          display: flex;
          width: max-content;
          gap: 1.5rem;
          animation: scroll-right 45s linear infinite;
        }
        .marquee-track-left {
          display: flex;
          width: max-content;
          gap: 1.5rem;
          animation: scroll-left 45s linear infinite;
        }
        .marquee-container:hover .marquee-track-right,
        .marquee-container:hover .marquee-track-left {
          animation-play-state: paused;
        }
      ` }} />

      {/* Decorative backdrop blobs */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 rounded-full bg-[#FFF8F0] blur-3xl pointer-events-none" />

      <div className="space-y-16 relative z-10">
        
        {/* Header */}
        <div className="space-y-4 max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            CUSTOMER STORIES
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            Trusted by businesses that can't afford to miss clients
          </h2>
          <p className="text-sm sm:text-base text-zinc-500 font-semibold max-w-xl mx-auto mt-4">
            From Chennai to Mumbai, Indian SMB owners use Dudo to answer every enquiry.
          </p>
        </div>

        {/* Marquee Wrapper Container */}
        <div className="marquee-container space-y-8 overflow-hidden w-full relative">
          
          {/* Gradient Overlays for smooth side fades */}
          <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-25 pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-25 pointer-events-none" />

          {/* ROW 1: Moves Left to Right (scroll-right animation) */}
          <div className="flex w-full overflow-hidden">
            <div className="marquee-track-right px-3">
              {row1Items.map((item, idx) => (
                <div 
                  key={`r1-${idx}`}
                  className="w-[320px] sm:w-[380px] shrink-0 bg-white border border-[#EED9B4] rounded-[2rem] p-6.5 sm:p-8 shadow-sm hover:shadow-lg hover:border-[#22577A] transition-all duration-300 flex flex-col justify-between min-h-[220px] relative"
                >
                  <span className="text-[#22577A]/5 font-serif text-5xl leading-none absolute right-6 top-6 pointer-events-none select-none">“</span>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pr-6">
                      <span className="bg-[#22577A]/5 text-[#22577A] border border-[#22577A]/10 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                        {item.category}
                      </span>
                      <div className="flex gap-0.5">
                        {[...Array(item.stars)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold text-zinc-650 leading-relaxed italic">
                      "{item.quote}"
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#EED9B4]/30 pt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#FFE7B5]/85 text-[#22577A] flex items-center justify-center text-[10px] font-black uppercase shadow-xs shrink-0">
                        {item.initials}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-[#22577A] leading-tight">{item.author}</div>
                        <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider leading-none mt-0.5">{item.role} · {item.location}</div>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                      {item.result}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ROW 2: Moves Right to Left (scroll-left animation) */}
          <div className="flex w-full overflow-hidden">
            <div className="marquee-track-left px-3">
              {row2Items.map((item, idx) => (
                <div 
                  key={`r2-${idx}`}
                  className="w-[320px] sm:w-[380px] shrink-0 bg-white border border-[#EED9B4] rounded-[2rem] p-6.5 sm:p-8 shadow-sm hover:shadow-lg hover:border-[#22577A] transition-all duration-300 flex flex-col justify-between min-h-[220px] relative"
                >
                  <span className="text-[#22577A]/5 font-serif text-5xl leading-none absolute right-6 top-6 pointer-events-none select-none">“</span>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pr-6">
                      <span className="bg-[#22577A]/5 text-[#22577A] border border-[#22577A]/10 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                        {item.category}
                      </span>
                      <div className="flex gap-0.5">
                        {[...Array(item.stars)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] sm:text-xs font-semibold text-zinc-650 leading-relaxed italic">
                      "{item.quote}"
                    </p>
                  </div>

                  <div className="mt-6 border-t border-[#EED9B4]/30 pt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#FFE7B5]/85 text-[#22577A] flex items-center justify-center text-[10px] font-black uppercase shadow-xs shrink-0">
                        {item.initials}
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-[#22577A] leading-tight">{item.author}</div>
                        <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider leading-none mt-0.5">{item.role} · {item.location}</div>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                      {item.result}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Trust Bar */}
        <div className="pt-6 border-t border-zinc-150 max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs font-bold text-zinc-500 select-none px-4 text-center">
          <span className="flex items-center gap-1.5 text-amber-500 font-black">
            ★★★★★ <span className="text-zinc-500 font-bold ml-1">Rated by Early Customers</span>
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 hidden sm:inline" />
          <span>Replies in under 10 seconds</span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 hidden sm:inline" />
          <span>Works 24/7</span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 hidden sm:inline" />
          <span>Secure</span>
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 hidden sm:inline" />
          <span>No Credit Card Required</span>
        </div>

      </div>
    </section>
  );
}
