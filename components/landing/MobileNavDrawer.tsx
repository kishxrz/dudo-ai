'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Home, LayoutDashboard, LogOut } from 'lucide-react';
import { COMPANY_NAME, SIGNUP_URL, LOGIN_URL } from '@/lib/constants';
import Logo from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAIN_LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/#features', label: 'Features' },
  { href: '/#use-cases', label: 'Use Cases' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

const RESOURCES_LINKS = [
  { href: '/resources', label: 'All Resources' },
  { href: '/resources/blog', label: 'Blog' },
  { href: '/resources/guides', label: 'Guides' },
  { href: '/resources/templates', label: 'Templates' },
  { href: '/resources#use-cases', label: 'Case Studies' },
];

export default function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Track previous pathname so we only close on actual navigations, not on mount
  const prevPathnameRef = useRef<string>(pathname);

  // Auth state — safe for public pages (no AuthProvider needed)
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ESC key listener — only active when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on route change — but NOT on initial mount (compare with previous)
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  const handleSignOut = async () => {
    onClose();
    try {
      await auth?.signOut();
    } catch {}
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href.startsWith('/#')) return pathname === '/';
    return pathname === href || (href !== '/resources' && pathname?.startsWith(href));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — z-50 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Drawer panel — z-[60] so it sits above backdrop */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-[60] w-full max-w-[320px] bg-white border-r border-zinc-200 flex flex-col h-[100dvh] overflow-y-auto select-none shadow-2xl"
          >
            {/* Header */}
            <div className="h-[68px] flex items-center justify-between px-5 border-b border-zinc-100 shrink-0">
              <Link href="/" className="flex items-center gap-2.5 no-underline group" onClick={onClose}>
                <Logo className="w-7 h-7" />
                <span className="text-lg font-black text-[#22577A] tracking-tight">{COMPANY_NAME}</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="w-11 h-11 rounded-xl border-none bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-700 cursor-pointer transition-colors active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Content */}
            <div className="flex-1 px-4 py-5 flex flex-col gap-6 overflow-y-auto">

              {/* Main Site Links */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block px-3 mb-1.5">
                  Main Site
                </span>
                <nav className="flex flex-col gap-0.5">
                  {MAIN_LINKS.map((link) => {
                    const active = isActive(link.href);
                    const Icon = 'icon' in link ? link.icon : null;
                    return (
                      <Link key={link.href} href={link.href} className="no-underline block" onClick={onClose}>
                        <div
                          className={cn(
                            'flex items-center justify-between min-h-[48px] px-4 rounded-xl transition-all',
                            active
                              ? 'bg-[#FFF3E5] text-[#22577A]'
                              : 'text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {Icon && <Icon size={16} className={active ? 'text-[#22577A]' : 'text-zinc-400'} />}
                            <span className="text-[15px] font-semibold">{link.label}</span>
                          </div>
                          <ChevronRight size={14} className={active ? 'text-[#22577A]' : 'text-zinc-300'} />
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Resources Links */}
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block px-3 mb-1.5">
                  Resources Hub
                </span>
                <nav className="flex flex-col gap-0.5">
                  {RESOURCES_LINKS.map((link) => {
                    const active = isActive(link.href);
                    return (
                      <Link key={link.href} href={link.href} className="no-underline block" onClick={onClose}>
                        <div
                          className={cn(
                            'flex items-center justify-between min-h-[48px] px-4 rounded-xl transition-all',
                            active
                              ? 'bg-[#FFF3E5] text-[#22577A]'
                              : 'text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100'
                          )}
                        >
                          <span className="text-[15px] font-semibold">{link.label}</span>
                          <ChevronRight size={14} className={active ? 'text-[#22577A]' : 'text-zinc-300'} />
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>

            </div>

            {/* Auth Actions — pinned to bottom */}
            <div className="px-4 pb-6 pt-4 border-t border-zinc-100 shrink-0 flex flex-col gap-3">
              {!authLoading && user ? (
                /* Logged In */
                <>
                  <Link href="/dashboard" className="no-underline block" onClick={onClose}>
                    <div className="flex items-center justify-center gap-2 min-h-[48px] w-full bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold rounded-xl text-[15px] border border-zinc-200/60 shadow-xs cursor-pointer transition-all active:scale-[0.98]">
                      <LayoutDashboard size={16} className="text-zinc-500" />
                      Dashboard
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-2 min-h-[48px] w-full bg-zinc-50 hover:bg-red-50 text-zinc-500 hover:text-red-600 font-semibold rounded-xl text-[15px] border border-zinc-200/60 cursor-pointer transition-all active:scale-[0.98] border-none"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </>
              ) : (
                /* Logged Out */
                <>
                  <Link href={LOGIN_URL} className="no-underline block" onClick={onClose}>
                    <div className="flex items-center justify-center min-h-[48px] w-full bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold rounded-xl text-[15px] border border-zinc-200/60 shadow-xs cursor-pointer transition-all active:scale-[0.98]">
                      Sign In
                    </div>
                  </Link>
                  <Link href={SIGNUP_URL} className="no-underline block" onClick={onClose}>
                    <div className="flex items-center justify-center min-h-[48px] w-full bg-gradient-to-r from-[#DBA11A] via-[#F3BE42] to-[#DBA11A] text-white font-black rounded-xl text-[15px] shadow-md cursor-pointer transition-all active:scale-[0.98]">
                      Start Free
                    </div>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
