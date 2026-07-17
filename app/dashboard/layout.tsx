/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/purity */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import { Clock, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SubscriptionProvider, useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { LockedPage } from '@/components/subscription/FeatureGate';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <DashboardBody>{children}</DashboardBody>
      </SubscriptionProvider>
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

  const { subscription, loading: subLoading, isExpired, isTrial, remainingText, canUse } = useSubscriptionContext();
  const pathname = usePathname();

  const getRequiredFeature = (path: string): string | null => {
    if (path.startsWith('/dashboard/knowledge')) return 'knowledge';
    if (path.startsWith('/dashboard/appointments')) return 'calendar';
    if (path.startsWith('/dashboard/integration')) return 'google';
    if (path.startsWith('/dashboard/analytics')) return 'google';
    if (path.startsWith('/dashboard/schedule')) return 'calendar';
    if (path.startsWith('/dashboard/logs')) return 'google';
    return null;
  };

  const requiredFeature = getRequiredFeature(pathname);
  const isFeatureAllowed = requiredFeature ? canUse(requiredFeature) : true;

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

  // Auto-redirect to billing if plan/trial is expired
  useEffect(() => {
    if (!subLoading && isExpired) {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        if (pathname !== '/dashboard/billing' && pathname !== '/dashboard/settings/billing') {
          router.replace('/dashboard/billing');
        }
      }
    }
  }, [subLoading, isExpired, router]);

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
    if (subLoading) return `Welcome, ${profileName} | Loading subscription...`;
    if (!subscription) return `Welcome, ${profileName} | Free trial - 30 minutes left`;
    
    if (isExpired) {
      return `Welcome, ${profileName} | Subscription expired`;
    }
    if (subscription.plan === 'trial') {
      return `Welcome, ${profileName} | Free trial - ${remainingText}`;
    }
    return `Welcome, ${profileName} | Active Plan: ${subscription.planName} (${remainingText})`;
  };

  const showUpgradeBtn = subLoading || !subscription || subscription.plan !== 'six_month' || isExpired;
  const upgradeBtnText = subscription?.plan === 'trial' ? 'Upgrade ₹999' : 'Upgrade';

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#FFF8F0] overflow-hidden">
      <Sidebar 
        onExpandedChange={setSidebarExpanded} 
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      
      <div className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden relative bg-[#FFF8F0] transition-all duration-200 ease-in-out",
        "ml-0 md:ml-[60px] lg:ml-60",
        sidebarExpanded && "md:ml-60 lg:ml-60"
      )}>
        
        <div className="relative z-0 flex-1 flex flex-col h-screen overflow-hidden bg-[#FFF8F0]">
          {/* Black backdrop overlay when sidebar is expanded on tablet */}
          <div 
            className={cn(
              "absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none z-40 hidden md:block",
              sidebarExpanded ? "opacity-25" : "opacity-0"
            )}
          />
          {/* Mobile drawer overlay */}
          {mobileSidebarOpen && (
            <div 
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-200"
            />
          )}

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
          <div className="bg-white border-b border-zinc-200/50 h-14 flex items-center px-4 sm:px-6 flex-shrink-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1.5 mr-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-none"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 select-none">
              <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full shrink-0" />
              <span className="text-xs font-bold text-zinc-800 tracking-tight">
                {assistantName}
              </span>
            </div>
          </div>

          {/* Main content area */}
          <main className="flex-1 p-4 sm:p-5 md:p-6 overflow-y-auto">
            {isFeatureAllowed ? children : (
              <LockedPage feature={requiredFeature!} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
