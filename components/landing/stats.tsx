"use client";

import { Bot, Globe, Clock, ShieldCheck } from 'lucide-react';
import { statsItems } from '@/data/stats';
import AnimatedCounter from '@/components/ui/animated-counter';

import { motion } from 'framer-motion';

const iconMap = {
  Bot,
  Globe,
  Clock,
  ShieldCheck
};

export default function Stats() {
  return (
    <section className="relative bg-white py-32 border-y border-[#EED9B4]/30 overflow-hidden">
      {/* Subtle decorative background blur shapes */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-72 h-72 rounded-full bg-[#FFF8F0] blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-72 h-72 rounded-full bg-[#22577A]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {statsItems.map((item, idx) => {
            const Icon = iconMap[item.iconName];
            const isEven = idx % 2 === 0;
            const isLeft = idx < 2;
            return (
              <motion.div 
                key={idx} 
                className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col min-h-[260px]"
                initial={{ opacity: 0, x: isLeft ? -60 : 60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: idx * 0.1, ease: "easeOut" }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isEven 
                    ? 'bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] text-[#22577A]' 
                    : 'bg-gradient-to-br from-[#D8F3FF] to-[#A6E3FF] text-[#22577A]'
                }`}>
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="mt-6 flex flex-col flex-1">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#22577A]">
                    <AnimatedCounter value={item.value} />
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#22577A] mt-1">{item.label}</div>
                  <p className="text-xs sm:text-sm font-semibold text-zinc-550 leading-relaxed mt-4">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
