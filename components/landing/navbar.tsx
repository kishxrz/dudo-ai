'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { COMPANY_NAME, SIGNUP_URL, LOGIN_URL } from '@/lib/constants';
import Logo from '@/components/ui/logo';
import { motion } from 'framer-motion';
import MobileNavDrawer from '@/components/landing/MobileNavDrawer';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EED9B4]/40 shadow-xs select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between gap-2">

          {/* Brand Logo — always visible */}
          <Link href="/" className="flex items-center gap-2 no-underline group shrink-0">
            <Logo className="w-8 h-8 transition-transform group-hover:scale-105" />
            <span className="text-xl sm:text-2xl font-black text-[#22577A] tracking-tight">{COMPANY_NAME}</span>
          </Link>

          {/* Desktop Navigation Center — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-8 font-extrabold text-xs tracking-tight uppercase text-zinc-600">
            <Link href="/#features" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Features</Link>
            <Link href="/#use-cases" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Use Cases</Link>
            <Link href="/#pricing" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Pricing</Link>
            <Link href="/resources" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Resources</Link>
            <Link href="/#faq" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">FAQ</Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Desktop: Sign In */}
            <Link
              href={LOGIN_URL}
              className="text-xs sm:text-sm font-extrabold text-[#22577A] hover:text-[#1A4461] transition-colors px-3 py-2 hidden md:block"
            >
              Sign In
            </Link>

            {/* Desktop: Start Free (animated) */}
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="hidden md:block">
              <Link
                href={SIGNUP_URL}
                className="relative overflow-hidden group bg-gradient-to-r from-[#DBA11A] via-[#F3BE42] to-[#DBA11A] text-white px-5 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all duration-300 shadow-md shadow-[#DBA11A]/25 hover:shadow-xl hover:shadow-[#DBA11A]/40 inline-flex items-center justify-center border border-white/20 cursor-pointer"
              >
                <span className="relative z-10">Start Free</span>
                <span className="absolute inset-0 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
            </motion.div>

            {/* Mobile: Sign In — visible on xs/sm, hidden on md+ */}
            <Link
              href={LOGIN_URL}
              className="md:hidden text-xs font-bold text-[#22577A] hover:text-[#1A4461] transition-colors px-2 py-2 whitespace-nowrap"
            >
              Sign In
            </Link>

            {/* Mobile: Start Free — always visible on mobile */}
            <Link
              href={SIGNUP_URL}
              className="md:hidden bg-gradient-to-r from-[#DBA11A] via-[#F3BE42] to-[#DBA11A] text-white px-4 py-2 rounded-full text-xs font-black shadow-md shadow-[#DBA11A]/25 inline-flex items-center justify-center border border-white/20 whitespace-nowrap active:scale-95 transition-transform"
            >
              Start Free
            </Link>

            {/* Mobile Hamburger — md:hidden */}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isOpen}
              aria-controls="mobile-nav-drawer"
              className="md:hidden w-11 h-11 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22577A]/40 cursor-pointer border-none bg-transparent"
            >
              <Menu size={22} />
            </button>

          </div>
        </div>
      </header>

      {/* Mobile Drawer — rendered outside header so z-index stack is clean */}
      <MobileNavDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
