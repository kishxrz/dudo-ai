'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormSection } from '@/components/ui/FormSection';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function SettingsPage() {
  const [businessName, setBusinessName] = useState('Sharma Electronics');
  const [ownerName, setOwnerName] = useState('Suresh Kumar Sharma');
  const [email, setEmail] = useState('suresh@sharmaelectronics.in');
  const [phone, setPhone] = useState('+91-98765-43210');
  const [industry, setIndustry] = useState('Electronics Retail');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [saved, setSaved] = useState(false);

  // Toggle state trackers
  const [notifications, setNotifications] = useState([
    { id: 'lead', label: 'New hot lead detected', desc: 'Get alerted when AI identifies a high-intent customer', enabled: true },
    { id: 'appt', label: 'Appointment booked', desc: 'Notification when a customer books an appointment', enabled: true },
    { id: 'camp', label: 'Campaign completed', desc: 'Summary report when a campaign finishes', enabled: true },
    { id: 'help', label: 'Agent needs help', desc: 'When AI cannot handle a conversation and needs takeover', enabled: true },
    { id: 'weekly', label: 'Weekly performance report', desc: 'Summary of conversations, leads, and conversions', enabled: false },
  ]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleNotification = (index: number) => {
    setNotifications((prev) =>
      prev.map((n, idx) => (idx === index ? { ...n, enabled: !n.enabled } : n))
    );
  };

  return (
    <PageLayout className="max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your account and business profile"
        breadcrumbs={[{ label: 'Settings' }]}
        actions={
          <Button 
            onClick={handleSave} 
            className="h-8.5 px-4 bg-gradient-to-r from-[#DBA11A] to-[#F3BE42] hover:from-[#C59013] hover:to-[#E5B134] text-white font-bold rounded-xl shadow-md shadow-[#DBA11A]/10 text-xs cursor-pointer flex items-center gap-1.5 border-none transition-all hover:scale-[1.01]"
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
            { label: 'Business Name', value: businessName, setter: setBusinessName },
            { label: 'Owner Name', value: ownerName, setter: setOwnerName },
            { label: 'Email', value: email, setter: setEmail },
            { label: 'Phone', value: phone, setter: setPhone },
            { label: 'Industry', value: industry, setter: setIndustry },
            { label: 'Timezone', value: timezone, setter: setTimezone },
          ].map(({ label, value, setter }) => (
            <div key={label} className="space-y-1">
              <Label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wide">{label}</Label>
              <Input 
                value={value} 
                onChange={e => setter(e.target.value)} 
                className="h-9 text-xs border-zinc-200 bg-white font-semibold rounded-xl"
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
