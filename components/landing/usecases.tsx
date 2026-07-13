"use client";

import { useState, useEffect, useRef } from 'react';
import { useCases } from "@/data/usecases";
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { motion } from 'framer-motion';
import Logo from '@/components/ui/logo';

const INDUSTRY_SUBTITLES: Record<string, string> = {
  "Restaurant/Cafe": "Table bookings & menu inquiries",
  "Salon/Spa": "Appointments & price lists",
  "Healthcare/Clinic": "Doctor schedules & clinic info",
  "E-Commerce": "Syncs catalog & shares cart links",
  "Real Estate": "Qualifies budget & site visits",
  "Freelancer/Agency": "Services, portfolios & booking"
};

export default function UseCases() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ sender: 'customer' | 'bot'; text: string }[]>([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [botTypingText, setBotTypingText] = useState('');
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  const currentUseCase = useCases[activeIndex];

  // Auto-scroll chat body container on new content
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatMessages, botTypingText, isAITyping]);

  // Trigger once scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 } // trigger when 15% visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Unified async chat simulation engine
  useEffect(() => {
    if (!hasBeenVisible) return;

    let isCancelled = false;
    let currentInterval: NodeJS.Timeout | null = null;
    let currentTimeout: NodeJS.Timeout | null = null;

    const runSimulation = async () => {
      const currentChat = useCases[activeIndex].chat;

      // Helper function for delays
      const delay = (ms: number) => new Promise((resolve) => {
        currentTimeout = setTimeout(resolve, ms);
      });

      // Helper function to type bot response
      const typeBotText = (text: string) => {
        return new Promise<void>((resolve) => {
          let currentIndex = 0;
          let currentText = '';
          setBotTypingText('');

          currentInterval = setInterval(() => {
            if (isCancelled) {
              clearInterval(currentInterval!);
              resolve();
              return;
            }

            if (currentIndex < text.length) {
              currentText += text.charAt(currentIndex);
              setBotTypingText(currentText);
              currentIndex++;
            } else {
              clearInterval(currentInterval!);
              resolve();
            }
          }, 30);
        });
      };

      // Reset state at the start of active index change
      setChatMessages([]);
      setBotTypingText('');
      setIsAITyping(false);

      await delay(600);

      for (let i = 0; i < currentChat.length; i++) {
        if (isCancelled) break;
        const msg = currentChat[i];

        if (msg.sender === 'customer') {
          setChatMessages((prev) => [...prev, { sender: 'customer', text: msg.text }]);
          await delay(1500);
        } else {
          // 1. Show typing indicator first (dots)
          setIsAITyping(true);
          await delay(1200);
          if (isCancelled) break;
          setIsAITyping(false);

          // 2. Type bot message letter-by-letter
          await typeBotText(msg.text);
          if (isCancelled) break;

          // 3. Add completed bot message to message list & clear temp typing text
          setChatMessages((prev) => [...prev, { sender: 'bot', text: msg.text }]);
          setBotTypingText('');
          await delay(2000);
        }
      }
    };

    runSimulation();

    // Clean up all running timers and reset state on activeIndex change
    return () => {
      isCancelled = true;
      if (currentInterval) clearInterval(currentInterval);
      if (currentTimeout) clearTimeout(currentTimeout);
      setChatMessages([]);
      setBotTypingText('');
      setIsAITyping(false);
    };
  }, [activeIndex, hasBeenVisible]);

  return (
    <section ref={sectionRef} id="use-cases" className="py-24 sm:py-32 bg-[#FFF8F0] border-y border-[#EED9B4]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="space-y-4 max-w-3xl mx-auto text-center">
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            SEE IT IN ACTION FOR YOUR BUSINESS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            Real conversations. Real problems solved.
          </h2>
          <p className="text-sm sm:text-base text-zinc-550 font-semibold max-w-xl mx-auto mt-4">
            Pick your industry and see exactly how Dudo automates booking and chat queries.
          </p>
        </div>

        {/* Dual pane container */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-stretch max-w-6xl mx-auto">
          
          {/* LEFT: 6 Tabs List */}
          <motion.div 
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-2 flex flex-col gap-3 justify-center"
          >
            {useCases.map((useCase, idx) => {
              const isActive = activeIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "w-full flex items-center justify-between text-left transition-all duration-300 rounded-2xl p-4.5 border outline-none cursor-pointer select-none",
                    isActive
                      ? "bg-[#FFF3E5] border-[#EED9B4] text-[#22577A] font-bold shadow-md shadow-[#EED9B4]/10"
                      : "bg-white border-zinc-200/80 text-zinc-700 hover:bg-zinc-50/50 hover:text-zinc-900 shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors",
                      isActive
                        ? "bg-gradient-to-br from-[#FFE7B5] to-[#FFD37A] shadow-xs"
                        : "bg-zinc-50 border border-zinc-100"
                    )}>
                      {useCase.emoji}
                    </div>
                    <div>
                      <h4 className={cn(
                        "text-sm font-black tracking-tight",
                        isActive ? "text-[#22577A]" : "text-zinc-800"
                      )}>
                        {useCase.industry}
                      </h4>
                      <span className="text-[10px] text-zinc-400 mt-1 block font-semibold leading-tight">
                        {INDUSTRY_SUBTITLES[useCase.industry] || "Automate lead operations"}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <div className="flex items-center gap-1.5 bg-[#E8F8F0] border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE PLAY
                    </div>
                  )}
                </button>
              );
            })}
          </motion.div>

          {/* RIGHT: Chat Simulator Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-3"
          >
            <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-5.5 sm:p-6 shadow-[0_20px_50px_rgba(34,87,122,0.06)] flex flex-col h-full min-h-[460px] justify-between relative overflow-hidden select-none">
              
              {/* Simulator Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 select-none shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8.5 h-8.5 rounded-full bg-[#FFF3E5] border border-[#EED9B4]/30 flex items-center justify-center text-sm shrink-0">
                    {currentUseCase.emoji}
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#22577A] flex items-center gap-1.5 leading-none">
                      Dudo AI ({currentUseCase.industry})
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse block" />
                    </div>
                    <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1.5 leading-none">
                      Active & Online
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Body (Messages scrolling container) */}
              <div ref={chatBodyRef} className="flex-1 overflow-y-auto py-5 space-y-4 max-h-[300px] min-h-[260px] scrollbar-thin select-text">
                
                {chatMessages.map((msg, mIdx) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div
                      key={mIdx}
                      className={cn(
                        "flex items-start gap-2.5 max-w-[85%] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 ease-out",
                        isBot ? "mr-auto" : "ml-auto flex-row-reverse"
                      )}
                    >
                      {isBot && (
                        <Logo className="w-7 h-7 shrink-0 mt-0.5" strokeColor="white" />
                      )}
                      <div className={cn(
                        "text-xs px-4 py-2.5 rounded-2xl shadow-2xs leading-relaxed border font-semibold",
                        isBot
                          ? "bg-[#22577A] text-white border-[#22577A] rounded-tl-none"
                          : "bg-white text-zinc-800 border-zinc-200/60 rounded-tr-none"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {/* Animated Typing Indicator for AI */}
                {isAITyping && (
                  <div className="flex items-start gap-2.5 max-w-[85%] mr-auto animate-in fade-in duration-200 select-none">
                    <Logo className="w-7 h-7 shrink-0 mt-0.5" strokeColor="white" />
                    <div className="bg-zinc-50 border border-zinc-200/50 text-zinc-400 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                {/* Auto-typing text bubble for Bot */}
                {botTypingText && (
                  <div className="flex items-start gap-2.5 max-w-[85%] mr-auto animate-in fade-in duration-100 select-none">
                    <Logo className="w-7 h-7 shrink-0 mt-0.5" strokeColor="white" />
                    <div className="text-xs px-4 py-2.5 rounded-2xl shadow-2xs leading-relaxed border font-semibold bg-[#22577A] text-white border-[#22577A] rounded-tl-none">
                      {botTypingText}
                      <span className="w-1 h-3.5 ml-0.5 bg-white/70 inline-block animate-pulse align-middle" />
                    </div>
                  </div>
                )}

              </div>

              {/* Simulator Input Footer */}
              <div className="border-t border-zinc-150/70 pt-4 select-none shrink-0 flex gap-3 items-center">
                <div className="flex-1 bg-[#F9FAFB] border border-zinc-200/80 rounded-xl px-4 py-2 text-xs text-zinc-400 font-semibold flex items-center h-9">
                  Simulated text input...
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#22577A] flex items-center justify-center text-white shadow-sm shrink-0 cursor-not-allowed">
                  <Send size={15} className="text-white" />
                </div>
              </div>

            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
