'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import SaveButton from '@/components/ui/SaveButton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, CreditCard, Bell, Building, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Toggle state trackers
  const [notifications, setNotifications] = useState([
    { id: 'lead', label: 'New hot lead detected', desc: 'Get alerted when AI identifies a high-intent customer', enabled: true },
    { id: 'appt', label: 'Appointment booked', desc: 'Notification when a customer books an appointment', enabled: true },
    { id: 'camp', label: 'Campaign completed', desc: 'Summary report when a campaign finishes', enabled: true },
    { id: 'help', label: 'Agent needs help', desc: 'When AI cannot handle a conversation and needs takeover', enabled: true },
    { id: 'weekly', label: 'Weekly performance report', desc: 'Summary of conversations, leads, and conversions', enabled: false },
  ]);

  // Database values tracker
  const [dbBusinessName, setDbBusinessName] = useState('');
  const [dbOwnerName, setDbOwnerName] = useState('');
  const [dbEmail, setDbEmail] = useState('');
  const [dbPhone, setDbPhone] = useState('');
  const [dbIndustry, setDbIndustry] = useState('');
  const [dbTimezone, setDbTimezone] = useState('Asia/Kolkata');
  const [dbNotifications, setDbNotifications] = useState([
    { id: 'lead', enabled: true },
    { id: 'appt', enabled: true },
    { id: 'camp', enabled: true },
    { id: 'help', enabled: true },
    { id: 'weekly', enabled: false },
  ]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!workspaceId) return;
      let bName = '';
      let oName = '';
      let eMail = currentUser?.email || '';
      let ph = '';
      let ind = '';
      let tz = 'Asia/Kolkata';
      let notifs = [
        { id: 'lead', enabled: true },
        { id: 'appt', enabled: true },
        { id: 'camp', enabled: true },
        { id: 'help', enabled: true },
        { id: 'weekly', enabled: false },
      ];

      // Auto-fill owner name from user's display name or email prefix if empty
      if (currentUser?.displayName) {
        oName = currentUser.displayName;
      } else if (currentUser?.email) {
        oName = currentUser.email.split('@')[0];
      }

      if (db) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'settings', 'profile');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            bName = data.businessName || bName;
            oName = data.ownerName || oName;
            eMail = data.email || eMail;
            ph = data.phone || ph;
            ind = data.industry || ind;
            tz = data.timezone || tz;
            if (data.notifications) {
              notifs = data.notifications;
            }
          }
        } catch (e) {
          console.error('Failed to load settings:', e);
        }
      }

      // Dev fallback from localStorage
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('__dudo_settings_profile');
        if (local) {
          try {
            const data = JSON.parse(local);
            bName = data.businessName || bName;
            oName = data.ownerName || oName;
            eMail = data.email || eMail;
            ph = data.phone || ph;
            ind = data.industry || ind;
            tz = data.timezone || tz;
            if (data.notifications) notifs = data.notifications;
          } catch {}
        }
      }

      setBusinessName(bName);
      setDbBusinessName(bName);
      setOwnerName(oName);
      setDbOwnerName(oName);
      setEmail(eMail);
      setDbEmail(eMail);
      setPhone(ph);
      setDbPhone(ph);
      setIndustry(ind);
      setDbIndustry(ind);
      setTimezone(tz);
      setDbTimezone(tz);
      
      setNotifications((prev) =>
        prev.map((n) => {
          const matched = notifs.find((x) => x.id === n.id);
          return matched ? { ...n, enabled: matched.enabled } : n;
        })
      );
      setDbNotifications(notifs);
      setLoading(false);
    }

    loadSettings();
  }, [workspaceId, currentUser]);

  // Computed Save state
  const saved = businessName === dbBusinessName &&
                ownerName === dbOwnerName &&
                email === dbEmail &&
                phone === dbPhone &&
                industry === dbIndustry &&
                timezone === dbTimezone &&
                notifications.every((n, idx) => n.enabled === (dbNotifications[idx]?.enabled ?? true));

  const handleSave = async () => {
    const payload = {
      businessName,
      ownerName,
      email,
      phone,
      industry,
      timezone,
      notifications: notifications.map(n => ({ id: n.id, enabled: n.enabled })),
    };

    if (workspaceId && db) {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'settings', 'profile');
        await setDoc(docRef, payload, { merge: true });
      } catch (e) {
        console.error('Failed to save settings:', e);
        throw e;
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('__dudo_settings_profile', JSON.stringify(payload));
      window.dispatchEvent(new Event('dudo-settings-changed'));
    }

    setDbBusinessName(businessName);
    setDbOwnerName(ownerName);
    setDbEmail(email);
    setDbPhone(phone);
    setDbIndustry(industry);
    setDbTimezone(timezone);
    setDbNotifications(notifications.map(n => ({ id: n.id, enabled: n.enabled })));
  };

  const toggleNotification = (index: number) => {
    setNotifications((prev) =>
      prev.map((n, idx) => (idx === index ? { ...n, enabled: !n.enabled } : n))
    );
  };

  if (loading) {
    return (
      <div className="max-w-[1250px] w-full mx-auto px-6 py-12 flex flex-col justify-center items-center min-h-[450px]">
        <LoadingSpinner size="lg" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-[1250px] w-full mx-auto px-6 py-8 space-y-7 box-border text-left select-none pb-16">
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/60 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-950 tracking-tight leading-none mb-1.5">
            Settings
          </h1>
          <p className="text-xs md:text-sm text-zinc-500 font-medium leading-relaxed max-w-2xl">
            Manage your account, business profile, notifications and subscription.
          </p>
        </div>

        <div className="shrink-0">
          <SaveButton
            onClick={handleSave}
            isDirty={!saved}
            label="Save Changes"
            successToastTitle="Workspace settings updated"
            successToastDescription="Your profile changes have been saved."
            className="h-9 px-4.5 rounded-xl text-xs font-bold shadow-sm"
          />
        </div>
      </div>

      {/* 2. Business Profile */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h2 className="text-base font-bold text-zinc-950 tracking-tight mb-0.5">
            Business Profile
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Your business information and account details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 pt-1">
          {[
            { label: 'Business Name', value: businessName, setter: setBusinessName, placeholder: 'Your Business Name' },
            { label: 'Owner Name', value: ownerName, setter: setOwnerName, placeholder: 'Your Name' },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'Your Email' },
            { label: 'Phone', value: phone, setter: setPhone, placeholder: 'Your Phone Number' },
            { label: 'Industry', value: industry, setter: setIndustry, placeholder: 'Your Industry' },
            { label: 'Timezone', value: timezone, setter: setTimezone, placeholder: 'Your Timezone' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} className="space-y-1.5">
              <Label className="text-[10.5px] font-bold text-zinc-600 uppercase tracking-wider block">
                {label}
              </Label>
              <Input 
                value={value} 
                onChange={e => setter(e.target.value)} 
                placeholder={placeholder}
                className="h-10 text-xs font-semibold text-zinc-950 bg-zinc-50/50 hover:bg-white border border-zinc-200/90 rounded-xl focus:border-[#22577A] focus:bg-white transition-all shadow-2xs px-3.5"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Notification Preferences */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h2 className="text-base font-bold text-zinc-950 tracking-tight mb-0.5">
            Notification Preferences
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Choose which events you want Dudo to notify you about.
          </p>
        </div>

        <div className="divide-y divide-zinc-150/80 pt-1">
          {notifications.map((n, index) => (
            <div 
              key={n.id} 
              className="flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1 hover:bg-zinc-50/60 px-3 -mx-3 rounded-xl transition-colors duration-150"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-zinc-950">{n.label}</div>
                <div className="text-[11.5px] text-zinc-500 font-medium leading-relaxed">{n.desc}</div>
              </div>
              <button 
                type="button"
                onClick={() => toggleNotification(index)}
                className={cn(
                  "w-11 h-6 rounded-full border-none cursor-pointer relative shrink-0 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#22577A]/20",
                  n.enabled ? "bg-[#22577A]" : "bg-zinc-250"
                )}
              >
                <div 
                  className={cn(
                    "w-4.5 h-4.5 rounded-full bg-white absolute top-0.75 transition-all duration-200 shadow-sm",
                    n.enabled ? "left-[22px]" : "left-0.75"
                  )} 
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Billing & Subscription */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-2xs space-y-5">
        <div>
          <h2 className="text-base font-bold text-zinc-950 tracking-tight mb-0.5">
            Billing & Subscription
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            Manage your plan, invoices and payment settings.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-zinc-950">Manage Billing</div>
            <div className="text-xs text-zinc-500 font-medium leading-relaxed">
              View your invoices, update payment methods, or upgrade your subscription plan.
            </div>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/billing')}
            className="h-9 px-4.5 bg-white hover:bg-zinc-50 text-zinc-800 font-bold border border-zinc-250 rounded-xl shadow-xs text-xs cursor-pointer transition-all hover:scale-[1.01] shrink-0"
          >
            Go to Billing Settings
          </Button>
        </div>
      </div>

      {/* 5. Danger Zone */}
      <div className="bg-red-50/40 border border-red-200/70 rounded-2xl p-6 space-y-4">
        <div className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Danger Zone
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-zinc-950">Delete Account</div>
            <div className="text-xs text-zinc-600 font-medium leading-relaxed">
              Permanently delete your account and all data. This cannot be undone.
            </div>
          </div>
          <Button 
            onClick={() => setShowDeleteModal(true)}
            className="h-9 px-4.5 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 font-bold border border-red-300 rounded-xl text-xs shadow-xs cursor-pointer transition-all hover:scale-[1.01] shrink-0"
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-2xl max-w-sm w-full relative z-10 flex flex-col gap-4 text-left select-none"
            >
              <h3 className="text-lg font-bold text-zinc-950">
                Delete Account?
              </h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                Permanently delete your account and all data. This cannot be undone. Please contact support or confirm below.
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  onClick={() => setShowDeleteModal(false)}
                  className="h-9 px-4.5 rounded-xl border border-zinc-250 bg-white text-zinc-800 font-extrabold hover:bg-zinc-50 text-xs shadow-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteModal(false);
                    toast.info('Account Deletion', 'Contact support to finalize full workspace removal.');
                  }}
                  className="h-9 px-4.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold border-none text-xs shadow-md shadow-red-600/10 cursor-pointer"
                >
                  Delete Account
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
