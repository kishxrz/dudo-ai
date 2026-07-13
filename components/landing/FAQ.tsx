'use client';

import React, { useState } from 'react';
import { Minus, Plus, HelpCircle } from 'lucide-react';
import { faqItems } from "@/data/faq";
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORT_EMAIL } from '@/lib/constants';

export default function FAQ() {
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setActiveFAQ(activeFAQ === index ? null : index);
  };

  return (
    <section id="faq" className="py-32 bg-[#FFF8F0] border-t border-[#EED9B4]/30 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-[#22577A]/5 blur-3xl opacity-30 pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-16 relative z-10">
        
        <div className="space-y-4">
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            The questions every business owner asks us
          </h2>
          <p className="text-sm sm:text-base text-zinc-500 font-semibold mt-4">
            Straight answers. No fluff.
          </p>
        </div>

        {/* Accordions */}
        <div className="divide-y divide-[#EED9B4]/40 text-left border-y border-[#EED9B4]/40 select-none">
          {faqItems.map((item, idx) => {
            const isOpen = activeFAQ === idx;
            return (
              <div key={idx} className="py-4.5">
                <button 
                  onClick={() => toggleFAQ(idx)}
                  className="w-full flex items-center justify-between py-2 text-left cursor-pointer border-none bg-transparent hover:text-[#22577A] transition-colors group"
                >
                  <span className="text-xs sm:text-sm font-extrabold text-[#22577A] group-hover:text-[#22577A] transition-colors leading-tight">
                    {item.q}
                  </span>
                  <span className="shrink-0 ml-4 text-zinc-400 group-hover:text-[#22577A] transition-colors">
                    {isOpen ? (
                      <Minus className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <Plus className="w-4 h-4 stroke-[3]" />
                    )}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pb-2 text-xs sm:text-sm font-semibold text-zinc-550 leading-relaxed pr-6 select-text">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Contact Block */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-6 text-left max-w-2xl mx-auto"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] text-[#22577A] flex items-center justify-center shrink-0 shadow-xs">
              <HelpCircle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-sm font-black text-[#22577A]">Still have questions?</div>
              <p className="text-xs text-zinc-500 font-semibold mt-0.5">We're happy to chat or hop on a call.</p>
            </div>
          </div>
          <a 
            href={`mailto:${SUPPORT_EMAIL}`}
            className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white px-6 py-3 rounded-xl text-xs font-black transition-all duration-300 shadow-md shadow-[#DBA11A]/20 hover:shadow-lg hover:shadow-[#DBA11A]/35 hover:-translate-y-0.5 active:translate-y-0 hover:scale-105 inline-flex items-center justify-center shrink-0 cursor-pointer"
          >
            Email {SUPPORT_EMAIL}
          </a>
        </motion.div>

      </div>
    </section>
  );
}
