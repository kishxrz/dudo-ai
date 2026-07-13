"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function RoiCalculator() {
  const [calls, setCalls] = useState(800);
  const [hourlyRate, setHourlyRate] = useState(120);
  const [duration, setDuration] = useState(5);

  // Calculations
  const monthlyHours = Math.round((calls * duration) / 60);
  const traditionalCost = monthlyHours * hourlyRate;
  const dudoCost = 2999; // Flat starter subscription fee
  const netSavings = Math.max(0, traditionalCost - dudoCost);
  const percentReduction = traditionalCost > 0 ? Math.round((netSavings / traditionalCost) * 100) : 0;

  return (
    <section id="roi-calculator" className="py-24 sm:py-32 bg-white border-b border-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="space-y-4 max-w-3xl mx-auto text-center">
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            ESTIMATE YOUR RETURN ON INVESTMENT
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            See how much you save with Dudo AI
          </h2>
          <p className="text-sm sm:text-base text-zinc-500 font-semibold max-w-xl mx-auto mt-4">
            Compare Dudo AI's flat monthly subscription with the cost of manual call and ticket handling.
          </p>
        </div>

        {/* Calculator Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch max-w-5xl mx-auto">
          
          {/* LEFT: Inputs & Sliders (7 Columns) */}
          <motion.div 
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-7 bg-[#FFF8F0] border border-[#EED9B4]/50 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-xs select-none"
          >
            
            <div className="space-y-6">
              <h3 className="text-base font-black text-[#22577A] tracking-tight pb-3 border-b border-[#EED9B4]/20">
                Configure Call Volume & Staff Costs
              </h3>

              {/* Slider 1: Monthly Calls */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-bold text-zinc-700">Monthly Calls / Queries</label>
                  <span className="bg-white border border-[#EED9B4] text-[#22577A] text-xs font-black px-3 py-1 rounded-lg">
                    {calls.toLocaleString()} queries
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="50"
                  value={calls}
                  onChange={(e) => setCalls(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                  <span>100</span>
                  <span>2,500</span>
                  <span>5,000</span>
                </div>
              </div>

              {/* Slider 2: Cost per Hour */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-bold text-zinc-700">Cost per Support Hour</label>
                  <span className="bg-white border border-[#EED9B4] text-[#22577A] text-xs font-black px-3 py-1 rounded-lg">
                    ₹{hourlyRate} / hour
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                  <span>₹50</span>
                  <span>₹275</span>
                  <span>₹500</span>
                </div>
              </div>

              {/* Slider 3: Duration per call */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs sm:text-sm font-bold text-zinc-700">Average Duration per Resolution</label>
                  <span className="bg-white border border-[#EED9B4] text-[#22577A] text-xs font-black px-3 py-1 rounded-lg">
                    {duration} minutes
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                  <span>2m</span>
                  <span>8.5m</span>
                  <span>15m</span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed border-t border-[#EED9B4]/20 pt-4">
              * Calculations are based on standard employee resolution hours and Dudo AI's flat monthly pricing (Starter plan) of ₹2,999/mo. 
            </p>
          </motion.div>

          {/* RIGHT: Results Display (5 Columns) */}
          <motion.div 
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-5"
          >
            <div className="bg-gradient-to-br from-[#22577A] to-[#123146] border border-[#22577A]/20 rounded-[2rem] p-6.5 sm:p-8 flex flex-col justify-between h-full text-white shadow-lg relative overflow-hidden select-none">
              
              {/* Decorative backdrop shape */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#22577A]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-6">
                <div>
                  <span className="inline-block bg-white/10 border border-white/10 text-[#FFD37A] text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-md">
                    Net Monthly Savings
                  </span>
                  <div className="mt-4 flex items-baseline gap-1 text-3xl sm:text-5xl font-black tracking-tight text-white animate-pulse">
                    ₹{netSavings.toLocaleString()}
                    <span className="text-xs sm:text-sm font-extrabold text-white/60">/ month</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-4">
                  <div className="w-10 h-10 rounded-xl bg-[#22577A] flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm shadow-[#DBA11A]/20">
                    {percentReduction}%
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Cost Reduction</h4>
                    <p className="text-[10px] text-white/70 font-semibold mt-0.5 leading-tight">
                      Compared to traditional human resources
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10 select-none">
                  <div>
                    <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider block">
                      Traditional Cost
                    </span>
                    <span className="text-sm font-black mt-1 block">
                      ₹{traditionalCost.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider block">
                      Dudo AI Cost
                    </span>
                    <span className="text-sm font-black mt-1 block text-[#FFE7B5]">
                      ₹{dudoCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1">
                    <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider block">
                      Time Saved
                    </span>
                    <span className="text-sm font-black mt-1 block text-emerald-400">
                      {monthlyHours} Support Hours / mo
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <a
                  href="#pricing"
                  className="w-full bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] hover:from-[#C59013] hover:to-[#E5B134] text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center transition-all duration-300 shadow-md shadow-[#DBA11A]/10 text-center select-none"
                >
                  Start Saving Today
                </a>
              </div>

            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
