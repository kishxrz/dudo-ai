'use client';

import Link from 'next/link';
import { COMPANY_NAME, SUPPORT_EMAIL } from '@/lib/constants';
import Logo from '@/components/ui/logo';

export default function Footer() {
  return (
    <footer className="bg-[#FFF3E5] text-[#22577A] py-24 sm:py-32 border-t border-[#EED9B4]/40 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-start text-left">
          
          {/* Left Column: Logo & Description (6/12 cols) */}
          <div className="md:col-span-6 space-y-6">
            <div className="flex items-center gap-2">
              <Logo className="w-7 h-7" />
              <span className="text-xl font-black text-[#22577A] tracking-tight">{COMPANY_NAME}</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[#22577A]/75 leading-relaxed max-w-sm">
              Your first AI employee for WhatsApp, Telegram and your website.
            </p>
            <p className="text-[11px] font-bold text-[#22577A]/50">
              © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
            </p>
          </div>

          {/* Center Column: Product links (3/12 cols) */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#22577A]">Product</h4>
            <ul className="space-y-3 text-xs font-extrabold text-[#22577A]/80">
              <li>
                <Link href="/#features" className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Features</Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Pricing</Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">FAQ</Link>
              </li>
            </ul>
          </div>

          {/* Right Column: Support & Legal links (3/12 cols) */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#22577A]">Support & Legal</h4>
            <ul className="space-y-3 text-xs font-extrabold text-[#22577A]/80">
              <li>
                <Link href="/privacy" className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Terms of Service</Link>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Support</a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Contact</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Row */}
        <div className="pt-8 border-t border-[#EED9B4]/30 text-center">
          <p className="text-[10px] sm:text-xs font-bold text-[#22577A]/85">
            Made with ❤️ in India
          </p>
        </div>

      </div>
    </footer>
  );
}
