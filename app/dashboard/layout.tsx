'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardBody>{children}</DashboardBody>
    </AuthProvider>
  );
}

function DashboardBody({ children }: { children: React.ReactNode }) {
  const { currentUser: authUser, loading: authLoading } = useAuth();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const [assistantName, setAssistantName] = useState("My AI Assistant");
  const [profileName, setProfileName] = useState("User");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [subData, setSubData] = useState<any>(null);

  useEffect(() => {
    if (!db || !workspaceId) return;
    const subRef = doc(db, 'workspaces', workspaceId, 'billing', 'subscription');
    const unsub = onSnapshot(subRef, (snap) => {
      if (snap.exists()) {
        setSubData(snap.data());
      } else {
        setSubData(null);
      }
    }, () => setSubData(null));
    return () => unsub();
  }, [workspaceId]);

  const currentUser = authUser || {
    uid: 'mock-user-id',
    email: 'rahul.khanna@dudo.com',
    displayName: 'Rahul Khanna',
    emailVerified: true,
  };

  const loading = authLoading && !authUser;

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    const loadProfileName = () => {
      let pName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
      if (typeof window !== 'undefined') {
        const localName = localStorage.getItem('__dudo_user_fullname');
        if (localName) pName = localName;
      }
      setProfileName(pName);
    };
    loadProfileName();
    window.addEventListener('dudo-profile-changed', loadProfileName);
    return () => {
      window.removeEventListener('dudo-profile-changed', loadProfileName);
    };
  }, [currentUser]);

  useEffect(() => {
    async function loadAssistant() {
      let name = "My AI Assistant";
      
      if (db && workspaceId) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            name = snap.data().name || name;
          }
        } catch (e) {}
      }

      if (typeof window !== 'undefined') {
        const localAss = localStorage.getItem('__dudo_dev_assistant');
        if (localAss) {
          try {
            const parsed = JSON.parse(localAss);
            name = parsed.name || name;
          } catch(e){}
        }
      }
      setAssistantName(name);
    }

    if (workspaceId) {
      loadAssistant();
    }
    
    window.addEventListener('dudo-config-changed', loadAssistant);
    return () => {
      window.removeEventListener('dudo-config-changed', loadAssistant);
    };
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full animate-bounce shrink-0" />
          <span className="text-sm text-zinc-500 font-semibold">Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  // Helper to format remaining trial time or current plan
  const getBannerText = () => {
    if (!subData) return `Welcome, ${profileName} | Free trial - 24 hours left`;
    
    if (subData.planId === 'trial') {
      const expiry = subData.expiryDate?.toDate ? subData.expiryDate.toDate() : subData.expiryDate ? new Date(subData.expiryDate) : null;
      if (!expiry) return `Welcome, ${profileName} | Free trial - 24 hours left`;
      
      const diffMs = expiry.getTime() - Date.now();
      if (diffMs <= 0 || subData.status === 'expired') {
        return `Welcome, ${profileName} | Free trial expired`;
      }
      
      const diffHrs = Math.max(0, Math.floor(diffMs / (60 * 60 * 1000)));
      const diffMins = Math.max(0, Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000)));
      if (diffHrs > 0) {
        return `Welcome, ${profileName} | Free trial - ${diffHrs} hours left`;
      } else {
        return `Welcome, ${profileName} | Free trial - ${diffMins} minutes left`;
      }
    }
    
    if (subData.status === 'expired') {
      return `Welcome, ${profileName} | Subscription expired`;
    }
    
    return `Welcome, ${profileName} | Active Plan: ${subData.planName || 'Active'}`;
  };

  const showUpgradeBtn = !subData || subData.planId !== '6months' || subData.status === 'expired';
  const upgradeBtnText = subData?.planId === 'trial' ? 'Upgrade ₹999' : 'Upgrade';

  return (
    <div className="flex h-screen bg-[#FFF8F0] overflow-hidden">
      <Sidebar onExpandedChange={setSidebarExpanded} />
      
      <div className={cn("flex-1 flex flex-col h-screen overflow-hidden relative bg-[#FFF8F0] transition-all duration-200 ease-in-out", sidebarExpanded ? "ml-60" : "ml-[60px]")}>
        
        <div className="relative z-0 flex-1 flex flex-col h-screen overflow-hidden bg-[#FFF8F0]">
          {/* Black backdrop overlay when sidebar is expanded */}
          <div 
            className={cn(
              "absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none z-40",
              sidebarExpanded ? "opacity-25" : "opacity-0"
            )}
          />
          {/* Top yellow/cream banner */}
          <div className="bg-[#FFF3E5] border-b border-[#EED9B4]/50 flex items-center justify-center py-2 px-4 gap-2.5 flex-shrink-0 text-[#22577A]">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight">
              <span>⏱</span>
              <span>{getBannerText()}</span>
            </div>
            {showUpgradeBtn && (
              <Button 
                onClick={() => router.push('/dashboard/billing')}
                className="h-6 text-[10px] bg-[#22577A] hover:bg-[#1A4461] text-white px-3 font-bold rounded-lg shadow-sm border-none cursor-pointer flex items-center justify-center transition-colors leading-none"
              >
                {upgradeBtnText}
              </Button>
            )}
          </div>
          
          {/* Top breadcrumb bar / Status bar */}
          <div className="bg-white border-b border-zinc-200/50 h-14 flex items-center px-6 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 select-none">
              <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full shrink-0" />
              <span className="text-xs font-bold text-zinc-800 tracking-tight">
                {assistantName}
              </span>
            </div>
          </div>

          {/* Main content area */}
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
