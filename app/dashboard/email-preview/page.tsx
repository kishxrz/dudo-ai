'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Monitor, Smartphone, ExternalLink, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEMPLATES_LIST = [
  { id: 'auth-verify', name: 'Authentication - Email Verification' },
  { id: 'google-welcome', name: 'Authentication - Google Login Welcome' },
  { id: 'password-reset', name: 'Authentication - Password Reset' },
  { id: 'onboarding-welcome', name: 'Onboarding - Welcome Day 0' },
  { id: 'onboarding-day1', name: 'Onboarding - WhatsApp Setup Day 1' },
  { id: 'onboarding-day2', name: 'Onboarding - Telegram Setup Day 2' },
  { id: 'onboarding-day3', name: 'Onboarding - Personality Style Day 3' },
  { id: 'onboarding-day5', name: 'Onboarding - Knowledge Base Day 5' },
  { id: 'onboarding-day7', name: 'Onboarding - Progress Checklist Day 7' },
  { id: 'trial-started', name: 'Trial - Welcome & Started' },
  { id: 'trial-5days', name: 'Trial - 5 Days Remaining' },
  { id: 'trial-3days', name: 'Trial - 3 Days Remaining' },
  { id: 'trial-24h', name: 'Trial - 24 Hours Remaining (Urgent)' },
  { id: 'trial-4h', name: 'Trial - 4 Hours Remaining (Urgent)' },
  { id: 'trial-expired', name: 'Trial - Suspended & Expired' },
  { id: 'pricing-abandon', name: 'Pricing - Upgrade Features Focus' },
  { id: 'founder-pricing', name: 'Pricing - Founder Lifeline Offer' },
  { id: 'abandoned-setup', name: 'Pricing - Abandoned Onboarding Setup' },
  { id: 'weekly-education', name: 'Marketing - Weekly Educational Tips' },
  { id: 'feature-launch', name: 'Marketing - Major Feature Shipment' },
  { id: 'monthly-changelog', name: 'Marketing - Monthly Changelog Wrap' },
  { id: 'newsletter-thurs', name: 'Marketing - Thursday Weekly AI Newsletter' }
];

export default function EmailPreviewPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('onboarding-welcome');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [recipientName, setRecipientName] = useState('Sarah Jenkins');

  const previewUrl = `/api/email/preview-html?template=${selectedTemplate}&name=${encodeURIComponent(recipientName)}`;

  return (
    <div className="space-y-4 pb-8 min-h-screen bg-[#090A0F] text-[#F4F4F5] p-4 sm:p-6">
      
      {/* ── Header Row ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4 select-none">
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard/agent?tab=personality" 
            className="p-1.5 rounded-lg border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-sm font-extrabold text-zinc-100 flex items-center gap-1.5">
              <Mail size={15} className="text-[#22577A]" /> SaaS Email Template Previewer
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">Preview all 22 custom branded responsive templates instantly</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sizing Toggles */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                "p-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold transition-all",
                previewMode === 'desktop' ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-350"
              )}
            >
              <Monitor size={12} /> Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                "p-1.5 rounded-md flex items-center gap-1.5 text-[10px] font-bold transition-all",
                previewMode === 'mobile' ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-350"
              )}
            >
              <Smartphone size={12} /> Mobile
            </button>
          </div>

          <a 
            href={previewUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="h-8 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-[10px] font-bold px-3 flex items-center gap-1.5 transition-colors"
          >
            Raw HTML <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* ── Configuration Form ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#131622] border border-[#222638] rounded-xl p-4 space-y-4 h-fit">
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2 select-none">
            Template Settings
          </h3>

          {/* Template Selection */}
          <div className="space-y-1.5 select-none">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Select Email Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2.5 text-zinc-200 outline-none focus:border-[#22577A]"
            >
              {TEMPLATES_LIST.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* User Custom Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block select-none">Recipient Name (Test)</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-zinc-200 outline-none focus:border-[#22577A]"
            />
          </div>

          {/* Template description meta card */}
          <div className="bg-zinc-900/50 border border-zinc-850 rounded-lg p-3 space-y-1 select-none">
            <strong className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Device Responsiveness</strong>
            <p className="text-[9px] text-zinc-500 font-semibold leading-relaxed">
              All components are built using inline fluid styles, table-based cell padding alignment, and dark/light color-scheme media directives to guarantee pixel-perfect renders across client clients like Gmail, Outlook mobile, Apple Mail, and Superhuman.
            </p>
          </div>
        </div>

        {/* ── Preview Display Container ──────────────────────────── */}
        <div className="md:col-span-2 flex justify-center bg-zinc-950/60 border border-zinc-850 rounded-xl p-6 relative min-h-[600px] overflow-hidden">
          
          <div 
            className={cn(
              "transition-all duration-300 shadow-2xl border border-zinc-800 rounded-xl overflow-hidden bg-[#090A0F]",
              previewMode === 'desktop' ? "w-full max-w-[600px]" : "w-[360px]"
            )}
          >
            {/* Mock Header Shell */}
            <div className="bg-zinc-900 border-b border-zinc-850 px-4 py-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono select-none">
              <span>To: {recipientName} &lt;client@demo.com&gt;</span>
              <span>Dudo Agent Automation</span>
            </div>

            {/* Embed Dynamic Iframe */}
            <iframe 
              src={previewUrl} 
              title="Email Preview Frame"
              className="w-full h-[600px] border-none bg-[#090A0F]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
