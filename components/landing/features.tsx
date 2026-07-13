import { Zap, Brain, Shield } from 'lucide-react';
import { COMPANY_NAME } from '@/lib/constants';

export default function Features() {
  return (
    <section id="features" className="py-32 bg-white border-y border-[#EED9B4]/30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            Your AI employee comes fully trained
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            No tutorials. No prompts to write.
          </h2>
          <p className="text-sm sm:text-base text-zinc-500 font-semibold max-w-xl mx-auto mt-4">
            Just toggle ON the skills your business needs and your AI starts working instantly.
          </p>
        </div>

        {/* Bento Grid Desktop (Two columns: 3/5 left, 2/5 right) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-stretch">
          
          {/* Left Card: Large Featured Product Card (WhatsApp mockup) */}
          <div className="lg:col-span-3 bg-white border border-[#EED9B4] rounded-[2rem] p-8 sm:p-10 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-8 min-h-[500px]">
            <div className="space-y-4">
              <span className="text-white text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] px-3.5 py-1.5 rounded-full border border-white/20 shadow-sm">
                LIVE CONVERSATION DEMO
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-[#22577A]">WhatsApp AI Assistant</h3>
              <p className="text-xs sm:text-sm font-semibold text-[#6B7280] max-w-lg leading-relaxed mt-2">
                Dudo answers customer inquiries, schedules meetings, and handles bookings instantly in your voice.
              </p>
            </div>

            {/* WhatsApp Interface Mockup */}
            <div className="bg-[#FFF8F0]/40 rounded-2xl p-4 border border-[#EED9B4]/30 shadow-inner space-y-4 relative">
              
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#22577A]/10 text-[#22577A] flex items-center justify-center font-extrabold text-sm shadow-xs">
                    JD
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-800">John Doe (Customer)</div>
                    <div className="text-[9px] text-[#6B7280] font-semibold">Active now</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#22577A] px-2.5 py-1 rounded-md text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider">LIVE CHAT</span>
                </div>
              </div>

              {/* Chat window messages */}
              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1 text-[11px] leading-relaxed select-text">
                
                {/* Customer: Inquiry */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-white text-zinc-800 rounded-2xl rounded-tr-none px-3.5 py-2 font-semibold shadow-xs border border-zinc-200/50">
                    "Hi, can I book tomorrow at 5 PM?"
                  </div>
                </div>

                {/* AI response: Checking calendar and qualifying */}
                <div className="flex justify-start items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#DBA11A] to-[#F3BE42] flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm shadow-[#DBA11A]/20">
                    Do
                  </div>
                  <div className="max-w-[80%] bg-[#22577A] text-white rounded-2xl rounded-tl-none px-3.5 py-2 font-semibold shadow-md">
                    "Yes, 5:15 PM is available. Would you like me to reserve it?"
                  </div>
                </div>

                {/* Customer: Yes */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] bg-white text-zinc-800 rounded-2xl rounded-tr-none px-3.5 py-2 font-semibold shadow-xs border border-zinc-200/50">
                    "Yes."
                  </div>
                </div>

                {/* AI Response: Booking confirmation */}
                <div className="flex justify-start items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#DBA11A] to-[#F3BE42] flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm shadow-[#DBA11A]/20">
                    Du
                  </div>
                  <div className="max-w-[80%] bg-[#22577A] text-white rounded-2xl rounded-tl-none px-3.5 py-2 font-semibold shadow-md">
                    "Done. Your appointment is confirmed."
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Two stacked cards */}
          <div className="lg:col-span-2 flex flex-col gap-10 justify-between">
            
            {/* Card 2: Knowledge Base Import */}
            <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-[#22577A] text-[10px] font-black uppercase tracking-widest bg-[#22577A]/10 px-3.5 py-1.5 rounded-full border border-[#22577A]/15">
                  AI TRAINING
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#22577A]">Learns About Your Business</h3>
                <p className="text-xs sm:text-sm font-semibold text-[#6B7280] leading-relaxed mt-2">
                  Train your AI using your website, FAQs, menus and documents. Simply upload files or paste URLs.
                </p>
              </div>

              {/* Import Status list */}
              <div className="space-y-2 bg-[#FFF8F0]/30 rounded-xl p-4 border border-[#EED9B4]/20">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span>🌐 Website Links</span>
                  <span className="text-[#22577A] font-extrabold flex items-center gap-1">✓ Ready</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span>🍕 Product Menu & Price List</span>
                  <span className="text-[#22577A] font-extrabold flex items-center gap-1">✓ Ready</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span>📃 Customer FAQs</span>
                  <span className="text-[#22577A] font-extrabold flex items-center gap-1">✓ Ready</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span>💼 Service Catalog</span>
                  <span className="text-[#22577A] font-extrabold flex items-center gap-1">✓ Ready</span>
                </div>
              </div>
            </div>

            {/* Card 3: Analytics */}
            <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-white text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] px-3.5 py-1.5 rounded-full border border-white/20 shadow-sm">
                  BUSINESS OUTCOMES
                </span>
                <h3 className="text-lg sm:text-xl font-black text-[#22577A]">Automatic Performance Reports</h3>
                <p className="text-xs sm:text-sm font-semibold text-[#6B7280] leading-relaxed mt-2">
                  Dudo logs inquiries, documents scheduled tasks, and handles customer follow-ups completely in the background.
                </p>
              </div>
              <div className="space-y-3">
                <div className="bg-[#FFF8F0]/40 rounded-xl p-3.5 border border-[#EED9B4]/30">
                  <div className="text-[10px] text-zinc-400 font-extrabold uppercase">Bookings Secured</div>
                  <div className="text-lg font-black text-[#22577A] mt-0.5">18</div>
                </div>
                <div className="bg-[#FFF8F0]/40 rounded-xl p-3.5 border border-[#EED9B4]/30">
                  <div className="text-[10px] text-zinc-400 font-extrabold uppercase">Leads Qualified</div>
                  <div className="text-lg font-black text-emerald-600 mt-0.5">94%</div>
                </div>
                <div className="bg-[#FFF8F0]/40 rounded-xl p-3.5 border border-[#EED9B4]/30">
                  <div className="text-[10px] text-zinc-400 font-extrabold uppercase">Avg Response Time</div>
                  <div className="text-lg font-black text-[#22577A] mt-0.5">1.8s</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Three smaller product capability cards below the main grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Capability Card 1: Answers Customers */}
          <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between space-y-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] text-[#22577A] flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#22577A] tracking-tight">Answers Customers</h3>
              <p className="text-xs sm:text-sm font-semibold text-[#6B7280] leading-relaxed mt-2">
                Replies to common questions about your pricing, timings, and services instantly 24/7.
              </p>
            </div>
          </div>

          {/* Capability Card 2: Books Appointments */}
          <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between space-y-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8F3FF] to-[#A6E3FF] text-[#22577A] flex items-center justify-center shrink-0 shadow-xs">
              <Brain className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#22577A] tracking-tight">Books Appointments</h3>
              <p className="text-xs sm:text-sm font-semibold text-[#6B7280] leading-relaxed mt-2">
                Integrates directly with your booking system to schedule slots without back-and-forth.
              </p>
            </div>
          </div>

          {/* Capability Card 3: Learns Your Business */}
          <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between space-y-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] text-[#22577A] flex items-center justify-center shrink-0 shadow-xs">
              <Shield className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-3">
              <h3 className="font-extrabold text-sm sm:text-base text-[#22577A] tracking-tight">Learns Your Business</h3>
              <p className="text-xs sm:text-sm font-semibold text-[#6B7280] leading-relaxed mt-2">
                Automatically reads your website, menu, and files to reply in your custom brand voice.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
