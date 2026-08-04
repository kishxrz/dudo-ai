'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

/**
 * 1. Revenue Loss Calculator Component
 */
export function RevenueLossCalculator() {
  const [leadVolume, setLeadVolume] = useState(1500);
  const [orderValue, setOrderValue] = useState(2500);
  const [delay, setDelay] = useState<'under5' | 'under30' | 'under120' | 'over120'>('under120');

  const leakageRates = {
    under5: 0.05,
    under30: 0.25,
    under120: 0.50,
    over120: 0.80
  };

  const leakageRate = leakageRates[delay];
  const monthlyLostLeads = Math.round(leadVolume * leakageRate);
  const monthlyRevenueLoss = monthlyLostLeads * orderValue;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4 w-full select-none">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
        <AlertTriangle className="text-red-500 shrink-0" size={16} />
        <div>
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Revenue Loss Calculator</h4>
          <p className="text-[10px] text-zinc-400 mt-0.5">Estimate leakages due to slow response times.</p>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between font-bold text-zinc-700">
            <Label htmlFor="rev-lead-vol" className="text-zinc-500 uppercase text-[9px] tracking-wider font-extrabold">Monthly Lead Volume</Label>
            <span className="font-mono text-[#22577A]">{leadVolume} leads</span>
          </div>
          <input 
            id="rev-lead-vol"
            type="range" 
            min={100} 
            max={10000} 
            step={100} 
            value={leadVolume} 
            onChange={(e) => setLeadVolume(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-bold text-zinc-700">
            <Label htmlFor="rev-order-val" className="text-zinc-500 uppercase text-[9px] tracking-wider font-extrabold">Average Deal Value (₹)</Label>
            <span className="font-mono text-[#22577A]">₹{orderValue.toLocaleString('en-IN')}</span>
          </div>
          <input 
            id="rev-order-val"
            type="range" 
            min={500} 
            max={50000} 
            step={500} 
            value={orderValue} 
            onChange={(e) => setOrderValue(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="rev-delay" className="font-bold text-zinc-500 uppercase text-[9px] tracking-wider block">Average Response Delay</Label>
          <select 
            id="rev-delay"
            value={delay} 
            onChange={(e) => setDelay(e.target.value as any)}
            className="w-full h-8.5 text-xs border border-zinc-200 focus-visible:ring-zinc-900 rounded-lg bg-white px-2.5 font-semibold text-zinc-800 focus:outline-none"
          >
            <option value="under5">Immediate (Under 5 minutes)</option>
            <option value="under30">Delayed (5 - 30 minutes)</option>
            <option value="under120">Slow (30 mins - 2 hours)</option>
            <option value="over120">Critical (Over 2 hours / Next day)</option>
          </select>
        </div>
      </div>

      <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 text-center space-y-1">
        <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">Estimated Monthly Revenue Loss</span>
        <span className="text-xl font-black text-red-700 block">
          ₹{monthlyRevenueLoss.toLocaleString('en-IN')}
        </span>
        <p className="text-[9px] text-red-650 leading-relaxed font-semibold">
          ({monthlyLostLeads} leads lost to direct competitors due to response latency)
        </p>
      </div>
    </div>
  );
}

/**
 * 2. ROI Calculator Component
 */
export function RoiCalculator() {
  const [agents, setAgents] = useState(3);
  const [agentSalary, setAgentSalary] = useState(35000);

  const baseDudoCost = 2499;
  const legacyMonthlyCost = agents * agentSalary;
  const monthlySavings = legacyMonthlyCost - baseDudoCost;
  const roiMultiplier = Math.round((monthlySavings / baseDudoCost) * 100);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4 w-full select-none">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
        <TrendingUp className="text-[#22577A] shrink-0" size={16} />
        <div>
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">AI Employee ROI Calculator</h4>
          <p className="text-[10px] text-zinc-400 mt-0.5">Calculate budget savings vs legacy support desks.</p>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 text-left">
            <Label htmlFor="roi-agents" className="font-bold text-zinc-500 uppercase text-[9px] tracking-wider block">Support Staff Count</Label>
            <Input 
              id="roi-agents"
              type="number" 
              min={1} 
              max={50} 
              value={agents} 
              onChange={(e) => setAgents(Math.max(1, Number(e.target.value)))}
              className="h-8.5 text-xs bg-white border-zinc-200 focus-visible:ring-zinc-900 rounded-lg"
            />
          </div>
          <div className="space-y-1 text-left">
            <Label htmlFor="roi-salary" className="font-bold text-zinc-500 uppercase text-[9px] tracking-wider block">Salary Per Agent (₹)</Label>
            <Input 
              id="roi-salary"
              type="number" 
              min={5000} 
              max={200000} 
              value={agentSalary} 
              onChange={(e) => setAgentSalary(Math.max(0, Number(e.target.value)))}
              className="h-8.5 text-xs bg-white border-zinc-200 focus-visible:ring-zinc-900 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-center">
          <span className="text-[9px] font-bold text-zinc-400 uppercase block leading-none">Legacy Cost / mo</span>
          <span className="text-sm font-extrabold text-zinc-700 block mt-1.5">
            ₹{legacyMonthlyCost.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
          <span className="text-[9px] font-bold text-emerald-600 uppercase block leading-none">Net Savings / mo</span>
          <span className="text-sm font-black text-emerald-700 block mt-1.5">
            ₹{monthlySavings.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-center">
        <span className="text-[9px] font-bold text-[#22577A] uppercase tracking-wider block">Estimated Return on Investment (ROI)</span>
        <span className="text-base font-black text-zinc-800 block mt-1">
          {roiMultiplier}% Return
        </span>
      </div>
    </div>
  );
}

/**
 * 3. Estimated Savings Widget Component (Sticky/Embed)
 */
export function SavingsWidget() {
  const toast = useToast();
  const [chatsCount, setChatsCount] = useState(1200);
  const [orderVal, setOrderVal] = useState(1500);

  // Simple formula: chats * orderValue * conversionRecoveryBoost
  const savings = Math.round(chatsCount * 0.05 * orderVal);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3.5 shadow-sm select-none">
      <div className="flex items-center gap-1.5 border-b border-zinc-100 pb-2">
        <ShieldCheck className="text-emerald-600 shrink-0" size={15} />
        <span className="text-[10px] font-bold text-zinc-800 uppercase tracking-wider">Estimated Savings Widget</span>
      </div>
      
      <div className="space-y-3 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            <Label htmlFor="sav-chats">Monthly Chats</Label>
            <span className="font-mono text-zinc-800">{chatsCount} chats</span>
          </div>
          <input 
            id="sav-chats"
            type="range" 
            min={100} 
            max={10000} 
            step={100} 
            value={chatsCount} 
            onChange={(e) => setChatsCount(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-150 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            <Label htmlFor="sav-val">Average Deal (₹)</Label>
            <span className="font-mono text-zinc-800">₹{orderVal.toLocaleString('en-IN')}</span>
          </div>
          <input 
            id="sav-val"
            type="range" 
            min={500} 
            max={20000} 
            step={500} 
            value={orderVal} 
            onChange={(e) => setOrderVal(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-150 rounded-lg appearance-none cursor-pointer accent-[#22577A]"
          />
        </div>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-center">
        <span className="text-[9px] font-bold text-zinc-400 uppercase block">Monthly AI Value Captured</span>
        <span className="text-sm font-black text-emerald-600 block mt-1.5">
          ₹{savings.toLocaleString('en-IN')}
        </span>
      </div>

      <Button
        onClick={() => {
          toast.success('Estimations Copied', 'Savings calculations copied to clipboard.');
          navigator.clipboard.writeText(`Dudo AI Estimated Savings: ₹${savings.toLocaleString('en-IN')}/mo (Chats: ${chatsCount}, Avg Deal: ₹${orderVal})`);
        }}
        className="w-full h-7.5 text-[10px] font-bold bg-[#22577A] hover:bg-[#1A4461] text-white rounded-lg cursor-pointer border-none flex items-center justify-center transition-all hover:scale-[1.01] active:scale-99"
      >
        Copy Value Analysis
      </Button>
    </div>
  );
}
