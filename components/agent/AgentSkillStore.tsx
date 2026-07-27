'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Sparkles, 
  Check, 
  Download,
  X,
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/contexts/ToastContext';
import metadataListRaw from '@/data/skills/metadata.json';

interface CommunitySkill {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  installed: boolean;
  custom?: boolean;
}

const metadataList = metadataListRaw as { id: string; name: string; description: string; category: string; tags: string[] }[];
const BUILT_IN_COUNT = 200;
const BUILT_IN_IDS = new Set(metadataList.map(s => s.id).slice(0, BUILT_IN_COUNT));
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
    bg: 'bg-blue-50/70',
    text: 'text-blue-700',
    border: 'border-blue-200',
    colorHex: '#3b82f6'
  },
  'Sales & Marketing': {
    icon: Megaphone,
    bg: 'bg-emerald-50/70',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    colorHex: '#10b981'
  },
  'Scheduling': {
    icon: Calendar,
    bg: 'bg-amber-50/70',
    text: 'text-amber-700',
    border: 'border-amber-200',
    colorHex: '#f59e0b'
  },
  'Communication': {
    icon: Send,
    bg: 'bg-indigo-50/70',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    colorHex: '#6366f1'
  },
  'Analytics & Insights': {
    icon: BarChart4,
    bg: 'bg-purple-50/70',
    text: 'text-purple-700',
    border: 'border-purple-200',
    colorHex: '#a855f7'
  },
  'Industry Specific': {
    icon: Layers,
    bg: 'bg-cyan-50/70',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    colorHex: '#06b6d4'
  },
  'Browser & Automation': {
    icon: Globe,
    bg: 'bg-sky-50/70',
    text: 'text-sky-700',
    border: 'border-sky-200',
    colorHex: '#0ea5e9'
  },
  'Writing & Content': {
    icon: PenTool,
    bg: 'bg-orange-50/70',
    text: 'text-orange-700',
    border: 'border-orange-200',
    colorHex: '#f97316'
  },
  'Development & Coding': {
    icon: Code,
    bg: 'bg-teal-50/70',
    text: 'text-teal-700',
    border: 'border-teal-200',
    colorHex: '#14b8a6'
  },
  'General': {
    icon: Settings,
    bg: 'bg-zinc-50/70',
    text: 'text-zinc-700',
    border: 'border-zinc-200',
    colorHex: '#71717a'
  },
  'Education & Learning': {
    icon: BookOpen,
    bg: 'bg-rose-50/70',
    text: 'text-rose-700',
    border: 'border-rose-200',
    colorHex: '#f43f5e'
  },
  'Health & Wellness': {
    icon: Heart,
    bg: 'bg-pink-50/70',
    text: 'text-pink-700',
    border: 'border-pink-200',
    colorHex: '#ec4899'
  },
};

const DEFAULT_STYLE = {
  icon: HelpCircle,
  bg: 'bg-zinc-50/70',
  text: 'text-zinc-700',
  border: 'border-zinc-200',
  colorHex: '#71717a'
};

const CATEGORIES = [
  'All',
  'Customer Support',
  'Sales & Marketing',
  'Scheduling',
  'Communication',
  'Analytics & Insights',
  'Industry Specific',
  'Browser & Automation',
  'Writing & Content',
  'Development & Coding',
  'Education & Learning',
  'Health & Wellness',
  'General'
];

