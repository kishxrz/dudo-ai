import Link from 'next/link';
import { X, Check, ArrowRight } from 'lucide-react';
import { withoutDudoPoints, withDudoPoints } from '@/data/comparison';
import { SIGNUP_URL } from '@/lib/constants';
import { motion } from 'framer-motion';

export default function Comparison() {
  return (
    <section id="features" className="relative py-32 bg-[#FFF3E5] overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-1/3 left-[-15%] w-[450px] h-[450px] rounded-full bg-[#22577A]/5 blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-10 right-[-10%] w-[450px] h-[450px] rounded-full bg-[#22577A]/8 blur-3xl opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-16 relative z-10">
        
        {/* Section Header */}
        <div className="space-y-4">
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            WHY BUSINESSES SWITCH
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] max-w-2xl mx-auto leading-tight">
            Stop losing leads to slow response times.
          </h2>
          <p className="text-[#6B7280] font-semibold max-w-xl mx-auto">
            Every Indian small business owner loses sleep over the same things.
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 text-left items-stretch">
            
            {/* WITHOUT DUDO */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full h-full flex"
            >
              <div className="bg-white/95 border border-[#EED9B4] rounded-[2rem] p-8 sm:p-10 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-[transform,box-shadow] duration-300 flex flex-col justify-between space-y-8 w-full">
                <div className="space-y-6">
                  <div className="inline-flex bg-red-50 border border-red-200 text-red-700 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                    WITHOUT DUDO
                  </div>
                  <ul className="space-y-5">
                    {withoutDudoPoints.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3.5 text-xs sm:text-sm font-semibold text-zinc-700 leading-relaxed">
                        <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5 border border-red-200">
                          <X className="w-3.5 h-3.5 text-red-500 stroke-[3]" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Summary panel */}
                <div className="border-t border-[#EED9B4]/40 pt-6 mt-8 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-wider">RESPONSE TIME</div>
                    <div className="text-sm font-black text-red-600 mt-1">3–5 Hours</div>
                  </div>
                  <div className="border-l border-[#EED9B4]/40">
                    <div className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-wider">LOST LEADS</div>
                    <div className="text-sm font-black text-red-600 mt-1">High</div>
                  </div>
                  <div className="border-l border-[#EED9B4]/40">
                    <div className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-wider">AVAILABILITY</div>
                    <div className="text-sm font-black text-red-600 mt-1">Office Hrs</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* WITH DUDO */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-full h-full flex"
            >
              <div className="bg-[#FFF8F0] border-2 border-[#22577A] rounded-[2rem] p-8 sm:p-10 shadow-xl shadow-[#DBA11A]/5 hover:shadow-2xl hover:-translate-y-1.5 transition-[transform,box-shadow] duration-300 flex flex-col justify-between space-y-8 relative overflow-hidden w-full">
                <div className="absolute -right-16 -top-16 w-36 h-36 bg-[#22577A]/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-6 relative z-10">
                  <div className="inline-flex bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm">
                    WITH DUDO
                  </div>
                  <ul className="space-y-5">
                    {withDudoPoints.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3.5 text-xs sm:text-sm font-bold text-zinc-800 leading-relaxed">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-250">
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Summary panel */}
                <div className="border-t border-[#EED9B4]/60 pt-6 mt-8 grid grid-cols-3 gap-2 text-center relative z-10">
                  <div>
                    <div className="text-[10px] font-extrabold text-[#22577A] uppercase tracking-wider">RESPONSE TIME</div>
                    <div className="text-sm font-black text-emerald-600 mt-1">&lt; 10s</div>
                  </div>
                  <div className="border-l border-[#EED9B4]/60">
                    <div className="text-[10px] font-extrabold text-[#22577A] uppercase tracking-wider">LOST LEADS</div>
                    <div className="text-sm font-black text-emerald-600 mt-1">Near Zero</div>
                  </div>
                  <div className="border-l border-[#EED9B4]/60">
                    <div className="text-[10px] font-extrabold text-[#22577A] uppercase tracking-wider">AVAILABILITY</div>
                    <div className="text-sm font-black text-emerald-600 mt-1">24/7/365</div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Floating VS circle element */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white border border-[#EED9B4] shadow-lg items-center justify-center text-sm font-black text-[#22577A] z-10 select-none"
          >
            VS
          </motion.div>
        </div>

        <div className="pt-8 space-y-4">
          <Link 
            href={SIGNUP_URL} 
            className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white px-9 py-4.5 rounded-2xl text-sm sm:text-base font-black shadow-lg shadow-[#DBA11A]/20 hover:shadow-xl hover:shadow-[#DBA11A]/35 hover:-translate-y-0.5 active:translate-y-0 hover:scale-105 active:scale-95 transition-all duration-300 inline-flex items-center justify-center gap-2.5 group"
          >
            Stop losing leads tonight 
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <div className="text-[11px] font-black uppercase text-[#6B7280]/70 tracking-widest mt-2">
            Free Telegram trial · No credit card · Less than 60 seconds
          </div>
        </div>

      </div>
    </section>
  );
}
