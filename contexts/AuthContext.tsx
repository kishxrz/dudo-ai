'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureWorkspace } from '@/lib/workspace';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, businessName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure workspace exists every time user signs in
        await ensureWorkspace(user.uid, user.displayName);
      }
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await ensureWorkspace(user.uid, user.displayName);
  };

  const signUp = async (email: string, password: string, name: string, businessName?: string) => {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await ensureWorkspace(user.uid, name, businessName);
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('__dudo_user_fullname');
        localStorage.removeItem('__dudo_user_avatar');
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed to clear session storage during signout:', e);
      }
    }
    if (!auth) { 
      setCurrentUser(null); 
      return; 
    }
    await firebaseSignOut(auth);
    setCurrentUser(null);
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const { user } = await signInWithPopup(auth, provider);
    await ensureWorkspace(user.uid, user.displayName);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth is not initialized');
    await sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider value={{
      currentUser, loading,
      signIn, signUp, signOut, signInWithGoogle, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
