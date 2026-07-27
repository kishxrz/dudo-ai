"use client";

import Link from 'next/link';
import { ArrowRight, Check, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { COMPANY_NAME, SIGNUP_URL } from '@/lib/constants';
import AnimatedCounter from '@/components/ui/animated-counter';

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center py-32 lg:py-40 overflow-hidden bg-[#FFF8F0]">
      {/* Subtle decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-[#22577A]/10 blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#22577A]/10 blur-3xl opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-12 lg:gap-16 relative z-10">
        
        {/* Announcement badge centered globally - Prominent Large Launch Banner with Animated Fire */}
        <div className="flex justify-center w-full animate-float-slow">
          <div className="bg-gradient-to-r from-[#DBA11A] via-[#F3BE42] to-[#DBA11A] border-2 border-white/40 rounded-full px-6 sm:px-8 py-3 sm:py-3.5 flex items-center gap-3 shadow-[0_0_35px_rgba(219,161,26,0.6)] max-w-full overflow-hidden hover:scale-105 transition-transform duration-300">
            
            {/* Subtle Animated Fire Emoji */}
            <motion.span
              className="text-sm sm:text-base leading-none inline-block shrink-0 select-none"
              animate={{
                scale: [1, 1.15, 1],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              🔥
            </motion.span>

            <span className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-white leading-none whitespace-nowrap drop-shadow-xs flex items-center gap-2">
              <span>LAUNCH OFFER</span>
              <span>•</span>
              <span>₹2,499 FOR 6 MONTHS</span>
              <span>•</span>
              <span>60-SECOND SETUP</span>
            </span>
          </div>
        </div>

        <div className="w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* LEFT (55%) */}
          <div className="w-full lg:w-[55%] text-left space-y-8">

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-[#22577A] leading-[1.08]">
              <span className="whitespace-nowrap">Someone's Always</span> <br />
              <span className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] bg-clip-text text-transparent relative inline-block">
                Here.
              </span> <br />
              Even When You're{" "}
              <span className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] bg-clip-text text-transparent relative inline-block">
                Away.
              </span>
            </h1>
            <p className="text-xl sm:text-2xl font-black text-zinc-700 tracking-tight">
              Works 24/7. Never misses a customer.
            </p>
          </div>

          {/* Description */}
          <p className="text-sm sm:text-base text-[#6B7280] font-semibold leading-relaxed max-w-xl">
            Launch your AI employee in 60 seconds. {COMPANY_NAME} is the AI employee that answers every customer in your voice - 24/7, in Tamil, Hindi or English - for less than your monthly subscription
          </p>

          {/* CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Link 
              href={SIGNUP_URL} 
              className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white px-9 py-4.5 rounded-2xl text-sm sm:text-base font-black shadow-lg shadow-[#DBA11A]/20 hover:shadow-xl hover:shadow-[#DBA11A]/35 hover:-translate-y-0.5 active:translate-y-0 hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center justify-center gap-2.5 group"
            >
              Create Your AI Employee 
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link 
              href={SIGNUP_URL} 
              className="bg-white border-2 border-[#EED9B4] hover:bg-[#FFF8F0] text-[#22577A] px-9 py-4.5 rounded-2xl text-sm sm:text-base font-extrabold hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 text-center shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>

          <div className="text-[11px] font-extrabold uppercase text-[#6B7280]/70 tracking-widest flex items-center gap-1.5 select-none">
            <span>⏱ Takes less time than ordering chai ☕</span>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-6 text-xs sm:text-sm font-bold text-zinc-700 border-t border-[#EED9B4]/40 mt-8">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              60-second setup
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              No credit card needed
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              Multilingual support
            </span>
          </div>

        </div>

        {/* RIGHT (45%) */}
        <div className="w-full lg:w-[45%] relative">
          <div className="absolute -inset-8 bg-gradient-to-tr from-[#22577A]/15 to-[#22577A]/15 rounded-[40px] blur-3xl opacity-80 -z-10" />
          
          {/* Dashboard Mockup Wrapper for floating animation */}
          <div className="animate-float will-change-transform">
            {/* Dashboard Mockup */}
            <div className="bg-white rounded-[2rem] border border-[#EED9B4] shadow-[0_20px_50px_rgba(34,87,122,0.12)] p-6 relative select-none hover:shadow-[0_24px_60px_rgba(34,87,122,0.18)] hover:-translate-y-1.5 transition-[transform,box-shadow] duration-300">
              
              <div className="flex items-center gap-1.5 mb-6">
                <span className="w-3 h-3 rounded-full bg-red-400/80 block" />
                <span className="w-3 h-3 rounded-full bg-amber-400/80 block" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/80 block" />
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest ml-2">{COMPANY_NAME} Dashboard</span>
              </div>

              {/* Analytics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-4 border border-[#EED9B4]/40 shadow-xs space-y-1">
                  <div className="text-[9px] text-[#22577A] font-extrabold uppercase tracking-wider">Leads Responded</div>
                  <div className="text-xl font-black text-[#22577A]">
                    <AnimatedCounter value="1,482" />
                  </div>
                  <div className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                    <span>↑ 24% this week</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-[#EED9B4]/40 shadow-xs space-y-1">
                  <div className="text-[9px] text-[#22577A] font-extrabold uppercase tracking-wider">Response Speed</div>
                  <div className="text-xl font-black text-[#22577A]">
                    <AnimatedCounter value="1.8 seconds" />
                  </div>
                  <div className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                    <span>⚡ Instant Auto-reply</span>
                  </div>
                </div>
              </div>

              {/* Chat bubbles */}
              <div className="space-y-4 bg-[#FFF8F0]/50 rounded-2xl p-4 border border-[#EED9B4]/20">
                <div className="flex items-center justify-between border-b border-zinc-250/30 pb-2 mb-2">
                  <span className="text-[9px] font-extrabold text-[#22577A] tracking-wider uppercase">Live Activity</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-white text-zinc-800 rounded-2xl rounded-tr-none px-3.5 py-2 text-xs font-semibold shadow-xs border border-zinc-200/50">
                    "Hi, do you have hair coloring slots available tomorrow at 2 PM?"
                  </div>
                </div>

                <div className="flex justify-start items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#DBA11A] to-[#F3BE42] flex items-center justify-center text-white text-[9px] font-black shrink-0 mt-0.5 shadow-sm shadow-[#DBA11A]/20">
                    Du
                  </div>
                  <div className="max-w-[80%] bg-[#22577A] text-white rounded-2xl rounded-tl-none px-3.5 py-2 text-xs font-semibold shadow-md">
                    "Yes, Priya has a slot open tomorrow at 2:00 PM! Shall I book that in for you? 💇‍♀️ Slot is held for 5 minutes."
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-white text-zinc-800 rounded-2xl rounded-tr-none px-3.5 py-2 text-xs font-semibold shadow-xs border border-zinc-200/50">
                    "Yes please, slot booked!"
                  </div>
                </div>
              </div>

              {/* Floating popup (now clickable link to demo, floating outside) */}
              <div className="absolute bottom-[-36px] right-[-16px] sm:right-[-24px] z-20 animate-float-badge will-change-transform">
                <Link 
                  href="#use-cases" 
                  className="bg-white rounded-2xl p-3.5 border-2 border-emerald-500 shadow-[0_15px_35px_rgba(16,185,129,0.22)] flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-[transform,box-shadow] duration-300 cursor-pointer group inline-flex"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-zinc-800 flex items-center gap-1">
                      Lead Qualified & Booked
                      <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                    <div className="text-[8px] text-[#22577A] font-black uppercase tracking-wider">
                      Test Live Demo Chat
                    </div>
                  </div>
                </Link>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
  );
}
