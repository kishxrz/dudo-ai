'use client';

import Link from 'next/link';
import { COMPANY_NAME, SIGNUP_URL, LOGIN_URL } from '@/lib/constants';
import Logo from '@/components/ui/logo';
import { motion } from 'framer-motion';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EED9B4]/40 shadow-xs select-none">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline group">
          <Logo className="w-8 h-8 transition-transform group-hover:scale-105" />
          <span className="text-xl sm:text-2xl font-black text-[#22577A] tracking-tight">{COMPANY_NAME}</span>
        </Link>

        {/* Navigation Center */}
        <div className="hidden md:flex items-center gap-8 font-extrabold text-xs tracking-tight uppercase text-zinc-600">
          <Link href="/#features" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Features</Link>
          <Link href="/#use-cases" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Use Cases</Link>
          <Link href="/#pricing" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Pricing</Link>
          <Link href="/#faq" className="hover:text-[#22577A] transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">FAQ</Link>
        </div>

        {/* Auth Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link 
            href={LOGIN_URL} 
            className="text-xs sm:text-sm font-extrabold text-[#22577A] hover:text-[#1A4461] transition-colors px-2 py-1"
          >
            Sign In
          </Link>
          
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link 
              href={SIGNUP_URL} 
              className="relative overflow-hidden group bg-gradient-to-r from-[#DBA11A] via-[#F3BE42] to-[#DBA11A] text-white px-5 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all duration-300 shadow-md shadow-[#DBA11A]/25 hover:shadow-xl hover:shadow-[#DBA11A]/40 inline-flex items-center justify-center border border-white/20 cursor-pointer"
            >
              <span className="relative z-10">Start Free</span>
              <span className="absolute inset-0 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </motion.div>
        </div>

      </div>
    </header>
  );
}
