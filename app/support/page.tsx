"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/navbar';
import Footer from '@/components/landing/footer';
import { Mail, MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { COMPANY_NAME, SUPPORT_EMAIL } from '@/lib/constants';

export default function SupportPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-zinc-800 font-sans selection:bg-[#DB1A1A]/10 selection:text-[#DB1A1A] antialiased">
      <Navbar />
      
      {/* Header Banner */}
      <section className="py-20 bg-gradient-to-b from-white to-[#FFF8F0] border-b border-[#EED9B4]/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-[#22577A]/5 blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#22577A] bg-[#FFE7B5]/20 hover:bg-[#FFE7B5]/40 border border-[#EED9B4]/30 px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 cursor-pointer"
            >
              &larr; Back to Home
            </Link>
          </div>
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            SUPPORT CENTER
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            How can we help you?
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 font-semibold max-w-xl mx-auto">
            Get instant support for setting up your AI bots, WhatsApp connections, or API configurations.
          </p>
        </div>
      </section>

      {/* Cards and Form Section */}
      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        
        {/* LEFT COLUMN: Resource Cards (5/12 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          
          <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl transition-all duration-300 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] text-[#22577A] flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-base text-[#22577A]">Email Support</h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed">
                Directly email us for billing, account, or complex technical issues.
              </p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-xs sm:text-sm text-[#22577A] font-black hover:underline block pt-2">
                {SUPPORT_EMAIL} &rarr;
              </a>
            </div>
          </div>

          <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl transition-all duration-300 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8F3FF] to-[#A6E3FF] text-[#22577A] flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-base text-[#22577A]">Telegram Chat</h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed">
                Connect with our live support bot on Telegram for interactive troubleshooting.
              </p>
              <a href="https://t.me/dudo_support_bot" target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-[#22577A] font-black hover:underline block pt-2">
                @dudo_support_bot &rarr;
              </a>
            </div>
          </div>

          <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl transition-all duration-300 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E2FBE9] to-[#ADF2BE] text-emerald-700 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-base text-[#22577A]">Response Time</h3>
              <p className="text-xs sm:text-sm text-zinc-500 font-medium leading-relaxed">
                Our support team is active 24/7. Average response time for Pro plans is under 15 minutes.
              </p>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Contact Form (7/12 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#EED9B4] rounded-[2rem] p-8 sm:p-10 shadow-lg flex flex-col justify-between">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <h3 className="text-lg font-black text-[#22577A] tracking-tight pb-2 border-b border-[#EED9B4]/20">
                Submit a Support Ticket
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-[#22577A] focus:bg-white rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-all"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-[#22577A] focus:bg-white rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-[#22577A] focus:bg-white rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-all"
                  placeholder="How can we help you?"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-zinc-50/50 border border-zinc-200 focus:border-[#22577A] focus:bg-white rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition-all resize-none"
                  placeholder="Please describe your issue in detail..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white py-3.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 shadow-md shadow-[#DBA11A]/10 hover:shadow-lg hover:shadow-[#DBA11A]/35 hover:-translate-y-0.5 active:translate-y-0 hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
              >
                Send Ticket <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                &check;
              </div>
              <h3 className="font-black text-xl text-[#22577A]">Ticket Submitted!</h3>
              <p className="text-sm text-zinc-500 font-semibold max-w-sm mx-auto">
                Thank you for reaching out, {formData.name}! We've received your request and will get back to you shortly at {formData.email}.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-[#22577A] font-black text-sm hover:underline pt-4 cursor-pointer"
              >
                Submit another ticket
              </button>
            </div>
          )}
        </div>

      </section>

      <Footer />
    </div>
  );
}
