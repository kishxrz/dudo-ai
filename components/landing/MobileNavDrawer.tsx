'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Home } from 'lucide-react';
import { COMPANY_NAME, SIGNUP_URL, LOGIN_URL } from '@/lib/constants';
import Logo from '@/components/ui/logo';
import { cn } from '@/lib/utils';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PUBLIC_LINKS = [
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

  // Scroll lock when drawer is open
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

  // Escape key close listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on route changes
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md transition-opacity duration-200"
          />

          {/* Slide-out Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 left-0 z-50 w-full max-w-[320px] bg-white border-r border-zinc-200 flex flex-col h-[100dvh] overflow-y-auto select-none shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="h-[68px] flex items-center justify-between px-5 border-b border-zinc-100 shrink-0">
              <Link href="/" className="flex items-center gap-2.5 no-underline group" onClick={onClose}>
                <Logo className="w-7 h-7" />
                <span className="text-lg font-black text-[#22577A] tracking-tight">{COMPANY_NAME}</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="w-9 h-9 rounded-lg border-none bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-700 cursor-pointer transition-colors active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Content */}
            <div className="flex-1 px-5 py-6 space-y-7 flex flex-col justify-between">
              <div className="space-y-6">
                
                {/* Section 1: Main pages */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block px-2 mb-2">Main Site</span>
                  <Link href="/" className="no-underline block" onClick={onClose}>
                    <div className="flex items-center gap-3 min-h-[44px] px-3.5 py-1 text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 rounded-xl transition-all cursor-pointer">
                      <Home size={16} className="text-zinc-400" />
                      <span className="text-sm font-bold">Home</span>
                    </div>
                  </Link>
                  {PUBLIC_LINKS.map((link) => {
                    const active = pathname === link.href || (link.href.startsWith('/#') && pathname === '/');
                    return (
                      <Link key={link.href} href={link.href} className="no-underline block" onClick={onClose}>
                        <div
                          className={cn(
                            "flex items-center justify-between min-h-[44px] px-3.5 py-1 rounded-xl transition-all cursor-pointer",
                            active
                              ? "bg-[#FFF3E5] text-[#22577A]"
                              : "text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
                          )}
                        >
                          <span className="text-sm font-bold">{link.label}</span>
                          <ChevronRight size={14} className={active ? "text-[#22577A]" : "text-zinc-300"} />
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Section 2: Resources Hub */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block px-2 mb-2">Resources Hub</span>
                  {RESOURCES_LINKS.map((link) => {
                    const active = pathname === link.href || (link.href !== '/resources' && pathname?.startsWith(link.href));
                    return (
                      <Link key={link.href} href={link.href} className="no-underline block" onClick={onClose}>
                        <div
                          className={cn(
                            "flex items-center justify-between min-h-[44px] px-3.5 py-1 rounded-xl transition-all cursor-pointer",
                            active
                              ? "bg-[#FFF3E5] text-[#22577A]"
                              : "text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100"
                          )}
                        >
                          <span className="text-sm font-bold">{link.label}</span>
                          <ChevronRight size={14} className={active ? "text-[#22577A]" : "text-zinc-300"} />
                        </div>
                      </Link>
                    );
                  })}
                </div>

              </div>

              {/* Action Buttons Section */}
              <div className="space-y-3 pt-6 border-t border-zinc-100 shrink-0">
                <Link href={LOGIN_URL} className="no-underline block" onClick={onClose}>
                  <div className="flex items-center justify-center min-h-[44px] w-full bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-bold rounded-xl text-sm border border-zinc-200/60 shadow-xs cursor-pointer transition-all active:scale-98">
                    Sign In
                  </div>
                </Link>
                <Link href={SIGNUP_URL} className="no-underline block" onClick={onClose}>
                  <div className="flex items-center justify-center min-h-[44px] w-full bg-gradient-to-r from-[#DBA11A] via-[#F3BE42] to-[#DBA11A] text-white font-black rounded-xl text-sm shadow-md cursor-pointer transition-all active:scale-98">
                    Start Free
                  </div>
                </Link>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
