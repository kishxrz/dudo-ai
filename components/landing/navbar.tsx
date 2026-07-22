import Link from 'next/link';
import { COMPANY_NAME, SIGNUP_URL, LOGIN_URL } from '@/lib/constants';
import Logo from '@/components/ui/logo';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EED9B4]/40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[76px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="w-9 h-9" />
          <span className="text-2xl font-black text-[#22577A] tracking-tight">{COMPANY_NAME}</span>
        </div>

        {/* Navigation Center */}
        <div className="hidden md:flex items-center gap-8 font-bold text-sm tracking-tight">
          <Link href="/#features" className="text-[#6B7280] hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Features</Link>
          <Link href="/#use-cases" className="text-[#6B7280] hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Use Cases</Link>
          <Link href="/#pricing" className="text-[#6B7280] hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">Pricing</Link>
          <Link href="/#faq" className="text-[#6B7280] hover:text-[#DBA11A] transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-[#DBA11A] hover:after:w-full after:transition-all after:duration-300">FAQ</Link>
        </div>

        <div className="flex items-center gap-5">
          <Link 
            href={LOGIN_URL} 
            className="text-sm font-extrabold text-[#22577A] hover:text-[#22577A] transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href={SIGNUP_URL} 
            className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-300 shadow-md shadow-[#DBA11A]/20 hover:shadow-lg hover:shadow-[#DBA11A]/35 hover:scale-105 active:scale-95 inline-flex items-center justify-center"
          >
            Start Free
          </Link>
        </div>
      </div>
    </nav>
  );
}
