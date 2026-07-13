'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/conversations': 'Conversations',
  '/dashboard/agent': 'AI Agent',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/logs': 'Logs',
  '/dashboard/integration': 'Integrations',
  '/dashboard/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const { currentUser } = useAuth();

  // Match by prefix for agent sub-tabs
  const title = Object.entries(pageTitles)
    .sort(([a], [b]) => b.length - a.length)
    .find(([key]) => pathname.startsWith(key))?.[1] ?? 'Dashboard';

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-40">
      <h1 className="text-sm font-semibold text-zinc-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="w-8 h-8 rounded-lg hover:bg-zinc-50 flex items-center justify-center transition-colors relative cursor-pointer">
          <Bell size={15} className="text-zinc-500" />
        </button>

        {/* User avatar */}
        <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
          <span className="text-white text-xs font-semibold">{initials}</span>
        </div>
      </div>
    </header>
  );
}
