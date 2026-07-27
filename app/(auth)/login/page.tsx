'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/ui/logo';
import { mapAuthError } from '@/lib/auth-errors';
import { Toast } from '@/components/ui/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, resetPassword, currentUser, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSentMsg, setResetSentMsg] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto redirect if already logged in (prevent flashing)
  useEffect(() => {
    if (!authLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, authLoading, router]);

  if (authLoading || currentUser) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-[#22577A]/20 rounded-full blur-xl animate-pulse" />
            <Logo className="w-14 h-14 relative z-10 animate-bounce" strokeColor="white" />
          </div>
          <p className="text-xs font-black text-[#22577A] tracking-wider uppercase">Loading session...</p>
        </motion.div>
      </div>
    );
  }

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.push('/dashboard');
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      setErrorMsg(friendlyMsg);
      setToast({ message: friendlyMsg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      const friendlyMsg = mapAuthError(err);
      setErrorMsg(friendlyMsg);
      setToast({ message: friendlyMsg, type: 'error' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setToast({ message: 'Please enter your email address.', type: 'error' });
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetSentMsg(`Password reset link sent to ${resetEmail.trim()}`);
      setToast({ message: 'Reset email sent successfully!', type: 'success' });
      setTimeout(() => {
        setShowForgotModal(false);
        setResetSentMsg(null);
      }, 3000);
    } catch (err: any) {
      setToast({ message: mapAuthError(err), type: 'error' });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#FFF8F0] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Decorative Background Element */}
      <div className="absolute top-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-[#22577A]/10 blur-3xl opacity-40 pointer-events-none" />

      {/* Main Glassmorphism Auth Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-[370px] sm:max-w-[390px] bg-white/95 backdrop-blur-md border border-[#EED9B4]/60 rounded-3xl p-6 sm:p-7 shadow-lg relative z-10 text-left"
      >
        {/* Animated Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Logo className="w-12 h-12" />
          </motion.div>

          <div className="space-y-0.5 pt-1">
            <h1 className="text-xl sm:text-2xl font-black text-[#22577A] tracking-tight leading-tight">
              Welcome Back
            </h1>
            <p className="text-xs font-bold text-zinc-500">
              Your AI employee is ready.
            </p>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Email Field */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">
              Email
            </label>
            <input
              type="email"
              placeholder="you@business.com"
              value={email}
              disabled={submitting || googleLoading}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50 shadow-xs"
            />
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-500">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-[11px] font-extrabold text-[#22577A] hover:underline bg-transparent border-none cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                disabled={submitting || googleLoading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-4 pr-11 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50 shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={submitting || googleLoading}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 bg-transparent border-none cursor-pointer p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold text-red-600 bg-red-50 border border-red-200/60 rounded-xl py-2.5 px-3.5 text-center leading-snug"
            >
              {errorMsg}
            </motion.div>
          )}

          {/* Submit Sign In Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting || googleLoading}
            className="w-full h-12 mt-2 bg-[#22577A] hover:bg-[#1A4461] text-white rounded-xl font-extrabold text-xs sm:text-sm cursor-pointer border-none flex items-center justify-center gap-2 shadow-lg shadow-[#22577A]/20 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Sign In"
            )}
          </motion.button>

        </form>

        {/* OR Divider */}
        <div className="flex items-center gap-3 my-6 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
          <div className="flex-1 h-px bg-zinc-200" />
          <span>OR</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>

        {/* Google Login Secondary Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || googleLoading}
          className="w-full h-12 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center transition-colors disabled:opacity-50 shadow-xs"
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

        {/* Bottom Link */}
        <div className="mt-8 text-center text-xs font-semibold text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[#22577A] hover:underline font-extrabold no-underline inline-flex items-center gap-1">
            Start Free <ArrowRight size={12} />
          </Link>
        </div>

      </motion.div>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setShowForgotModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-zinc-200 space-y-4 text-left"
            >
              <div className="flex items-center gap-2.5 text-[#22577A]">
                <div className="p-2 rounded-xl bg-[#22577A]/10">
                  <KeyRound size={18} />
                </div>
                <h3 className="text-base font-black text-zinc-900">Reset Password</h3>
              </div>

              <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                Enter your registered email address and we&apos;ll send you a password reset link.
              </p>

              {resetSentMsg ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{resetSentMsg}</span>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      placeholder="you@business.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#22577A]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 h-9 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-4 h-9 rounded-lg bg-[#22577A] hover:bg-[#1A4461] text-white text-xs font-bold cursor-pointer border-none disabled:opacity-50"
                    >
                      {resetLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
