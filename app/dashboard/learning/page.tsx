'use client';

import { useState, useEffect } from 'react';
import { Brain, RotateCw, Sparkles, Users, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';

function LocalEmptyState({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-[200px] border border-zinc-200/80 rounded-xl bg-white select-none px-6 py-4">
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center mb-3 text-zinc-400">
          <Icon size={18} />
        </div>
      )}
      <h3 className="text-[16px] font-semibold text-zinc-900 leading-tight">
        {title}
      </h3>
      <p className="text-[13px] text-zinc-500 mt-2 max-w-lg leading-relaxed font-normal">
        {description}
      </p>
    </div>
  );
}

export default function LearningPage() {
  const [activeTab, setActiveTab] = useState<'skills' | 'customers' | 'facts'>('skills');
  const [facts, setFacts] = useState<string[]>([]);
  const [newFact, setNewFact] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('__dudo_dev_learning_facts');
      if (raw) {
        try {
          setFacts(JSON.parse(raw));
        } catch (e) {}
      }
    }
  }, []);

  const handleAddFact = () => {
    if (!newFact.trim()) return;
    const updated = [...facts, newFact.trim()];
    setFacts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_dev_learning_facts', JSON.stringify(updated));
    }
    setNewFact('');
  };

  const handleDeleteFact = (index: number) => {
    const updated = facts.filter((_, i) => i !== index);
    setFacts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_dev_learning_facts', JSON.stringify(updated));
    }
  };

  return (
    <PageLayout className="max-w-[1150px] w-full text-left mx-auto gap-5 px-6 box-border">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 text-[#22577A] mt-1">
            <Brain size={20} />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-zinc-950 tracking-tight leading-none mb-2">
              Learning
            </h1>
            <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">
              What your AI has learned over time. Self-evolving procedures, customer profiles, and durable business facts.
            </p>
          </div>
        </div>
        
        <Button
          className="h-8.5 px-3.5 bg-white border border-[#22577A] hover:bg-[#22577A]/5 text-[#22577A] font-semibold rounded-xl shadow-xs text-xs cursor-pointer flex items-center gap-1.5 transition-all shrink-0 hover:scale-[1.01] active:scale-99"
        >
          <RotateCw size={13} className="text-[#22577A]" />
          Reflect now
        </Button>
      </div>

      {/* 2. Tabs Selector */}
      <div className="flex gap-6 border-b border-zinc-200/50 pb-px text-[14px] font-medium text-left select-none overflow-x-auto whitespace-nowrap scrollbar-none">
        <button 
          onClick={() => setActiveTab('skills')}
          className={cn(
            "flex items-center gap-2 pb-3 transition-all cursor-pointer border-none bg-transparent font-medium relative",
            activeTab === 'skills' 
              ? "text-[#22577A] font-semibold" 
              : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          <Sparkles size={14} className={activeTab === 'skills' ? "text-[#22577A]" : "text-zinc-400"} />
          Skills
          {activeTab === 'skills' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22577A] rounded-full" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('customers')}
          className={cn(
            "flex items-center gap-2 pb-3 transition-all cursor-pointer border-none bg-transparent font-medium relative",
            activeTab === 'customers' 
              ? "text-[#22577A] font-semibold" 
              : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          <Users size={14} className={activeTab === 'customers' ? "text-[#22577A]" : "text-zinc-400"} />
          Customers
          {activeTab === 'customers' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22577A] rounded-full" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('facts')}
          className={cn(
            "flex items-center gap-2 pb-3 transition-all cursor-pointer border-none bg-transparent font-medium relative",
            activeTab === 'facts' 
              ? "text-[#22577A] font-semibold" 
              : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          <BookOpen size={14} className={activeTab === 'facts' ? "text-[#22577A]" : "text-zinc-400"} />
          Business Facts
          {activeTab === 'facts' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22577A] rounded-full" />
          )}
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div className="mt-2">
        {activeTab === 'skills' && (
          <LocalEmptyState
            icon={Brain}
            title="No learned skills yet"
            description="Your AI will write reusable procedures here after it successfully completes tool-using tasks (sending emails, logging leads, scheduling, etc)."
          />
        )}

        {activeTab === 'customers' && (
          <LocalEmptyState
            icon={Brain}
            title="No customer profiles yet"
            description="As customers chat with your AI, it builds a living profile of each one - name, language, preferences, recurring asks. Profiles appear here automatically."
          />
        )}

        {activeTab === 'facts' && (
          <div className="space-y-4 text-left select-none">
            {/* Inline Compact Fact Input banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-zinc-200/60 rounded-xl p-3 shadow-xs">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[13px] font-bold text-zinc-700">Add a fact manually</span>
              </div>
              <div className="flex gap-2 flex-1 max-w-xl sm:justify-end">
                <input
                  type="text"
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  placeholder="e.g. We're closed on Sundays."
                  className="w-full max-w-md bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-[13px] placeholder:text-zinc-400 outline-none focus:border-[#22577A] transition-colors"
                />
                <Button
                  onClick={handleAddFact}
                  className="bg-[#22577A] hover:bg-[#1A4461] text-white font-semibold rounded-lg px-4 text-xs h-8.5 border-none shadow-xs cursor-pointer transition-colors"
                >
                  Add Fact
                </Button>
              </div>
            </div>

            {/* Saved Facts list block */}
            <div className="bg-white border border-zinc-200/60 rounded-xl p-4 shadow-xs">
              {facts.length === 0 ? (
                <LocalEmptyState
                  icon={Brain}
                  title="No business facts yet"
                  description="Each night your AI mines durable facts (hours, prices, policies) from real conversations and adds them here. You can also add facts manually above."
                />
              ) : (
                <div className="space-y-2.5">
                  <h4 className="text-[14px] font-semibold text-zinc-800 mb-2">Saved Facts</h4>
                  <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                    {facts.map((fact, index) => (
                      <div key={index} className="flex items-center justify-between py-2.5 text-[13px] text-zinc-700 group hover:bg-zinc-50/50 px-2 rounded-lg transition-colors">
                        <span className="flex-1 mr-4 leading-relaxed font-normal">{fact}</span>
                        <button
                          onClick={() => handleDeleteFact(index)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer border-none bg-transparent opacity-80 group-hover:opacity-100 transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