export default function AgentSkillStore() {
  const { workspaceId } = useWorkspace();
  const toast = useToast();
  const [skills, setSkills] = useState<CommunitySkill[]>([]);
  const [prompt, setPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Modal / Custom skill review state
  const [reviewSkill, setReviewSkill] = useState<any | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [transitioning, setTransitioning] = useState<Record<string, 'installing' | 'uninstalling'>>({});

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
  }, [selectedCategory, showInstalledOnly, debouncedSearchQuery]);

  const fetchStore = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/agent/skills?workspaceId=${workspaceId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.skills) return;

      const serverSkills = data.skills;
      const installedSet = new Set(serverSkills.filter((s: any) => s.enabled || s.source === 'built-in' || s.source === 'custom' || s.source === 'library').map((s: any) => s.id));
      const customItems = serverSkills.filter((s: any) => s.source === 'custom').map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        tags: s.tags || [],
        installed: true,
        custom: true
      }));

      // Interleave standard metadata list by category
      const groups: Record<string, typeof metadataList> = {};
      metadataList.forEach(s => {
        if (!groups[s.category]) groups[s.category] = [];
        groups[s.category].push(s);
      });

      const interleaved: typeof metadataList = [];
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

      const baseSkills = interleaved.map(s => {
        const isBuiltin = BUILT_IN_IDS.has(s.id);
        const isInstalled = isBuiltin || installedSet.has(s.id);
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          tags: s.tags || [],
          installed: isInstalled
        };
      });

      setSkills([...customItems, ...baseSkills]);
    } catch (err) {
      console.error('[AgentSkillStore] Failed to load store skills:', err);
    }
  };

  // Load from backend Skills API
  useEffect(() => {
    fetchStore();

    const handleSkillChange = () => {
      fetchStore();
    };
    window.addEventListener('dudo-skills-changed', handleSkillChange);

    return () => {
      window.removeEventListener('dudo-skills-changed', handleSkillChange);
    };
  }, [workspaceId]);

  const handleInstallToggle = async (id: string) => {
    if (BUILT_IN_IDS.has(id)) return; // Built-ins cannot be uninstalled

    const targetSkill = skills.find(s => s.id === id);
    if (!targetSkill) return;

    const isInstalling = !targetSkill.installed;
    const action = isInstalling ? 'install' : 'uninstall';

    // Set transition state
    setTransitioning(prev => ({ ...prev, [id]: isInstalling ? 'installing' : 'uninstalling' }));

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
        throw new Error(`Failed to ${action} skill on server`);
      }

      // Refresh data from server instead of optimistic local state
      await fetchStore();
      
      // Notify other tabs/components
      window.dispatchEvent(new Event('dudo-skills-changed'));
    } catch (err) {
      console.error(`[AgentSkillStore] Install toggle failed for action: ${action}`, err);
      toast.error(`Failed to ${action} skill. Please try again.`);
    } finally {
      // Clear transition state
      setTransitioning(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleCreateCustomSkill = async () => {
    if (!prompt.trim()) return;
    setCreating(true);
    setSaveError('');
    try {
      const res = await fetch('/api/agent/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createCustom',
          workspaceId,
          prompt: prompt.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.skill) {
          setReviewSkill(data.skill);
          setPrompt('');
        } else {
          toast.error(data.error || 'Failed to generate custom skill.');
        }
      } else {
        const errText = await res.text();
        toast.error(`Error: ${errText}`);
      }
    } catch (e) {
      console.error('[AgentSkillStore] AI generation failed:', e);
      toast.error('An error occurred during skill generation.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveCustomSkill = async () => {
    if (!reviewSkill) return;
    setSavingCustom(true);
    setSaveError('');

    try {
      const res = await fetch('/api/agent/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveCustom',
          workspaceId,
          skill: reviewSkill
        })
      });

      if (res.ok) {
        setReviewSkill(null);
        window.dispatchEvent(new Event('dudo-skills-changed'));
      } else {
        const data = await res.json();
        setSaveError(data.error || 'Failed to save custom skill.');
      }
    } catch (err) {
      console.error('[AgentSkillStore] Save failed:', err);
      setSaveError('Failed to save skill.');
    } finally {
      setSavingCustom(false);
    }
  };

  const filteredSkills = useMemo(() => {
    let result = skills.filter(skill => {
      const matchesCategory = selectedCategory === 'All' || skill.category === selectedCategory;
      const matchesSearch = debouncedSearchQuery ? (
        skill.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
        skill.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        skill.tags.some(tag => tag.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))
      ) : true;
      const matchesInstalled = !showInstalledOnly || skill.installed;
      return matchesCategory && matchesSearch && matchesInstalled;
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
  }, [skills, selectedCategory, debouncedSearchQuery, showInstalledOnly]);

  const visibleSkills = filteredSkills.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {/* Compact AI Skill Creator */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm select-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
          <div>
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">AI Skill Creator</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Describe what you want your AI agent to do, and we'll create a custom skill.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Handle price negotiations with customers diplomatically..."
            className="text-xs border-zinc-200 focus-visible:ring-[#22577A] text-zinc-800 placeholder:text-zinc-400 bg-white min-h-[52px] resize-none"
            rows={1}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleCreateCustomSkill}
              disabled={!prompt.trim() || creating}
              className="bg-[#22577A] hover:bg-[#1A4461] text-white h-8 text-[10px] font-semibold px-4 rounded-md cursor-pointer disabled:opacity-100 disabled:bg-zinc-150 disabled:text-zinc-400 disabled:cursor-not-allowed border border-transparent disabled:border-zinc-200"
            >
              {creating ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                "Create Skill"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Community Store Section */}
      <div className="space-y-3.5">
        {/* Filters and Search Control Card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3 select-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>Community Skill Store</span>
              <span className="text-zinc-400 font-medium normal-case">({skills.length} available)</span>
              {skills.filter(s => s.installed).length > 0 && (
                <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-[#22577A]/10 text-[#22577A]">
                  {skills.filter(s => s.installed).length} installed
                </span>
              )}
            </h3>
            
            <div className="flex items-center space-x-2 shrink-0">
              <input
                type="checkbox"
                id="show-installed-only"
                checked={showInstalledOnly}
                onChange={(e) => setShowInstalledOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-300 text-[#22577A] focus:ring-[#22577A] accent-[#22577A] cursor-pointer"
              />
              <Label htmlFor="show-installed-only" className="text-xs text-zinc-500 font-medium cursor-pointer select-none">
                Show Installed only
              </Label>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
            <Input
              type="text"
              placeholder="Search community skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8.5 text-xs border-zinc-200 focus-visible:ring-[#22577A] placeholder:text-zinc-400 text-zinc-800 bg-white"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 max-w-full">
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat;
              const catCount = skills.filter(s => cat === 'All' || s.category === cat).length;
              const style = CATEGORY_STYLES[cat] || DEFAULT_STYLE;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'text-[10px] px-2.5 py-1.5 rounded-md transition-all duration-200 ease-out cursor-pointer border whitespace-nowrap flex items-center justify-center gap-1 active:scale-95 hover:shadow-sm',
                    isSelected
                      ? cat === 'All'
                        ? 'bg-[#22577A] text-white border-[#22577A] shadow-sm font-extrabold scale-[1.03]'
                        : `${style.text} ${style.bg} border-2 border-current shadow-sm font-extrabold scale-[1.03]`
                      : cat === 'All'
                        ? 'bg-zinc-100 text-zinc-700 border-zinc-300 font-bold'
                        : `${style.text} ${style.bg} ${style.border} font-bold opacity-80 hover:opacity-100`
                  )}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 animate-pulse" />}
                  <span>{cat} ({catCount})</span>
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
                  skill.installed 
                    ? 'border-zinc-300 ring-1 ring-[#22577A]/10 shadow-sm' 
                    : 'border-zinc-200 hover:border-zinc-350'
                )}
                style={{ 
                  borderLeftWidth: skill.installed ? '5px' : '4px',
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
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-zinc-900 truncate leading-none">{skill.name}</h4>
                          {skill.custom && (
                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-purple-50 text-purple-650 border border-purple-200 leading-none">CUSTOM</span>
                          )}
                        </div>
                        <span className={cn('text-[9px] uppercase tracking-wider font-extrabold block mt-0.5', style.text)}>
                          {skill.category}
                        </span>
                      </div>

                      {transitioning[skill.id] ? (
                        <div className="flex items-center gap-1 text-[8.5px] text-[#22577A] font-black bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded whitespace-nowrap leading-none select-none">
                          <span className="w-2 h-2 border-2 border-[#22577A] border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>{transitioning[skill.id] === 'installing' ? 'Installing...' : 'Uninstalling...'}</span>
                        </div>
                      ) : skill.installed ? (
                        BUILT_IN_IDS.has(skill.id) ? (
                          <div className="flex items-center gap-0.5 text-[8px] text-[#22577A] font-black bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap leading-none">
                            DEFAULT
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 text-[8px] text-green-600 font-black bg-green-50 border border-green-200 px-1.5 py-0.5 rounded whitespace-nowrap leading-none">
                            <Check size={8} className="stroke-[3.5]" />
                            INSTALLED
                          </div>
                        )
                      ) : (
                        <Button
                          onClick={() => handleInstallToggle(skill.id)}
                          size="sm"
                          className="bg-[#22577A] hover:bg-[#1A4461] text-white text-[9px] font-bold h-6 px-2.5 rounded flex items-center gap-0.5 cursor-pointer shrink-0 border-none leading-none"
                        >
                          <Download size={8} />
                          Install
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 leading-normal line-clamp-2 mt-1">{skill.description}</p>
                  </div>
                </div>

                {skill.installed && !BUILT_IN_IDS.has(skill.id) && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-100 flex justify-end">
                    {transitioning[skill.id] === 'uninstalling' ? (
                      <span className="text-[9px] font-bold text-zinc-400 select-none">Uninstalling...</span>
                    ) : (
                      <button
                        onClick={() => handleInstallToggle(skill.id)}
                        disabled={!!transitioning[skill.id]}
                        className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer bg-transparent border-none p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Uninstall skill
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredSkills.length === 0 && (
            <div className="col-span-full text-center py-10 text-zinc-400 text-xs bg-white border border-zinc-200 rounded-xl">
              No skills available in store matching filters.
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

      {/* Review Modal */}
      {reviewSkill && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-zinc-150 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#22577A] animate-pulse" />
                <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider">Review Generated Custom Skill</h3>
              </div>
              <button 
                onClick={() => setReviewSkill(null)} 
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer bg-transparent border-none p-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-zinc-500 uppercase">Skill Name</Label>
                  <input
                    type="text"
                    value={reviewSkill.name}
                    onChange={(e) => setReviewSkill({ ...reviewSkill, name: e.target.value })}
                    className="w-full text-xs h-8 px-2.5 rounded-lg border border-zinc-200 focus-visible:outline-[#22577A] text-zinc-800 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-zinc-500 uppercase">Category</Label>
                  <select
                    value={reviewSkill.category}
                    onChange={(e) => setReviewSkill({ ...reviewSkill, category: e.target.value })}
                    className="w-full text-xs h-8 px-2.5 rounded-lg border border-zinc-200 focus-visible:outline-[#22577A] text-zinc-800 bg-white"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-zinc-500 uppercase">Description</Label>
                <input
                  type="text"
                  value={reviewSkill.description}
                  onChange={(e) => setReviewSkill({ ...reviewSkill, description: e.target.value })}
                  className="w-full text-xs h-8 px-2.5 rounded-lg border border-zinc-200 focus-visible:outline-[#22577A] text-zinc-850 bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-zinc-500 uppercase">Instructions & Prompt Behavior</Label>
                <Textarea
                  value={reviewSkill.instructions}
                  onChange={(e) => setReviewSkill({ ...reviewSkill, instructions: e.target.value })}
                  className="text-xs border-zinc-200 focus-visible:ring-[#22577A] text-zinc-800 bg-white min-h-[100px]"
                  rows={4}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-zinc-500 uppercase">Google Tools Allowed</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { id: 'google-calendar-list', label: 'Read Calendar Events' },
                    { id: 'google-calendar-create', label: 'Create Calendar Events' },
                    { id: 'gmail-send', label: 'Send Emails via Gmail' },
                    { id: 'google-sheets-append', label: 'Append Rows to Google Sheets' },
                    { id: 'google-docs-create', label: 'Create Documents on Drive' }
                  ].map(t => {
                    const isChecked = (reviewSkill.requiredTools || []).includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center space-x-2 text-[10px] text-zinc-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newTools = e.target.checked
                              ? [...(reviewSkill.requiredTools || []), t.id]
                              : (reviewSkill.requiredTools || []).filter((id: string) => id !== t.id);
                            setReviewSkill({
                              ...reviewSkill,
                              requiredTools: newTools,
                              handlerType: newTools.length > 0 ? 'tool' : 'instruction'
                            });
                          }}
                          className="w-3.5 h-3.5 rounded border-zinc-300 text-[#22577A] focus:ring-[#22577A] accent-[#22577A] cursor-pointer"
                        />
                        <span>{t.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {saveError && (
                <p className="text-[10px] font-semibold text-red-500">
                  ⚠️ {saveError}
                </p>
              )}
            </div>

            <div className="p-4 border-t border-zinc-150 bg-zinc-50 rounded-b-xl flex justify-end gap-2.5">
              <Button
                onClick={() => setReviewSkill(null)}
                variant="outline"
                className="h-8.5 text-xs text-zinc-600 cursor-pointer bg-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomSkill}
                disabled={savingCustom}
                className="bg-[#22577A] hover:bg-[#1A4461] text-white h-8.5 text-xs font-semibold px-4.5 rounded-lg cursor-pointer"
              >
                {savingCustom ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  "Save & Install Skill"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
