'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function PreferencesForm() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const signatureParam = searchParams.get('signature') || '';

  const [email, setEmail] = useState(emailParam);
  const [signature, setSignature] = useState(signatureParam);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unsubscribedAll, setUnsubscribedAll] = useState(false);

  const [preferences, setPreferences] = useState({
    productUpdates: true,
    newsletter: true,
    weeklyEducation: true,
    marketingEmails: true,
    featureReleases: true,
  });

  useEffect(() => {
    if (!email || !signature) {
      setError('Missing verification link details. Please click the unsubscribe link directly from your email.');
      setLoading(false);
      return;
    }

    async function loadPrefs() {
      try {
        const res = await fetch(`/api/email/preferences?email=${encodeURIComponent(email)}&signature=${signature}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch preferences');
        }
        setPreferences(data.preferences);
        if (data.isSuppressed) {
          setUnsubscribedAll(true);
        }
      } catch (err: any) {
        setError(err.message || 'Verification token is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    }

    loadPrefs();
  }, [email, signature]);

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          signature,
          preferences,
          unsubscribeAll: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSuccess('Your subscription preferences have been updated successfully.');
      setUnsubscribedAll(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/email/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          signature,
          unsubscribeAll: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unsubscribe failed');
      setSuccess('You have been unsubscribed from all promotional and newsletter updates.');
      setUnsubscribedAll(true);
      setPreferences({
        productUpdates: false,
        newsletter: false,
        weeklyEducation: false,
        marketingEmails: false,
        featureReleases: false,
      });
    } catch (err: any) {
      setError(err.message || 'Unsubscribe request failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[300px]">
        <LoadingSpinner size="md" text="Verifying token security..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-lg font-medium leading-relaxed">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3.5 rounded-lg font-medium leading-relaxed">
          ✓ {success}
        </div>
      )}

      {!error && (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="text-zinc-400 text-xs font-semibold select-none">
            Managing subscription settings for: <span className="text-zinc-200 font-bold block mt-1 select-all">{email}</span>
          </div>

          <div className="divide-y divide-zinc-800 border-y border-zinc-800 py-2 select-none">
            {/* Product Updates */}
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-100 block">Product Updates</span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Stay informed about monthly changelogs, bug fixes, and improvements.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.productUpdates}
                onChange={() => handleToggle('productUpdates')}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#22577A] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            {/* Newsletter */}
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-100 block">Weekly AI Newsletter</span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Every Thursday digest of prompt templates, tools, and business automation tips.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.newsletter}
                onChange={() => handleToggle('newsletter')}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#22577A] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            {/* Weekly Education */}
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-100 block">Weekly Educational Guides</span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Technical tips on structuring XML rules, vector database RAG, and agent tuning.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.weeklyEducation}
                onChange={() => handleToggle('weeklyEducation')}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#22577A] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            {/* Marketing Emails */}
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-100 block">Marketing & Onboarding Alerts</span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Tips during setup, connecting channels, trial countdowns, and discount alerts.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketingEmails}
                onChange={() => handleToggle('marketingEmails')}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#22577A] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            {/* Feature Releases */}
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="text-xs font-bold text-zinc-100 block">Major Feature Launches</span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Announcements of new vector integrations, tools, and visual editors.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.featureReleases}
                onChange={() => handleToggle('featureReleases')}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#22577A] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            {/* Non-configurable system options */}
            <div className="flex items-center justify-between py-3 opacity-60">
              <div>
                <span className="text-xs font-bold text-zinc-100 block flex items-center gap-1.5">
                  Security Alerts <span className="text-[9px] font-extrabold uppercase bg-zinc-800 text-zinc-400 px-1 rounded">Required</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Critical notifications about unauthorized takeover attempts or rate limit lockouts.</span>
              </div>
              <input
                type="checkbox"
                checked={true}
                disabled
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-500 focus:ring-0 cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-between py-3 opacity-60">
              <div>
                <span className="text-xs font-bold text-zinc-100 block flex items-center gap-1.5">
                  Billing & Invoice Receipts <span className="text-[9px] font-extrabold uppercase bg-zinc-800 text-zinc-400 px-1 rounded">Required</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-semibold block mt-0.5">Invoice receipts, payment failure warnings, and subscription renewal alerts.</span>
              </div>
              <input
                type="checkbox"
                checked={true}
                disabled
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-500 focus:ring-0 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || unsubscribedAll}
              className="flex-1 h-9 rounded-lg font-bold text-xs bg-[#22577A] text-white hover:bg-[#22577A]/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-white/5"
            >
              {saving ? 'Updating...' : 'Save Subscription Settings'}
            </button>
            <button
              type="button"
              onClick={handleUnsubscribeAll}
              disabled={saving}
              className="flex-1 h-9 rounded-lg font-bold text-xs border border-red-500/20 text-red-400 hover:bg-red-500/5 disabled:opacity-50 transition-all"
            >
              {unsubscribedAll ? 'Unsubscribed' : 'Unsubscribe from All'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F4F4F5] flex flex-col justify-between items-center p-6">
      {/* Spacer top */}
      <div />

      <main className="w-full max-w-md bg-[#131622] border border-[#222638] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Glowing top line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#22577A] to-transparent" />
        
        <header className="text-center pb-5 border-b border-zinc-800 select-none">
          <span className="inline-block bg-[#22577A] text-white text-[11px] font-black tracking-wider px-2 py-0.5 rounded-md uppercase">
            DUDO
          </span>
          <h2 className="text-base font-black text-zinc-100 mt-2.5">Email Preferences</h2>
          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">Manage which automated updates reach your inbox</p>
        </header>

        <div className="pt-5">
          <Suspense fallback={
            <div className="flex justify-center items-center min-h-[200px]">
              <LoadingSpinner size="md" text="Loading settings..." />
            </div>
          }>
            <PreferencesForm />
          </Suspense>
        </div>
      </main>

      <footer className="text-center text-[10px] text-zinc-600 select-none">
        &copy; {new Date().getFullYear()} Dudo Technologies Inc. · All rights reserved.
      </footer>
    </div>
  );
}
