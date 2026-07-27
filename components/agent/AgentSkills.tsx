'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search,
  Check,
  Headphones, 
  Megaphone, 
  Calendar, 
  Send, 
  BarChart4, 
  Layers, 
  Globe, 
  PenTool, 
  Code, 
  Settings, 
  BookOpen, 
  Heart,
  HelpCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import metadataListRaw from '@/data/skills/metadata.json';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/ToastContext';

interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  enabled: boolean;
}

const metadataList = metadataListRaw as { id: string; name: string; description: string; category: string; tags: string[] }[];
const PAGE_SIZE = 40;

const CATEGORY_STYLES: Record<string, { 
  icon: React.ComponentType<{ size?: number; className?: string }>; 
  bg: string; 
  text: string; 
  border: string; 
  colorHex: string;
}> = {
  'Customer Support': {
    icon: Headphones,
    bg: 'bg-blue-50/60',
    text: 'text-blue-700',
    border: 'border-blue-200/60',
    colorHex: '#3b82f6'
  },
  'Sales & Marketing': {
    icon: Megaphone,
    bg: 'bg-green-50/60',
    text: 'text-green-700',
    border: 'border-green-200/60',
    colorHex: '#22c55e'
  },
  'Scheduling': {
    icon: Calendar,
    bg: 'bg-purple-50/60',
    text: 'text-purple-700',
    border: 'border-purple-200/60',
    colorHex: '#a855f7'
  },
  'Communication': {
    icon: Send,
    bg: 'bg-indigo-50/60',
    text: 'text-indigo-700',
    border: 'border-indigo-200/60',
    colorHex: '#6366f1'
  },
  'Analytics & Insights': {
    icon: BarChart4,
    bg: 'bg-amber-50/60',
    text: 'text-amber-700',
    border: 'border-amber-200/60',
    colorHex: '#f59e0b'
  },
  'Industry Specific': {
    icon: Layers,
    bg: 'bg-cyan-50/60',
    text: 'text-cyan-700',
    border: 'border-cyan-200/60',
    colorHex: '#06b6d4'
  },
  'Browser & Automation': {
    icon: Globe,
    bg: 'bg-sky-50/60',
    text: 'text-sky-700',
    border: 'border-sky-200/60',
    colorHex: '#0ea5e9'
  },
  'Writing & Content': {
    icon: PenTool,
    bg: 'bg-orange-50/60',
    text: 'text-orange-700',
    border: 'border-orange-200/60',
    colorHex: '#f97316'
  },
  'Development & Coding': {
    icon: Code,
    bg: 'bg-teal-50/60',
    text: 'text-teal-700',
    border: 'border-teal-200/60',
    colorHex: '#14b8a6'
  },
  'General': {
    icon: Settings,
    bg: 'bg-zinc-50/60',
    text: 'text-zinc-700',
    border: 'border-zinc-200/60',
    colorHex: '#71717a'
  },
  'Education & Learning': {
    icon: BookOpen,
    bg: 'bg-rose-50/60',
    text: 'text-rose-700',
    border: 'border-rose-200/60',
    colorHex: '#f43f5e'
  },
  'Health & Wellness': {
    icon: Heart,
    bg: 'bg-pink-50/60',
    text: 'text-pink-700',
    border: 'border-pink-200/60',
    colorHex: '#ec4899'
  },
};

const DEFAULT_STYLE = {
  icon: HelpCircle,
  bg: 'bg-zinc-50/60',
  text: 'text-zinc-700',
  border: 'border-zinc-200/60',
  colorHex: '#71717a'
};

const DEFAULT_CATALOG = metadataList.slice(0, 200);

