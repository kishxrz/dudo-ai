import Link from 'next/link';
import Navbar from '@/components/landing/navbar';
import Footer from '@/components/landing/footer';
import { COMPANY_NAME, SUPPORT_EMAIL } from '@/lib/constants';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FFF8F0] text-zinc-800 font-sans selection:bg-[#DB1A1A]/10 selection:text-[#DB1A1A] antialiased">
      <Navbar />
      
      {/* Header Banner */}
      <section className="py-20 bg-gradient-to-b from-white to-[#FFF8F0] border-b border-[#EED9B4]/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-[#22577A]/5 blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#22577A] bg-[#FFE7B5]/20 hover:bg-[#FFE7B5]/40 border border-[#EED9B4]/30 px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 cursor-pointer"
            >
              &larr; Back to Home
            </Link>
          </div>
          <span className="text-[#22577A] text-xs font-extrabold uppercase tracking-widest block">
            LEGAL
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#22577A] leading-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-semibold mt-2">
            Last updated: July 6, 2026
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 sm:p-12 shadow-lg space-y-8 text-sm sm:text-base text-zinc-600 leading-relaxed font-medium">
          
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">1. Introduction</h2>
            <p>
              Welcome to {COMPANY_NAME}. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">2. The Data We Collect</h2>
            <p>
              We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
              <li><strong>Contact Data</strong> includes email address and telephone numbers.</li>
              <li><strong>Technical Data</strong> includes internet protocol (IP) address, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform.</li>
              <li><strong>Usage Data</strong> includes information about how you use our website, products and services.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">3. How We Use Your Data</h2>
            <p>
              We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>To register you as a new customer.</li>
              <li>To provide, manage, and maintain our services.</li>
              <li>To notify you about changes to our services.</li>
              <li>To provide customer support and improve our platform.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">4. Third-Party Integrations</h2>
            <p>
              {COMPANY_NAME} offers integrations with third-party providers (such as Telegram, WhatsApp, and Google Calendar). When you authorize our platform to interact with these services, we only request the minimal permissions necessary to facilitate automated responses, message forwarding, and calendar scheduling as configured by you.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">5. Data Security</h2>
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">6. Contact Us</h2>
            <p>
              If you have any questions about this privacy policy or our privacy practices, please contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#22577A] font-bold hover:underline">{SUPPORT_EMAIL}</a>.
            </p>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
