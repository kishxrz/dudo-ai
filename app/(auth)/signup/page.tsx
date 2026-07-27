'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/ui/logo';
import { mapAuthError } from '@/lib/auth-errors';
import { Toast } from '@/components/ui/Toast';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  
  const { signUp, signInWithGoogle, currentUser, loading: authLoading } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto redirect if already logged in (prevent flashing)
  useEffect(() => {
    if (!authLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, authLoading, router]);

  if (authLoading || currentUser) {
    return (
      <div className="h-screen bg-[#FFF8F0] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-[#22577A]/20 rounded-full blur-xl animate-pulse" />
            <Logo className="w-14 h-14 relative z-10 animate-bounce" strokeColor="white" />
          </div>
          <p className="text-xs font-black text-[#22577A] tracking-wider uppercase">Checking session...</p>
        </motion.div>
      </div>
    );
  }

  const handleSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in Full Name, Business Email, and Password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      await signUp(email.trim(), password, fullName.trim(), businessName.trim());
      
      if (plan === 'monthly' || plan === '6months') {
        router.push(`/dashboard/billing?checkout_auto=${plan}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      setErrorMsg(friendlyMsg);
      setToast({ message: friendlyMsg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
      if (plan === 'monthly' || plan === '6months') {
        router.push(`/dashboard/billing?checkout_auto=${plan}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      setErrorMsg(friendlyMsg);
      setToast({ message: friendlyMsg, type: 'error' });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#FFF8F0] flex flex-col lg:flex-row font-sans antialiased select-none relative overflow-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* LEFT / HERO SECTION - Clean Solid Deep Blue Background */}
      <div className="lg:w-[46%] bg-[#22577A] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-hidden h-full">
        
        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-4 shrink-0">
          <Logo className="w-11 h-11" />
          <span className="text-3xl font-black tracking-tight text-white">Dudo</span>
        </div>

        {/* Hero Copy - Gold Gradient Text on AI Employee */}
        <div className="relative z-10 my-auto py-4 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-extrabold text-[#F3BE42] backdrop-blur-md">
            <Zap size={13} className="animate-pulse text-[#F3BE42]" />
            <span>Instant Setup • No Credit Card</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.12] text-white">
            Start your <br />
            <span className="bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] bg-clip-text text-transparent">
              AI Employee
            </span> today
          </h1>

          <p className="text-white/80 text-xs sm:text-sm font-semibold max-w-md leading-relaxed">
            Empower your business with an AI agent that works 24/7, answers questions in regional languages, and automates support seamlessly.
          </p>

          {/* Benefits Checklist */}
          <div className="pt-2 space-y-2.5 max-w-md">
            {[
              'No credit card required',
              'Setup in under 60 seconds',
              'WhatsApp integration',
              'Telegram integration',
            ].map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
                className="flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-[#DBA11A]/20 border border-[#DBA11A] flex items-center justify-center shrink-0 text-[#F3BE42]">
                  <CheckCircle2 size={13} strokeWidth={3} />
                </div>
                <span className="text-white text-xs sm:text-sm font-extrabold tracking-tight">
                  {benefit}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Guarantee */}
        <div className="relative z-10 pt-4 border-t border-white/15 flex items-center gap-2.5 text-[11px] font-semibold text-white/80 shrink-0">
          <ShieldCheck size={16} className="text-[#F3BE42] shrink-0" />
          <span>Enterprise-grade privacy & 99.9% uptime guarantee.</span>
        </div>

      </div>

      {/* RIGHT / FORM SECTION - Clean Fixed Fit */}
      <div className="lg:w-[54%] flex flex-col justify-center items-center p-4 sm:p-8 lg:p-10 flex-1 overflow-y-auto lg:overflow-hidden h-full">
        
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white border border-[#EED9B4]/60 rounded-3xl p-6 sm:p-8 shadow-md text-left my-auto"
        >
          
          <div className="mb-5 space-y-0.5">
            <h2 className="text-xl sm:text-2xl font-black text-[#22577A] tracking-tight">
              Create Free Account
            </h2>
            <p className="text-xs font-bold text-zinc-500">
              Get started with Dudo in under 60 seconds.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            
            {/* Business Name */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Business Name <span className="text-zinc-400 font-medium">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Enterprises"
                value={businessName}
                disabled={submitting || googleLoading}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50 shadow-xs"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Rahul Khanna"
                value={fullName}
                disabled={submitting || googleLoading}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50 shadow-xs"
              />
            </div>

            {/* Business Email */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Business Email
              </label>
              <input
                type="email"
                placeholder="you@business.com"
                value={email}
                disabled={submitting || googleLoading}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50 shadow-xs"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                disabled={submitting || googleLoading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50 shadow-xs"
              />
            </div>

            {/* Error Display */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-bold text-red-600 bg-red-50 border border-red-200/60 rounded-xl py-2 px-3 text-center leading-snug"
              >
                {errorMsg}
              </motion.div>
            )}

            {/* Primary Submit Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting || googleLoading}
              className="w-full h-11 mt-1 bg-[#22577A] hover:bg-[#1A4461] text-white rounded-xl font-extrabold text-xs cursor-pointer border-none flex items-center justify-center gap-2 shadow-md shadow-[#22577A]/20 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Create Free Account"
              )}
            </motion.button>

          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            <div className="flex-1 h-px bg-zinc-200" />
            <span>OR</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* Google Signup Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleSignup}
            disabled={submitting || googleLoading}
            className="w-full h-10 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center transition-colors disabled:opacity-50 shadow-xs"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <svg className="w-4 h-4 mr-2.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </motion.button>

          {/* Login Link */}
          <div className="mt-5 text-center text-xs font-semibold text-zinc-500">
            Already have an account?{' '}
            <Link href="/login" className="text-[#22577A] hover:underline font-extrabold no-underline inline-flex items-center gap-1">
              Sign In <ArrowRight size={12} />
            </Link>
          </div>

        </motion.div>

      </div>

    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#FFF8F0] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full animate-bounce shrink-0" />
          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Loading...</span>
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
