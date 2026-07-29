import Link from 'next/link';
import { Check } from 'lucide-react';
import { pricingPlans } from '@/data/pricing';
import { motion } from 'framer-motion';

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-32 bg-[#FFF3E5] overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-1/4 left-[-10%] w-[400px] h-[400px] rounded-full bg-[#22577A]/5 blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[450px] h-[450px] rounded-full bg-[#22577A]/8 blur-3xl opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-16 relative z-10">
        
        {/* Section Header */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block"
          >
            SIMPLE TRANSPARENT PRICING
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight"
          >
            One customer pays for Dudo. <br />
            Every customer after that is profit.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-sm sm:text-base text-zinc-500 font-semibold mt-4"
          >
            Start free. Upgrade only when your business grows.
          </motion.p>
        </div>

        {/* 3 pricing cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto text-left items-stretch pt-6">
          {pricingPlans.map((plan, idx) => {
            const isPopular = plan.popular;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: idx * 0.15, ease: "easeOut" }}
                className="w-full h-full flex"
              >
                <div 
                  className={`bg-white rounded-[2rem] p-8 flex flex-col justify-between transition-[transform,box-shadow] duration-300 min-h-[550px] relative w-full ${
                    isPopular 
                      ? 'border-2 border-[#DBA11A] shadow-2xl shadow-[#DBA11A]/10 hover:shadow-2xl hover:shadow-[#DBA11A]/20 hover:-translate-y-1.5 lg:scale-[1.04] z-10 bg-gradient-to-b from-white to-[#FFF8F0]' 
                      : 'border border-[#EED9B4] shadow-lg hover:shadow-2xl hover:-translate-y-1'
                  }`}
                >
                  {isPopular && plan.badge && (
                    <div className="absolute -top-3.5 left-6 bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-white shadow-sm">
                      {plan.badge}
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-3">
                      {/* Inline badge for non-popular plans */}
                      {!isPopular && plan.badge && (
                        <div className="mb-2">
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-emerald-200">
                            {plan.badge}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-[#22577A]">{plan.name}</h3>
                        {plan.oldPrice && (
                          <span className="text-xs text-[#22577A]/40 line-through font-bold">
                            {plan.oldPrice}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-3xl sm:text-4xl font-black text-[#22577A]">{plan.price}</span>
                        <span className="text-xs text-zinc-450 font-bold">{plan.period}</span>
                      </div>
                    </div>

                    <p className={`text-xs font-semibold leading-relaxed border-b pb-4 ${
                      isPopular ? 'text-[#22577A] border-[#22577A]/10' : 'text-zinc-500 border-zinc-100'
                    }`}>
                      {plan.description.startsWith("🔥") ? (
                        <>
                          <span className="inline-block animate-flicker origin-bottom mr-1">🔥</span>
                          {plan.description.replace(/^🔥\s*/, '')}
                        </>
                      ) : (
                        plan.description
                      )}
                    </p>

                    <ul className="space-y-4 text-xs sm:text-sm font-semibold text-zinc-700">
                      {plan.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5">
                          <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0 stroke-[3]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-8">
                    <Link 
                      href={plan.actionHref} 
                      className={`w-full rounded-2xl font-black text-sm text-center inline-flex items-center justify-center cursor-pointer transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
                        isPopular 
                          ? 'bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white shadow-lg shadow-[#DBA11A]/20 hover:shadow-xl hover:shadow-[#DBA11A]/35 hover:scale-102 active:scale-98 sm:text-base py-4' 
                          : 'bg-white border border-[#EED9B4] text-[#22577A] hover:bg-[#FFF8F0] shadow-xs py-3.5'
                      }`}
                    >
                      {plan.actionText}
                    </Link>
                    <div className="text-center text-[10px] text-zinc-450 font-bold mt-3">
                      {plan.note}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Dudo AI vs Human Assistant Comparison Table */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl mx-auto bg-white rounded-[2rem] p-6 sm:p-8 space-y-6 border border-[#EED9B4] text-left select-none shadow-lg hover:shadow-xl transition-[transform,box-shadow] duration-300 mt-12 relative overflow-hidden"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-[#22577A] tracking-wider block">COMPARISON</span>
            <h4 className="text-lg sm:text-xl font-black text-[#22577A]">Dudo AI vs Human Virtual Assistant</h4>
            <p className="text-xs text-zinc-500 font-medium">Why Dudo is the smartest hire you will make for customer support.</p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[550px] divide-y divide-zinc-100">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 pb-4 text-xs font-black uppercase tracking-wider text-zinc-400">
                <div className="col-span-4">Metric</div>
                <div className="col-span-4 text-zinc-500">Human Assistant (VA)</div>
                <div className="col-span-4 text-[#22577A]">Dudo AI Agent</div>
              </div>

              {/* Rows */}
              <div className="grid grid-cols-12 gap-4 py-4 items-center text-xs sm:text-sm font-semibold">
                <div className="col-span-4 text-[#22577A] font-extrabold">Monthly Cost</div>
                <div className="col-span-4 text-zinc-500 font-medium">₹15,000 - ₹25,000 /mo</div>
                <div className="col-span-4 text-emerald-600 font-black">₹999 /mo (Flat)</div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-4 items-center text-xs sm:text-sm font-semibold">
                <div className="col-span-4 text-[#22577A] font-extrabold">Availability</div>
                <div className="col-span-4 text-zinc-500 font-medium">8 hours/day · 5-6 days/wk</div>
                <div className="col-span-4 text-emerald-600 font-black">24/7/365 (Never sleeps)</div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-4 items-center text-xs sm:text-sm font-semibold">
                <div className="col-span-4 text-[#22577A] font-extrabold">Response Time</div>
                <div className="col-span-4 text-zinc-500 font-medium">2 - 10 minutes</div>
                <div className="col-span-4 text-emerald-600 font-black">Instant (&lt; 10 seconds)</div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-4 items-center text-xs sm:text-sm font-semibold">
                <div className="col-span-4 text-[#22577A] font-extrabold">Languages</div>
                <div className="col-span-4 text-zinc-500 font-medium">Typically 1-2 languages</div>
                <div className="col-span-4 text-emerald-600 font-black">Multilingual (Tamil, Hindi, Hinglish, etc.)</div>
              </div>

              <div className="grid grid-cols-12 gap-4 pt-4 pb-2 items-center text-xs sm:text-sm font-semibold">
                <div className="col-span-4 text-[#22577A] font-extrabold">Setup & Training</div>
                <div className="col-span-4 text-zinc-500 font-medium">1 - 2 weeks onboarding</div>
                <div className="col-span-4 text-emerald-600 font-black">Instant setup (60 seconds)</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RISK REVERSAL BADGES */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-6 text-xs sm:text-sm font-bold text-zinc-600 select-none">
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
            Free Trial
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
            No Credit Card
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
            Setup in under 60 seconds
          </span>
        </div>

      </div>
    </section>
  );
}
