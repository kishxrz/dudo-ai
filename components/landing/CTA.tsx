'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COMPANY_NAME, SIGNUP_URL } from '@/lib/constants';
import AnimatedCounter from '@/components/ui/animated-counter';
import { motion } from 'framer-motion';

export default function CTA() {
  return (
    <section className="bg-gradient-to-br from-[#1A4461] to-[#22577A] text-white py-32 relative overflow-hidden">
      
      {/* Background visual detail */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#22577A]/10 blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-[#22577A]/30 blur-3xl opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Side: Content & Actions */}
          <motion.div 
            className="lg:col-span-7 text-left space-y-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            
            <div className="space-y-4">
              <span className="text-white/70 text-xs font-extrabold uppercase tracking-widest block">
                READY TO START?
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                Your competitors never sleep. <br />
                Now neither does your business.
              </h2>
              <p className="text-sm sm:text-base text-blue-100 max-w-xl leading-relaxed">
                Every missed message is a customer choosing someone else. Let {COMPANY_NAME} answer every enquiry while you focus on growing your business.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link 
                href={SIGNUP_URL} 
                className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white px-8 py-4.5 rounded-2xl text-base sm:text-lg font-black shadow-lg shadow-[#DBA11A]/20 hover:shadow-xl hover:shadow-[#DBA11A]/35 hover:-translate-y-0.5 active:translate-y-0 hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center justify-center gap-2 group cursor-pointer"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link 
                href="#use-cases"
                className="bg-white/10 border border-white/20 hover:bg-white/20 text-white px-8 py-4.5 rounded-2xl text-base sm:text-lg font-extrabold transition-all duration-300 inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                Watch Demo
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-xs font-bold text-blue-200 select-none">
              <span>✓ Setup in 60 seconds</span>
              <span>✓ No Credit Card</span>
              <span>✓ Multilingual Support</span>
              <span>✓ Works 24/7</span>
            </div>

          </motion.div>

          {/* Right Side: Floating Success Card */}
          <motion.div 
            className="lg:col-span-5 flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          >
            <div className="w-full max-w-sm bg-white/10 border border-white/20 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md select-none hover:scale-[1.02] transition-transform duration-300">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold uppercase text-white/70 tracking-wider">Today's Activity</h3>
                  <p className="text-xs text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Live AI Agent Active
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white text-xs font-black">
                  Do
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-2xl border border-white/5 hover:border-white/15 transition-all duration-300">
                  <span className="text-xs font-bold text-blue-100">Conversations</span>
                  <span className="text-sm font-black text-white">
                    <AnimatedCounter value="23" />
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-2xl border border-white/5 hover:border-white/15 transition-all duration-300">
                  <span className="text-xs font-bold text-blue-100">Appointments Booked</span>
                  <span className="text-sm font-black text-white">
                    <AnimatedCounter value="8" />
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-3.5 rounded-2xl border border-white/5 hover:border-white/15 transition-all duration-300">
                  <span className="text-xs font-bold text-blue-100">New Leads</span>
                  <span className="text-sm font-black text-white">
                    <AnimatedCounter value="4" />
                  </span>
                </div>
                <div className="flex justify-between items-center bg-[#10B981]/10 p-3.5 rounded-2xl border border-emerald-500/30 hover:border-emerald-500/50 transition-all duration-300">
                  <span className="text-xs font-bold text-emerald-100">Response Rate</span>
                  <span className="text-sm font-black text-emerald-400">
                    <AnimatedCounter value="100%" />
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
