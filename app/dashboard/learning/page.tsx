'use client';

import { useState, useEffect } from 'react';
import { Brain, RotateCw, Sparkles, Users, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { db } from '@/lib/firebase';
import { collection, doc, addDoc, deleteDoc, onSnapshot, query, getDocs } from 'firebase/firestore';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';

interface Skill {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferences: string;
  lastActive: string;
}

function LocalEmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number }>, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-[220px] border border-zinc-200/80 rounded-xl bg-white select-none px-6 py-4">
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
  const { workspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'skills' | 'customers' | 'facts'>('skills');

  // Real-time Firestore or fallback States
  const [skills, setSkills] = useState<Skill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facts, setFacts] = useState<string[]>([]);
  const [newFact, setNewFact] = useState('');
  const [loading, setLoading] = useState(true);

  // Load and Subscribe to Real-time Collections
  useEffect(() => {
    if (!workspaceId) return;

    // 1. Load Skills
    const skillsQuery = query(collection(db, 'workspaces', workspaceId, 'learning_skills'));
    const unsubscribeSkills = onSnapshot(skillsQuery, (snapshot) => {
      const loaded: Skill[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Skill[];
      
      setSkills(loaded);
    }, (err) => {
      console.error('Skills listener error:', err);
    });

    // 2. Load Customers
    const customersQuery = query(collection(db, 'workspaces', workspaceId, 'customer_profiles'));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const loaded: Customer[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];

      setCustomers(loaded);
    }, (err) => {
      console.error('Customers listener error:', err);
    });

    // 3. Load Facts
    const factsQuery = query(collection(db, 'workspaces', workspaceId, 'learning_facts'));
    const unsubscribeFacts = onSnapshot(factsQuery, (snapshot) => {
      const loaded = snapshot.docs.map(doc => doc.data().fact) as string[];
      setFacts(loaded);
      setLoading(false);
    }, (err) => {
      console.error('Facts listener error:', err);
      setLoading(false);
    });

    return () => {
      unsubscribeSkills();
      unsubscribeCustomers();
      unsubscribeFacts();
    };
  }, [workspaceId]);

  const handleAddFact = async () => {
    if (!newFact.trim() || !workspaceId) return;
    const factText = newFact.trim();

    // Save to Firestore
    try {
      const colRef = collection(db, 'workspaces', workspaceId, 'learning_facts');
      await addDoc(colRef, {
        fact: factText,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error('Failed to add fact to Firestore:', e);
    }

    // Save to local state fallback
    const updated = [...facts, factText];
    setFacts(updated);
    localStorage.setItem('__dudo_dev_learning_facts', JSON.stringify(updated));
    setNewFact('');
  };

  const handleDeleteFact = async (index: number) => {
    const targetFact = facts[index];
    const updated = facts.filter((_, i) => i !== index);
    setFacts(updated);
    localStorage.setItem('__dudo_dev_learning_facts', JSON.stringify(updated));

    if (!workspaceId) return;

    // Delete from Firestore
    try {
      const colRef = collection(db, 'workspaces', workspaceId, 'learning_facts');
      const snap = await getDocs(colRef);
      const docToDelete = snap.docs.find(doc => doc.data().fact === targetFact);
      if (docToDelete) {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'learning_facts', docToDelete.id));
      }
    } catch (e) {
      console.error('Failed to delete fact from Firestore:', e);
    }
  };

  const [resetting, setResetting] = useState(false);

  const handleResetAll = async () => {
    if (!window.confirm("Are you sure you want to clear all learned skills, customer profiles, and business facts? This will reset them back to empty states.")) {
      return;
    }
    setResetting(true);
    try {
      if (workspaceId) {
        // 1. Clear skills
        const skillsRef = collection(db, 'workspaces', workspaceId, 'learning_skills');
        const skillsSnap = await getDocs(skillsRef);
        for (const docSnap of skillsSnap.docs) {
          await deleteDoc(doc(db, 'workspaces', workspaceId, 'learning_skills', docSnap.id));
        }

        // 2. Clear customers
        const customersRef = collection(db, 'workspaces', workspaceId, 'customer_profiles');
        const customersSnap = await getDocs(customersRef);
        for (const docSnap of customersSnap.docs) {
          await deleteDoc(doc(db, 'workspaces', workspaceId, 'customer_profiles', docSnap.id));
        }

        // 3. Clear facts
        const factsRef = collection(db, 'workspaces', workspaceId, 'learning_facts');
        const factsSnap = await getDocs(factsRef);
        for (const docSnap of factsSnap.docs) {
          await deleteDoc(doc(db, 'workspaces', workspaceId, 'learning_facts', docSnap.id));
        }
      }
      
      localStorage.removeItem('__dudo_dev_learning_facts');
      
      setSkills([]);
      setCustomers([]);
      setFacts([]);
    } catch (e) {
      console.error('Failed to reset learning data:', e);
    } finally {
      setResetting(false);
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
        
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleResetAll}
            disabled={resetting}
            className="h-8.5 px-3.5 bg-white border border-red-300 hover:bg-red-50/50 text-red-600 hover:text-red-700 hover:border-red-400 font-bold rounded-xl shadow-xs text-xs cursor-pointer flex items-center gap-1.5 transition-all shrink-0 active:scale-99 disabled:opacity-50 disabled:pointer-events-none"
          >
            {resetting ? 'Resetting...' : 'Reset data'}
          </Button>
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="h-8.5 px-3.5 bg-white border border-[#22577A] hover:bg-[#22577A]/5 text-[#22577A] font-semibold rounded-xl shadow-xs text-xs cursor-pointer flex items-center gap-1.5 transition-all shrink-0 hover:scale-[1.01] active:scale-99"
          >
            <RotateCw size={13} className="text-[#22577A]" />
            Reflect now
          </Button>
        </div>
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
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full animate-bounce" />
          </div>
        ) : (
          <>
            {activeTab === 'skills' && (
              <div className="space-y-4">
                {skills.length === 0 ? (
                  <LocalEmptyState
                    icon={Brain}
                    title="No learned skills yet"
                    description="Your AI will write reusable procedures here after it successfully completes tool-using tasks (sending emails, logging leads, scheduling, etc)."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {skills.map((skill) => (
                      <div key={skill.id} className="bg-white border border-zinc-200/60 rounded-xl p-4 shadow-xs text-left hover:border-[#22577A]/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-[#22577A]/10 text-[#22577A] rounded-lg">
                              <Sparkles size={14} />
                            </span>
                            <h4 className="text-[14px] font-bold text-zinc-900">{skill.name}</h4>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-medium">Active</span>
                        </div>
                        <p className="text-[13px] text-zinc-600 mt-2.5 leading-relaxed font-normal">{skill.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="space-y-4">
                {customers.length === 0 ? (
                  <LocalEmptyState
                    icon={Users}
                    title="No customer profiles yet"
                    description="As customers chat with your AI, it builds a living profile of each one - name, language, preferences, recurring asks. Profiles appear here automatically."
                  />
                ) : (
                  <div className="bg-white border border-zinc-200/60 rounded-xl overflow-hidden shadow-xs">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Learned Preferences</th>
                            <th className="px-4 py-3 text-right">Last Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-[13px] text-zinc-700">
                          {customers.map((c) => (
                            <tr key={c.id} className="hover:bg-zinc-50/40 transition-colors">
                              <td className="px-4 py-3 font-semibold text-zinc-900">{c.name}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span>{c.email}</span>
                                  <span className="text-[11px] text-zinc-400">{c.phone}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-xs truncate font-normal text-zinc-600">{c.preferences}</td>
                              <td className="px-4 py-3 text-right text-[11px] text-zinc-400">{new Date(c.lastActive).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="divide-y divide-zinc-100 sm:hidden">
                      {customers.map((c) => (
                        <div key={c.id} className="p-4 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900 text-sm leading-snug">{c.name}</span>
                              <div className="flex flex-col text-[11px] text-zinc-400 mt-0.5">
                                {c.email && c.email !== '—' && <span>{c.email}</span>}
                                {c.phone && c.phone !== '—' && <span>{c.phone}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
                              {new Date(c.lastActive).toLocaleDateString()}
                            </span>
                          </div>
                          {c.preferences && (
                            <div className="bg-zinc-50/70 p-2.5 rounded-xl border border-zinc-100/80 text-[11px] text-zinc-600 leading-normal font-semibold">
                              {c.preferences}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                      className="w-full max-w-md bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-[13px] text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-[#22577A] transition-colors"
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
          </>
        )}
      </div>
    </PageLayout>
  );
}
