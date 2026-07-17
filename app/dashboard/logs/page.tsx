'use client';

import { useState, useEffect } from 'react';
import { RotateCw, Sparkles, Users, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/useWorkspace';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';

export default function LogsPage() {
  const { workspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'all' | 'user' | 'agent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const colRef = collection(db, 'workspaces', workspaceId, 'conversations');
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const list: any[] = [];
      snap.docs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now());
        
        if (data.userMessage) {
          list.push({
            id: doc.id + '-user',
            type: 'user',
            text: data.userMessage,
            name: data.customer?.name || 'Customer',
            channel: data.channel || 'unknown',
            timestamp,
          });
        }
        if (data.botReply) {
          list.push({
            id: doc.id + '-agent',
            type: 'agent',
            text: data.botReply,
            name: 'AI Assistant',
            channel: data.channel || 'unknown',
            timestamp: new Date(timestamp.getTime() + 1000), // small offset to place replies after user messages
          });
        }
      });
      list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setLogs(list);
      setLoading(false);
    }, (error) => {
      console.error("Activity logs subscription failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [workspaceId, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const totalCount = logs.length;
  const todayCount = logs.filter(l => {
    return new Date(l.timestamp).toDateString() === new Date().toDateString();
  }).length;

  const filteredLogs = logs.filter(l => {
    if (activeTab === 'user' && l.type !== 'user') return false;
    if (activeTab === 'agent' && l.type !== 'agent') return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const textMatch = (l.text || '').toLowerCase().includes(q);
      const nameMatch = (l.name || '').toLowerCase().includes(q);
      const channelMatch = (l.channel || '').toLowerCase().includes(q);
      return textMatch || nameMatch || channelMatch;
    }
    
    return true;
  });

  const filteredCount = filteredLogs.length;

  return (
    <PageLayout className="max-w-[1150px] w-full text-left mx-auto gap-5 px-6 box-border">
      {/* 1. Custom Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 text-[#22577A] mt-1">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-zinc-950 tracking-tight leading-none mb-2">
              Activity Logs
            </h1>
            <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">
              Real-time view of all agent conversations and actions
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleRefresh}
          className="h-8.5 px-3.5 bg-white border border-[#22577A] hover:bg-[#22577A]/5 text-[#22577A] font-semibold rounded-xl shadow-xs text-xs cursor-pointer flex items-center gap-1.5 transition-all shrink-0 hover:scale-[1.01] active:scale-99"
        >
          <RotateCw size={13} className="text-[#22577A]" />
          Refresh
        </Button>
      </div>

      {/* 2. Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left select-none">
        {[
          { label: 'Total Messages', value: totalCount },
          { label: 'Today', value: todayCount },
          { 
            label: activeTab === 'all' 
              ? 'Filtered' 
              : activeTab === 'user' 
              ? 'User Messages' 
              : 'Assistant Messages',
            value: filteredCount 
          },
          { label: 'Navigation', value: 'Page 1/1' },
        ].map((card, i) => (
          <div key={i} className="bg-white border border-zinc-200/60 rounded-xl p-3.5 shadow-xs flex flex-col justify-center h-[70px] hover:shadow-sm transition-all duration-300">
            <div className="text-xl font-bold text-zinc-950 leading-none">{card.value}</div>
            <div className="text-[10.5px] text-zinc-500 font-semibold uppercase tracking-wider mt-1.5 leading-none">
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 w-full sm:w-auto shrink-0">
          {(['all', 'user', 'agent'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "h-8 px-3.5 text-[13px] font-medium rounded-lg cursor-pointer border transition-all duration-150 min-w-[130px] flex items-center justify-center whitespace-nowrap shrink-0",
                activeTab === tab 
                  ? "bg-[#22577A] border-[#22577A] text-white font-semibold" 
                  : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600"
              )}
            >
              {tab === 'all' ? 'All' : tab === 'user' ? 'User Messages' : 'Agent Replies'}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-60 shrink-0">
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
          />
        </div>
      </div>

      {/* 4. Logs Card Container */}
      <div className="bg-white border border-zinc-200/60 rounded-xl p-4 shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-zinc-400 font-semibold text-xs select-none">
            <RotateCw size={14} className="animate-spin text-[#22577A]" />
            Subscribing to real-time logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={RotateCw}
            title="No logs found"
            description="Your real-time event logs will show up here as your receptionist processes transactions."
            className="border-none py-10"
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredLogs.map((log) => (
              <div key={log.id} className="py-3 last:pb-0 first:pt-0 text-left border-b border-zinc-100 last:border-b-0">
                <div className="flex items-start gap-2.5 w-full">
                  <div className={cn(
                    "w-6.5 h-6.5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border select-none",
                    log.type === 'user' 
                      ? "bg-[#22577A]/10 text-[#22577A] border-[#22577A]/20" 
                      : "bg-[#DBA11A]/10 text-[#DBA11A] border-[#DBA11A]/20"
                  )}>
                    {log.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[13px] font-semibold text-zinc-950">{log.name}</span>
                      <span className={cn(
                        "text-[9px] font-medium uppercase px-1.5 py-0.5 rounded tracking-wide border leading-none",
                        log.type === 'user'
                          ? "bg-blue-50/70 text-blue-700 border-blue-200/50"
                          : "bg-amber-50/70 text-[#DBA11A] border-amber-200/50"
                      )}>
                        {log.type === 'user' ? 'User' : 'Agent'}
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-700 mt-1 font-normal break-all whitespace-pre-wrap leading-relaxed">
                      {log.text}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2 select-none">
                      <span className="text-[9px] font-medium uppercase px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-500 tracking-wider bg-zinc-50 leading-none">
                        {log.channel}
                      </span>
                      <span className="text-xs text-zinc-400 font-normal shrink-0">
                        {log.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} at {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
