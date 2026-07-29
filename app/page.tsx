"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/landing/navbar';
import Hero from '@/components/landing/hero';
import Stats from '@/components/landing/stats';
import Comparison from '@/components/landing/comparison';
import UseCases from '@/components/landing/usecases';
import RoiCalculator from '@/components/landing/roi-calculator';
import Pricing from '@/components/landing/pricing';
import Testimonial from '@/components/landing/testimonial';
import FAQ from '@/components/landing/FAQ';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/footer';
import { Coins, Languages, Globe } from 'lucide-react';
import { saasFeatures } from '@/data/saas';
import { aiProviders } from '@/data/providers';
import { motion } from 'framer-motion';

const iconMap = {
  Coins,
  Languages,
  Globe
};

export default function LandingPage() {
  const router = useRouter();
  const { currentUser, loading } = useAuth();



  useEffect(() => {
    const content = document.getElementById('landing-content');
    if (!content) return;

    // Find all headings, paragraphs and list items to animate
    const textElements = content.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.02,
      rootMargin: '0px 0px -28px 0px'
    });

    textElements.forEach((el) => {
      el.classList.add('slide-up-text');
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-[#DB1A1A]/10 selection:text-[#DB1A1A] antialiased">
      
      {/* 2. NAVBAR */}
      <Navbar />

      <div id="landing-content">
        {/* 1 HERO */}
        <Hero />

        {/* 3 STATS BAR */}
        <Stats />

        {/* 4 "WITHOUT DUDO" & 5 "WITH DUDO" */}
        <Comparison />

        {/* 7 INDUSTRY CARDS */}
        <UseCases />

        {/* 7.5 INDIAN SAAS */}
        {/* 7.5 INDIAN SAAS */}
        <section className="py-32 bg-[#FFF3E5] border-y border-[#EED9B4]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-16">
            
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Badge */}
              <div className="inline-flex max-w-full">
                <div className="bg-white border border-[#EED9B4] rounded-full px-3.5 py-1.5 flex items-center gap-1.5 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" className="w-5 h-3.5 shrink-0 rounded-[2px] shadow-xs border border-zinc-200/40">
                    <rect width="900" height="200" fill="#FF9933" />
                    <rect y="200" width="900" height="200" fill="#FFFFFF" />
                    <rect y="400" width="900" height="200" fill="#138808" />
                    <g transform="translate(450, 300)">
                      <circle r="92" fill="none" stroke="#000080" strokeWidth="10" />
                      <circle r="16" fill="#000080" />
                      {Array.from({ length: 24 }).map((_, i) => (
                        <line key={i} y1="-92" y2="0" stroke="#000080" strokeWidth="6" transform={`rotate(${(i * 360) / 24})`} />
                      ))}
                    </g>
                  </svg>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 leading-none">
                    Built in India · for Indian businesses
                  </span>
                </div>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight mt-2">
                We&apos;re an Indian SaaS - and we charge like one
              </h2>
              <p className="text-sm sm:text-base text-zinc-500 font-semibold max-w-xl mx-auto mt-4">
                Fair pricing, regional voice, and bring your own keys. No unnecessary markup.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
              {saasFeatures.map((card, idx) => {
                const Icon = iconMap[card.iconName];
                const isEven = idx % 2 === 0;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: idx * 0.15, ease: "easeOut" }}
                    className="w-full h-full flex"
                  >
                    <div 
                      className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 space-y-6 hover:shadow-2xl hover:-translate-y-1.5 transition-[transform,box-shadow] duration-300 shadow-lg flex flex-col justify-between min-h-[240px] w-full"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        isEven 
                          ? 'bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] text-[#22577A]' 
                          : 'bg-gradient-to-br from-[#D8F3FF] to-[#A6E3FF] text-[#22577A]'
                      }`}>
                        <Icon className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-black text-sm sm:text-base text-[#22577A] tracking-tight">
                          {card.title}
                        </h3>
                        <p className="text-xs sm:text-sm font-semibold text-zinc-555 leading-relaxed">
                          {card.desc}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

          </div>
        </section>

        {/* 7.6 AI PROVIDERS */}
        <section className="py-32 bg-white border-b border-[#EED9B4]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
            
            <div className="space-y-4 max-w-3xl mx-auto">
              <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
                INTEGRATIONS
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
                Bring Your Own AI. We Support Them All.
              </h2>
              <p className="text-sm sm:text-base text-zinc-500 font-semibold max-w-2xl mx-auto mt-4">
                Use your own API key from any major provider. You control the model, the cost, and the data.
              </p>
            </div>

            {/* 8 Provider cards in a row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 pt-4 select-none">
              {aiProviders.map((provider, idx) => {
                const isLeft = idx < 4;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: idx * 0.05, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <motion.div 
                      className="bg-white border border-zinc-200/70 rounded-2xl p-5 flex flex-col items-center justify-between text-center shadow-xs min-h-[160px] w-full h-full will-change-transform transform-gpu"
                      animate={{
                        y: [0, -5, 0],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: idx * 0.2,
                      }}
                      whileHover={{
                        scale: 1.03,
                        y: -8,
                        transition: { duration: 0.2, ease: "easeOut" }
                      }}
                    >
                      <div className="w-12 h-12 flex items-center justify-center mb-2">
                        {provider.logo}
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-black text-zinc-900 tracking-tight leading-none">
                          {provider.name}
                        </div>
                        <div className="text-[9px] font-bold text-zinc-400 leading-tight">
                          {provider.subtext}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <p className="text-xs font-bold text-[#22577A] bg-[#FFE7B5]/25 border border-[#EED9B4] rounded-lg px-4 py-2 inline-block max-w-lg mx-auto">
              💡 Don&apos;t have an API key? Groq offers a free tier - perfect for getting started.
            </p>
          </div>
        </section>

        {/* 7.7 ROI CALCULATOR */}
        <RoiCalculator />

        {/* 8 PRICING */}
        <Pricing />

        {/* 10 TESTIMONIALS */}
        <Testimonial />

        {/* 11 FAQ */}
        <FAQ />

        {/* 12 FINAL CTA */}
        <CTA />
      </div>

      {/* 13 FOOTER */}
      <Footer />

    </div>
  );
}