export default function AgentSkills() {
  const { workspaceId } = useWorkspace();
  const toast = useToast();
  const [skills, setSkills] = useState<Skill[]>(() => {
    // Interleave by category from default 200 built-in skills so "All" section shows mixed skills
    const groups: Record<string, typeof DEFAULT_CATALOG> = {};
    DEFAULT_CATALOG.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });

    const interleaved: typeof DEFAULT_CATALOG = [];
    const categoriesKeys = Object.keys(groups);
    let hasMore = true;
    let index = 0;

    while (hasMore) {
      hasMore = false;
      categoriesKeys.forEach(cat => {
        if (groups[cat][index]) {
          interleaved.push(groups[cat][index]);
          hasMore = true;
        }
      });
      index++;
    }

    return interleaved.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      tags: s.tags,
      enabled: false
    }));
  });
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sync debounced search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page count when filter parameters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, showEnabledOnly, debouncedSearchQuery]);

  const [transitioning, setTransitioning] = useState<Record<string, boolean>>({});

  const fetchSkills = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/agent/skills?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.skills) {
          // Map returned SkillDefinitions to Skill representation
          const mapped = data.skills.map((s: any) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            description: s.description,
            tags: s.tags || [],
            enabled: s.enabled,
            source: s.source
          }));
          setSkills(mapped);
        }
      }
    } catch (err) {
      console.error('[AgentSkills] Failed to fetch skills:', err);
    }
  };

  // Load from backend Skills API
  useEffect(() => {
    fetchSkills();

    // Listen for external skill change updates (e.g. from Skill Store installations)
    const handleSkillChange = () => {
      fetchSkills();
    };
    window.addEventListener('dudo-skills-changed', handleSkillChange);

    return () => {
      window.removeEventListener('dudo-skills-changed', handleSkillChange);
    };
  }, [workspaceId]);

  const handleToggle = async (id: string) => {
    const targetSkill = skills.find(s => s.id === id);
    if (!targetSkill) return;

    const action = targetSkill.enabled ? 'disable' : 'enable';
    
    // Set transition state
    setTransitioning(prev => ({ ...prev, [id]: true }));

    try {
      const res = await fetch('/api/agent/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          workspaceId,
          skillId: id
        })
      });

      if (!res.ok) {
        throw new Error('Failed to toggle skill state on server');
      }

      // Refresh data from server instead of optimistic local state
      await fetchSkills();

      window.dispatchEvent(new Event('dudo-skills-changed'));
    } catch (err) {
      console.error('[AgentSkills] Toggle skill failed:', err);
      toast.error(`Failed to ${action} skill. Please try again.`);
    } finally {
      setTransitioning(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const enabledCount = skills.filter(s => s.enabled).length;

  const filteredSkills = useMemo(() => {
    let result = skills.filter(skill => {
      const matchesCategory = selectedCategory === 'All' || skill.category === selectedCategory;
      const matchesSearch = debouncedSearchQuery ? (
        skill.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
        skill.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        skill.tags.some(tag => tag.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      ) : true;
      const matchesEnabled = !showEnabledOnly || skill.enabled;
      return matchesCategory && matchesSearch && matchesEnabled;
    });

    if (selectedCategory === 'All') {
      const groups: Record<string, typeof result> = {};
      result.forEach(s => {
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
      });

      const interleaved: typeof result = [];
      const categoriesKeys = Object.keys(groups);
      let hasMore = true;
      let index = 0;

      while (hasMore) {
        hasMore = false;
        categoriesKeys.forEach(cat => {
          if (groups[cat][index]) {
            interleaved.push(groups[cat][index]);
            hasMore = true;
          }
        });
        index++;
      }
      result = interleaved;
    }

    return result;
  }, [skills, selectedCategory, debouncedSearchQuery, showEnabledOnly]);

  const visibleSkills = filteredSkills.slice(0, visibleCount);

  // Calculate dynamic categories and counts
  const categoriesList = [
    'Customer Support',
    'Sales & Marketing',
    'Scheduling',
    'Communication',
    'Analytics & Insights',
    'Industry Specific',
    'Browser & Automation',
    'Writing & Content',
    'Development & Coding',
    'General',
    'Education & Learning',
    'Health & Wellness'
  ];

  const categories = [
    { id: 'All', label: 'All', count: skills.length },
    ...categoriesList.map(cat => ({
      id: cat,
      label: cat,
      count: skills.filter(s => s.category === cat).length
    }))
  ];

  return (
    <div className="space-y-4">
      {/* Search & Filter Header Card */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4.5 shadow-sm space-y-3.5 select-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 animate-in fade-in">
              <span>Assistant Skills</span>
              <span className="text-zinc-400 font-medium normal-case">({enabledCount} of {skills.length} enabled)</span>
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Toggle and customize active capability templates for your assistant.</p>
          </div>
          <div className="flex items-center space-x-2 shrink-0 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 hover:bg-zinc-100/50 transition-colors">
            <input
              type="checkbox"
              id="show-enabled-only"
              checked={showEnabledOnly}
              onChange={(e) => setShowEnabledOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-300 text-[#22577A] focus:ring-[#22577A] accent-[#22577A] cursor-pointer"
            />
            <Label htmlFor="show-enabled-only" className="text-[11px] text-zinc-700 font-semibold cursor-pointer select-none">
              Enabled Only
            </Label>
          </div>
        </div>

        {/* Compact Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
          <Input
            type="text"
            placeholder="Search skills... (e.g. appointment, lead, FAQ)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs border-zinc-200 hover:border-zinc-300 focus-visible:ring-[#22577A] placeholder:text-zinc-400 text-zinc-800 bg-white transition-all shadow-inner"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            const style = CATEGORY_STYLES[cat.id] || DEFAULT_STYLE;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'text-[10px] px-2.5 py-1.5 rounded-md transition-all duration-200 ease-out cursor-pointer border whitespace-nowrap flex items-center justify-center gap-1 active:scale-95 hover:shadow-sm',
                  isSelected
                    ? cat.id === 'All' 
                      ? 'bg-[#22577A] text-white border-[#22577A] shadow-sm font-extrabold scale-[1.03]'
                      : `${style.text} ${style.bg} border-2 border-current shadow-sm font-extrabold scale-[1.03]`
                    : cat.id === 'All'
                      ? 'bg-zinc-100 text-zinc-700 border-zinc-300 font-bold'
                      : `${style.text} ${style.bg} ${style.border} font-bold opacity-80 hover:opacity-100`
                )}
              >
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 animate-pulse" />}
                <span>{cat.label} ({cat.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {visibleSkills.map(skill => {
          const style = CATEGORY_STYLES[skill.category] || DEFAULT_STYLE;
          const CategoryIcon = style.icon;

          return (
            <div
              key={skill.id}
              className={cn(
                'bg-white border rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-205 relative overflow-hidden',
                skill.enabled 
                  ? 'border-zinc-300 ring-1 ring-[#22577A]/10 shadow-sm' 
                  : 'border-zinc-200 hover:border-zinc-350'
              )}
              style={{ 
                borderLeftWidth: skill.enabled ? '5px' : '4px',
                borderLeftColor: style.colorHex 
              }}
            >
              <div className="flex gap-3 items-start">
                {/* Category Icon */}
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border shrink-0', style.bg, style.border, style.text)}>
                  <CategoryIcon size={15} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <h4 className="text-xs font-bold text-zinc-900 truncate leading-none">{skill.name}</h4>
                      {skill.enabled && (
                        <span className="text-[7.5px] font-black px-1.5 py-0.5 rounded bg-[#22577A]/15 text-[#22577A] tracking-wider leading-none">
                          ENABLED
                        </span>
                      )}
                    </div>

                    {/* Custom Dodo Switch */}
                    <button
                      onClick={() => handleToggle(skill.id)}
                      disabled={transitioning[skill.id]}
                      className={cn(
                        'w-9 h-5 rounded-full p-0.5 transition-all duration-300 focus:outline-none relative cursor-pointer flex-none shrink-0 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed',
                        skill.enabled ? 'bg-[#22577A]' : 'bg-zinc-200'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center',
                          skill.enabled ? 'translate-x-4' : 'translate-x-0'
                        )}
                      >
                        {transitioning[skill.id] ? (
                          <span className="w-2 h-2 border border-[#22577A] border-t-transparent rounded-full animate-spin" />
                        ) : skill.enabled ? (
                          <Check size={8} className="text-[#22577A] stroke-[4]" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                        )}
                      </div>
                    </button>
                  </div>

                  <span className={cn('text-[9px] uppercase tracking-wider font-extrabold block mt-0.5', style.text)}>
                    {skill.category}
                  </span>

                  <p className="text-xs text-zinc-600 leading-normal line-clamp-2 mt-1">{skill.description}</p>
                </div>
              </div>
            </div>
          );
        })}

        {filteredSkills.length === 0 && (
          <div className="col-span-full text-center py-10 text-zinc-500 text-xs bg-white border border-zinc-200 rounded-xl">
            No skills found matching the criteria.
          </div>
        )}

        {/* Load More Button */}
        {filteredSkills.length > visibleCount && (
          <div className="col-span-full flex justify-center mt-2">
            <Button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="bg-[#22577A] hover:bg-[#1A4461] text-white text-xs font-semibold px-5 h-8 rounded-lg cursor-pointer"
            >
              Load More Skills
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
