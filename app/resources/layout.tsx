'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Bot, Newspaper, BookOpen, FileText, RefreshCw, Check, ArrowLeft, Menu } from 'lucide-react';
import { useToast, ToastProvider } from '@/contexts/ToastContext';
import Logo from '@/components/ui/logo';
import MobileNavDrawer from '@/components/landing/MobileNavDrawer';

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ResourcesLayoutContent>{children}</ResourcesLayoutContent>
    </ToastProvider>
  );
}

function ResourcesLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isOpenMobileNav, setIsOpenMobileNav] = useState(false);

  const tabs = [
    { label: 'All Resources', href: '/resources', icon: Bot },
    { label: 'Blog', href: '/resources/blog', icon: Newspaper },
    { label: 'Guides', href: '/resources/guides', icon: BookOpen },
    { label: 'Templates', href: '/resources/templates', icon: FileText },
    { label: 'Changelog', href: '/resources/product-updates', icon: RefreshCw },
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.success('Subscribed!', 'Welcome to Weekly AI Employee Tips newsletter.');
      setEmail('');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-zinc-900 font-sans flex flex-col antialiased">

      {/* ── Top Navbar ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EED9B4]/40 shadow-xs select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-6">

          {/* Left Menu Hamburger (Mobile Only) */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setIsOpenMobileNav(true)}
              aria-label="Open menu"
              className="p-2 -ml-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-none cursor-pointer border-none bg-transparent"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 no-underline group shrink-0">
            <Logo className="w-8 h-8 transition-transform group-hover:scale-105" />
            <span className="text-xl sm:text-2xl font-black text-[#22577A] tracking-tight">Dudo</span>
          </Link>

          {/* Center: Resources Hub tabs */}
          <nav className="hidden md:flex items-center gap-7 font-extrabold text-xs tracking-tight uppercase text-zinc-600 overflow-x-auto scrollbar-none flex-1 justify-center">
            {tabs.map(t => {
              const Icon = t.icon;
              const active =
                pathname === t.href ||
                (t.href !== '/resources' && pathname?.startsWith(t.href));
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    'group relative py-1 flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200',
                    active ? 'text-[#22577A]' : 'text-zinc-600 hover:text-[#22577A]'
                  )}
                >
                  <Icon size={11} />
                  {t.label}
                  <span
                    className={cn(
                      'absolute bottom-0 left-0 h-0.5 bg-[#DBA11A] transition-all duration-300 ease-out',
                      active ? 'w-full' : 'w-0 group-hover:w-full'
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Right: Back to Dudo */}
          <div className="flex items-center shrink-0">
            <Link
              href="/"
              className="text-[11px] font-extrabold text-[#22577A] hover:text-[#1A4461] transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft size={12} /> Back to Dudo
            </Link>
          </div>

        </div>

        {/* ── Mobile tab strip ────────────────────────────────────────── */}
        <div className="md:hidden flex items-center gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none">
          {tabs.map(t => {
            const Icon = t.icon;
            const active =
              pathname === t.href ||
              (t.href !== '/resources' && pathname?.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all',
                  active
                    ? 'bg-zinc-100 text-[#22577A] border border-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/60'
                )}
              >
                <Icon size={11} /> {t.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* ── Main Page Content ────────────────────────────────────────── */}
      {/* Increased px to give clear visible gaps on left and right */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-8 sm:px-12 lg:px-16 py-8 relative">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20 select-none">
              <span className="text-xs text-zinc-400 font-bold">Loading Hub...</span>
            </div>
          }
        >
          {children}
        </Suspense>
      </main>

      {/* ── Newsletter Footer ────────────────────────────────────────── */}
      <footer className="bg-zinc-900 text-white border-t border-zinc-800 py-12 select-none">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block">Newsletter</span>
            <h3 className="text-base sm:text-lg font-black tracking-tight">Weekly AI Employee Tips</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Join <span className="text-white font-bold">10,000+ founders</span> receiving cutting-edge automation blueprints and prompt strategies every Thursday.
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your work email"
              className="flex-1 text-xs h-9 bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500 rounded-lg px-3.5 text-white placeholder:text-zinc-500"
              disabled={loading || submitted}
            />
            <button
              type="submit"
              disabled={loading || submitted}
              className="h-9 px-4 text-xs font-bold bg-[#22577A] hover:bg-[#1A4461] text-white rounded-lg border-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Subscribing...' : submitted ? <><Check size={12} /> Subscribed</> : 'Subscribe'}
            </button>
          </form>

          <p className="text-[9px] text-zinc-500">No credit card required. Unsubscribe in one click anytime.</p>
        </div>
      </footer>
      <MobileNavDrawer isOpen={isOpenMobileNav} onClose={() => setIsOpenMobileNav(false)} />
    </div>
  );
}
