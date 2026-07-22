'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Logo from '@/components/ui/logo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      if (auth) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        console.log('Firebase auth fallback mock login');
      }
      router.push('/dashboard');
    } catch (e: any) {
      console.error(e);
      const code = e?.code || '';
      if (code === 'auth/user-not-found') {
        setErrorMsg('No account found with this email');
      } else if (code === 'auth/wrong-password') {
        setErrorMsg('Incorrect password');
      } else if (code === 'auth/invalid-credential') {
        setErrorMsg('Invalid email or password');
      } else {
        setErrorMsg(e?.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      if (auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
      } else {
        console.log('Firebase auth fallback mock Google login');
      }
      router.push('/dashboard');
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full font-sans antialiased bg-[#FFF8F0] select-none">
      
      {/* LEFT PANEL */}
      <div className="lg:w-[45%] bg-[#22577A] flex flex-col items-center justify-center text-white px-8 lg:px-12 py-10 lg:py-0 text-center min-h-[280px] lg:min-h-screen">
        <Logo className="w-20 h-20" strokeColor="#22577A" />
        <h1 className="text-3xl lg:text-4xl font-extrabold text-white mt-6 tracking-tight">
          Welcome back
        </h1>
        <p className="text-white/80 text-sm mt-3 max-w-xs leading-relaxed font-semibold">
          Your AI agents are waiting. Sign in to manage your business automation.
        </p>
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

          <p className="text-gray-500 text-xs font-semibold mt-1 mb-8">
            Sign in to your account
          </p>

          {/* Form Fields container (div-wrapped) */}
          <div className="space-y-4">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@business.com"
                value={email}
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-4 pr-10 border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22577A] focus:border-transparent transition text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
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

            {/* Submit Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-11 mt-2 bg-[#22577A] hover:bg-[#F3BE42] text-white rounded-lg font-bold text-xs cursor-pointer border-none flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>

            {/* OR Divider */}
            <div className="flex items-center gap-3 py-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              <div className="flex-1 h-px bg-gray-150" />
              <span>OR</span>
              <div className="flex-1 h-px bg-gray-150" />
            </div>

            {/* Google Login Trigger */}
            <button
              onClick={handleGoogleSignIn}
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

            {/* Bottom Register Redirect */}
            <div className="pt-2 text-center text-xs font-semibold text-gray-500">
              Don't have an account?{' '}
              <Link href="/signup" className="text-[#22577A] hover:underline font-bold no-underline">
                Start free trial
              </Link>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
