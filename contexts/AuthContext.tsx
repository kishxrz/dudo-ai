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
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USER = {
  uid: 'dev-user-id',
  email: 'dev@dudo.com',
  displayName: 'Dev User',
  photoURL: null,
  emailVerified: true,
  metadata: {},
  providerId: 'firebase',
} as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setCurrentUser(MOCK_USER);
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
    if (!auth) { setCurrentUser(MOCK_USER); return; }
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await ensureWorkspace(user.uid, user.displayName);
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!auth) { setCurrentUser(MOCK_USER); return; }
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    await ensureWorkspace(user.uid, name);
  };

  const signOut = async () => {
    if (!auth) { setCurrentUser(null); return; }
    await firebaseSignOut(auth);
  };

  const signInWithGoogle = async () => {
    if (!auth) { setCurrentUser(MOCK_USER); return; }
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureWorkspace(user.uid, user.displayName);
  };

  const resetPassword = async (email: string) => {
    if (!auth) return;
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
