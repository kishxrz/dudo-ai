import Link from 'next/link';
import Navbar from '@/components/landing/navbar';
import Footer from '@/components/landing/footer';
import { COMPANY_NAME, SUPPORT_EMAIL } from '@/lib/constants';

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-semibold mt-2">
            Last updated: July 6, 2026
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#EED9B4] rounded-[2rem] p-8 sm:p-12 shadow-lg space-y-8 text-sm sm:text-base text-zinc-650 leading-relaxed font-medium">
          
          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">1. Agreement to Terms</h2>
            <p>
              By accessing or using {COMPANY_NAME}, you agree to be bound by these terms of service. If you disagree with any part of these terms, you may not access or use our services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">2. Use License & Account Responsibility</h2>
            <p>
              When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password.
            </p>
            <p>
              You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">3. Indian SaaS Operations & API Use</h2>
            <p>
              {COMPANY_NAME} operates as an Indian SaaS platform. We support "Bring Your Own Key" (BYOK) configurations where users connect their own third-party API keys (e.g. OpenAI, Google Gemini, Anthropic, Groq). You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are solely responsible for all API requests and associated fees charged by third-party model providers.</li>
              <li>You must comply with all third-party terms of service for any integrated channels (including WhatsApp, Telegram, and Google Workspace).</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">4. Prohibited Uses</h2>
            <p>
              You may use our service only for lawful purposes. You agree not to use the service:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>In any way that violates any applicable national or international law or regulation.</li>
              <li>For the purpose of exploiting, harming, or attempting to exploit or harm minors in any way.</li>
              <li>To transmit, or procure the sending of, any advertising or promotional material, including "junk mail", "spam", or unsolicited messages.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">5. Disclaimer of Warranties</h2>
            <p>
              Our services are provided on an "AS IS" and "AS AVAILABLE" basis. We make no representations or warranties of any kind, express or implied, as to the operation of our services, or the information, content, or materials included therein.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">6. Limitation of Liability</h2>
            <p>
              In no event shall {COMPANY_NAME}, nor its directors, employees, partners, or agents, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg sm:text-xl font-black text-[#22577A]">7. Contact Us</h2>
            <p>
              If you have any questions about these terms, please contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#22577A] font-bold hover:underline">{SUPPORT_EMAIL}</a>.
            </p>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
