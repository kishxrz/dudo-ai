/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Logo from '@/components/ui/logo';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in Name, Email, and Password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      if (auth) {
        // 1. Create Firebase user
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        // 2. Update display name
        await updateProfile(user, { displayName: name });
        // 3. Create Firestore user document
        if (db) {
          await setDoc(doc(db, 'users', user.uid), {
            name,
            email,
            createdAt: new Date().toISOString(),
            plan: 'free',
          });
        }
      } else {
        console.log('Firebase fallback mock sign up complete');
      }
      
      if (plan === 'monthly' || plan === '6months') {
        router.push(`/dashboard/billing?checkout_auto=${plan}`);
      } else {
        router.push('/dashboard');
      }
    } catch (e: any) {
      console.error(e);
      const code = e?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMsg('Account already exists. Please login.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password must be at least 6 characters');
      } else {
        setErrorMsg(e?.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      if (auth) {
        const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
        // Create Firestore user document
        if (db) {
          await setDoc(doc(db, 'users', user.uid), {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            createdAt: new Date().toISOString(),
            plan: 'free',
          });
        }
      } else {
        console.log('Firebase fallback mock Google sign up');
      }
      
      if (plan === 'monthly' || plan === '6months') {
        router.push(`/dashboard/billing?checkout_auto=${plan}`);
      } else {
        router.push('/dashboard');
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'Google Sign-Up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full font-sans antialiased bg-[#FFF8F0] select-none">
      
      {/* LEFT PANEL */}
      <div className="lg:w-[45%] bg-[#22577A] flex flex-col items-center justify-center text-white px-8 lg:px-12 py-10 lg:py-0 text-center min-h-[320px] lg:min-h-screen">
        <Logo className="w-16 h-16" strokeColor="#22577A" />
        
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white mt-5 tracking-tight">
          Your AI employee awaits
        </h1>
        <p className="text-white/80 text-sm mt-3 max-w-xs leading-relaxed font-semibold">
          Join business owners saving 2-3 hours daily with Dudo agents.
        </p>

        {/* Feature List */}
        <div className="mt-6 text-left space-y-3.5 max-w-xs mx-auto">
          {[
            '1-day free trial, no credit card',
            '32+ pre-built AI skill templates',
            'WhatsApp & Telegram in 60 seconds',
            'Full conversation transparency',
          ].map((feat, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              <span className="text-white text-xs font-semibold">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="lg:w-[55%] flex flex-col items-center justify-center px-6 md:px-16 py-12 lg:py-0 flex-1">
        <div className="w-full max-w-md bg-white border border-zinc-200/50 rounded-2xl p-8 lg:p-10 shadow-sm text-left">
          
          {/* Logo / Branding Header */}
          <div className="flex items-center gap-2 mb-2">
            <Logo className="w-7 h-7" strokeColor="white" />
            <span className="text-xl font-bold text-gray-900 tracking-tight leading-none">
              Dudo
            </span>
          </div>

          <p className="text-gray-500 text-xs font-semibold mt-1 mb-6">
            Create your account
          </p>

          {/* Form Fields container (div-wrapped) */}
          <div className="space-y-4">
            
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Your full name"
                disabled={loading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50"
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@business.com"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 chars, letters + numbers"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-4 pr-10 border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold disabled:bg-zinc-50"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Message display block */}
            {errorMsg && (
              <div className="text-xs font-bold text-[#22577A] mt-1 text-center bg-[#FFF3E5] border border-[#EED9B4]/50 rounded-lg py-2 px-3">
                {errorMsg}
              </div>
            )}

            {/* Submit Action */}
            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full h-11 mt-2 bg-[#22577A] hover:bg-[#F3BE42] text-white rounded-lg font-bold text-xs cursor-pointer border-none flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Create Account"
              )}
            </button>

            {/* OR Divider */}
            <div className="flex items-center gap-3 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              <div className="flex-1 h-px bg-gray-150" />
              <span>OR</span>
              <div className="flex-1 h-px bg-gray-150" />
            </div>

            {/* Google Signup Trigger */}
            <button
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full h-11 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Bottom Login Redirect */}
            <div className="pt-2 text-center text-xs font-semibold text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-[#22577A] hover:underline font-bold no-underline">
                Sign in
              </Link>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full animate-bounce shrink-0" />
          <span className="text-sm text-zinc-500 font-semibold">Loading...</span>
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
