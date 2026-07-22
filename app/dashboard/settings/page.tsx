'use client';

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();
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
      <PageLayout className="max-w-4xl">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full animate-bounce shrink-0" />
            <span className="text-sm text-zinc-500 font-semibold">Loading settings...</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your account and business profile"
        breadcrumbs={[{ label: 'Settings' }]}
        actions={
          <Button 
            onClick={handleSave} 
            className="h-8.5 px-4 bg-[#22577A] hover:bg-[#1C4662] text-white font-bold rounded-xl shadow-md shadow-[#22577A]/10 text-xs cursor-pointer flex items-center gap-1.5 border-none transition-all hover:scale-[1.01]"
          >
            <Save size={13} /> {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        }
      />

      {/* Business Profile */}
      <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm space-y-4 text-left select-none">
        <SectionHeader title="Business Profile" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Business Name', value: businessName, setter: setBusinessName, placeholder: 'Your Business Name' },
            { label: 'Owner Name', value: ownerName, setter: setOwnerName, placeholder: 'Your Name' },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'Your Email' },
            { label: 'Phone', value: phone, setter: setPhone, placeholder: 'Your Phone Number' },
            { label: 'Industry', value: industry, setter: setIndustry, placeholder: 'Your Industry' },
            { label: 'Timezone', value: timezone, setter: setTimezone, placeholder: 'Your Timezone' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} className="space-y-1">
              <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">{label}</Label>
              <Input 
                value={value} 
                onChange={e => setter(e.target.value)} 
                placeholder={placeholder}
                className="h-9 text-xs border-zinc-200 bg-white font-semibold rounded-xl text-zinc-800"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm space-y-4 text-left select-none">
        <SectionHeader title="Notification Preferences" />
        <div className="flex flex-col gap-4">
          {notifications.map((n, index) => (
            <div key={n.id} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-zinc-800">{n.label}</div>
                <div className="text-[11px] text-zinc-500 font-semibold mt-0.5">{n.desc}</div>
              </div>
              <button 
                onClick={() => toggleNotification(index)}
                className={cn(
                  "w-10 h-[22px] rounded-full border-none cursor-pointer relative flex-shrink-0 transition-colors duration-200",
                  n.enabled ? "bg-[#22577A]" : "bg-zinc-200"
                )}
              >
                <div 
                  className={cn(
                    "w-[16px] h-[16px] rounded-full bg-white absolute top-[3px] transition-all duration-200 shadow-sm",
                    n.enabled ? "left-[21px]" : "left-[3px]"
                  )} 
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing & Subscription Quick Link */}
      <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm space-y-4 text-left select-none">
        <SectionHeader title="Billing & Subscription" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-zinc-800">Manage Billing</div>
            <div className="text-[11px] text-zinc-500 font-semibold mt-0.5">View your invoices, update payment methods, or upgrade your subscription plan.</div>
          </div>
          <Button 
            onClick={() => window.location.href = '/dashboard/settings/billing'}
            className="h-8.5 px-4 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-bold rounded-xl shadow-sm text-xs cursor-pointer"
          >
            Go to Billing Settings
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#FFF3E5]/20 border border-[#EED9B4] rounded-[20px] p-5 text-left select-none">
        <div className="text-xs font-extrabold text-[#8B1A1A] uppercase tracking-wider mb-2">Danger Zone</div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-zinc-800">Delete Account</div>
            <div className="text-[11px] text-zinc-500 font-semibold mt-0.5">Permanently delete your account and all data. This cannot be undone.</div>
          </div>
          <Button 
            className="h-8.5 px-4 bg-white hover:bg-[#FFF3E5]/50 border border-[#EED9B4] text-[#8B1A1A] font-bold rounded-xl shadow-sm text-xs cursor-pointer"
          >
            Delete Account
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
