'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/SaveButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UserRound,
  Camera,
  Trash2,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  Key,
  Lock,
  X,
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import {
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { PageLayout } from '@/components/ui/PageLayout';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPasswordProvider(user: any): boolean {
  if (!user?.providerData) return false;
  return user.providerData.some((p: any) => p.providerId === 'password');
}

function getAuthProvider(user: any): string {
  if (!user?.providerData || user.providerData.length === 0) return 'Unknown';
  const id = user.providerData[0]?.providerId || '';
  if (id === 'google.com') return 'Google';
  if (id === 'password') return 'Email & Password';
  if (id === 'github.com') return 'GitHub';
  if (id === 'phone') return 'Phone';
  return id;
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[12px] font-semibold',
        type === 'success'
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-700'
      )}
    >
      {type === 'success' ? (
        <CheckCircle2 size={14} className="shrink-0" />
      ) : (
        <AlertCircle size={14} className="shrink-0" />
      )}
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="text-current opacity-60 hover:opacity-100 cursor-pointer ml-1"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmClassName,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6 max-w-sm w-full">
        <h3 className="text-[15px] font-bold text-zinc-900 mb-1.5">{title}</h3>
        <p className="text-[12px] text-zinc-500 leading-relaxed mb-5">{description}</p>
        <div className="flex justify-end gap-2">
          <Button
            onClick={onCancel}
            className="h-8 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-[12px] font-semibold cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={cn(
              'h-8 px-4 rounded-lg text-[12px] font-semibold cursor-pointer border-none',
              confirmClassName || 'bg-red-600 hover:bg-red-700 text-white'
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-zinc-200 rounded-xl shadow-sm p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4 pb-3 border-b border-zinc-100">
      <h2 className="text-[13px] font-bold text-zinc-800 leading-none">{title}</h2>
      {sub && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();

  const displayName =
    currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const displayEmail = currentUser?.email || '';

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAvatarUrl(localStorage.getItem('__dudo_user_avatar') || null);
    }
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      localStorage.setItem('__dudo_user_avatar', base64);
      setAvatarUrl(base64);
      window.dispatchEvent(new Event('dudo-avatar-changed'));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    localStorage.removeItem('__dudo_user_avatar');
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    window.dispatchEvent(new Event('dudo-avatar-changed'));
  };

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // ── Profile form ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(displayName);
  const [phone, setPhone] = useState('');
  const [dbFullName, setDbFullName] = useState('');
  const [dbPhone, setDbPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      let name = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
      let phoneNum = '';

      if (db && workspaceId) {
        try {
          const snap = await getDoc(doc(db, 'workspaces', workspaceId));
          if (snap.exists()) {
            const d = snap.data();
            name = d.fullName || d.name?.replace(' Workspace', '') || name;
            phoneNum = d.phone || '';
          }
        } catch {/* ignore */}
      }

      if (typeof window !== 'undefined') {
        const ln = localStorage.getItem('__dudo_user_fullname');
        if (ln) name = ln;
        const lp = localStorage.getItem('__dudo_user_phone');
        if (lp) phoneNum = lp;
      }

      setFullName(name);
      setDbFullName(name);
      setPhone(phoneNum);
      setDbPhone(phoneNum);
    }
    loadProfile();
  }, [workspaceId, currentUser]);

  // ── Toast state ───────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!workspaceId) return;
    try {
      if (db) {
        await setDoc(
          doc(db, 'workspaces', workspaceId),
          { fullName: fullName.trim(), phone: phone.trim() },
          { merge: true }
        );
      }
      if (currentUser) {
        await updateProfile(currentUser, { displayName: fullName.trim() });
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('__dudo_user_fullname', fullName.trim());
        localStorage.setItem('__dudo_user_phone', phone.trim());
        window.dispatchEvent(new Event('dudo-profile-changed'));
      }
      setDbFullName(fullName.trim());
      setDbPhone(phone.trim());
    } catch (e) {
      throw e;
    }
  };

  // ── Password change ───────────────────────────────────────────────────────
  const hasPasswordAuth = isPasswordProvider(currentUser);
  const [pwExpanded, setPwExpanded] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      showToast('error', 'All password fields are required.');
      throw new Error('All fields are required.');
    }
    if (newPw !== confirmPw) {
      showToast('error', 'New passwords do not match.');
      throw new Error('Passwords do not match.');
    }
    if (newPw.length < 6) {
      showToast('error', 'New password must be at least 6 characters.');
      throw new Error('Password too short.');
    }
    if (!currentUser?.email || !auth) {
      showToast('error', 'Cannot update password in this environment.');
      throw new Error('Invalid context.');
    }
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPw);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPw);
      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        await fetch(`${baseUrl}/api/email/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.uid,
            eventName: 'security_password_changed',
            payload: {
              email: currentUser.email || '',
              name: currentUser.displayName || 'User',
            }
          })
        });
      } catch (e) {}
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwExpanded(false);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        showToast('error', 'Current password is incorrect.');
      } else if (code === 'auth/weak-password') {
        showToast('error', 'Password is too weak. Use at least 6 characters.');
      } else {
        showToast('error', 'Failed to update password. Please try again.');
      }
      throw err;
    }
  };

  // ── Data export ────────────────────────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportData = async () => {
    if (!currentUser || !workspaceId) {
      showToast('error', 'Cannot export data — no user session found.');
      return;
    }
    setExportLoading(true);
    try {
      const exportPayload: Record<string, any> = {
        exportedAt: new Date().toISOString(),
        account: {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          emailVerified: currentUser.emailVerified,
          provider: getAuthProvider(currentUser),
          createdAt: currentUser.metadata?.creationTime || null,
          lastSignIn: currentUser.metadata?.lastSignInTime || null,
        },
      };

      if (db) {
        // Workspace doc
        try {
          const wsSnap = await getDoc(doc(db, 'workspaces', workspaceId));
          if (wsSnap.exists()) {
            const d = wsSnap.data();
            exportPayload.workspace = {
              name: d.name,
              fullName: d.fullName,
              phone: d.phone,
              createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || null,
            };
          }
        } catch {/* skip silently */}

        // Conversations (limit 200 for export size)
        try {
          const convSnap = await getDocs(
            query(collection(db, 'workspaces', workspaceId, 'conversations'), limit(200))
          );
          exportPayload.conversations = convSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              channel: data.channel,
              status: data.status,
              customerName: data.customer?.name,
              lastMessage: data.lastMessage,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            };
          });
        } catch {/* skip silently */}

        // Appointments
        try {
          const apptSnap = await getDocs(
            query(collection(db, 'workspaces', workspaceId, 'appointments'), limit(200))
          );
          exportPayload.appointments = apptSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title,
              status: data.status,
              customerName: data.customerName,
              scheduledAt: data.scheduledAt?.toDate?.()?.toISOString() || null,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            };
          });
        } catch {/* skip silently */}

        // Knowledge base (names + types only, no content)
        try {
          const knowSnap = await getDocs(
            query(collection(db, 'workspaces', workspaceId, 'knowledge'), limit(100))
          );
          exportPayload.knowledgeBase = knowSnap.docs.map((d) => ({
            id: d.id,
            name: d.data().name,
            type: d.data().type,
            status: d.data().status,
          }));
        } catch {/* skip silently */}

        // Channels (type + status only, no tokens/secrets)
        try {
          const chanSnap = await getDocs(
            collection(db, 'workspaces', workspaceId, 'channels')
          );
          exportPayload.channels = chanSnap.docs.map((d) => ({
            id: d.id,
            type: d.data().type,
            status: d.data().status,
          }));
        } catch {/* skip silently */}
      }

      // Trigger download
      const json = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dodo-account-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', 'Your data has been downloaded.');
    } catch {
      showToast('error', 'Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // ── Delete account ─────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      if (currentUser && auth) {
        await deleteUser(currentUser);
      }
      showToast('success', 'Account deleted. Redirecting…');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/requires-recent-login') {
        showToast(
          'error',
          'Please sign out and sign back in before deleting your account.'
        );
      } else {
        showToast('error', 'Account deletion requested. Please contact support to complete this action.');
      }
    }
  };

  // ── Plan badge ────────────────────────────────────────────────────────────
  const [planName, setPlanName] = useState<string | null>(null);
  useEffect(() => {
    async function loadPlan() {
      if (!db || !workspaceId) return;
      try {
        const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'billing', 'subscription'));
        if (snap.exists()) {
          setPlanName(snap.data()?.planName || null);
        }
      } catch {/* no billing doc yet */}
    }
    loadPlan();
  }, [workspaceId]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <PageLayout className="max-w-[1200px] w-full mx-auto gap-5 px-6 box-border">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200/50 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 mt-0.5">
            <UserRound size={20} className="text-[#22577A]" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-zinc-950 tracking-tight leading-none mb-1.5">
              Profile
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Manage your account, security, and data settings.
            </p>
          </div>
        </div>
      </div>

      {/* ── Global toast ─────────────────────────────────────────────────── */}
      {toast && (
        <Toast type={toast.type} message={toast.msg} onClose={() => setToast(null)} />
      )}

      {/* ── Account Header card ───────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full bg-[#22577A]/10 border-2 border-[#22577A]/20 flex items-center justify-center font-bold text-lg text-[#22577A] overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#22577A]/30"
              title="Change photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Camera size={16} className="text-white" />
              </div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[16px] font-bold text-zinc-900 leading-none">{fullName}</p>
              {planName && (
                <span className="bg-[#22577A] text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">
                  {planName}
                </span>
              )}
            </div>
            <p className="text-[12px] text-zinc-400 font-medium mt-0.5 [overflow-wrap:anywhere] [word-break:break-word] whitespace-normal">{displayEmail}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Sign-in via{' '}
              <span className="font-semibold text-zinc-600">{getAuthProvider(currentUser)}</span>
            </p>
          </div>

          {/* Avatar actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-[12px] font-semibold cursor-pointer"
            >
              Change Photo
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                onClick={handleRemoveAvatar}
                className="h-8 w-8 p-0 bg-white border border-red-200 text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center cursor-pointer"
                title="Remove photo"
              >
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── Personal Information ──────────────────────────────────────────── */}
      <Card>
        <SectionLabel title="Personal Information" sub="Update your name and contact details" />
        <form onSubmit={handleSaveProfile}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="full-name" className="text-[12px] font-semibold text-zinc-600">
                Full Name
              </Label>
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="h-9 text-[13px] border-zinc-200 font-medium text-zinc-800 bg-white placeholder:text-zinc-400 focus:ring-[#22577A]/30 focus:border-[#22577A]"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-semibold text-zinc-600">
                Email Address
                <span className="ml-1.5 text-[10px] font-medium text-zinc-400">(read-only)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={displayEmail}
                disabled
                className="h-9 text-[13px] border-zinc-200 bg-zinc-50 text-zinc-400 font-medium cursor-not-allowed"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-[12px] font-semibold text-zinc-600">
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
                className="h-9 text-[13px] border-zinc-200 font-medium text-zinc-800 bg-white placeholder:text-zinc-400 focus:ring-[#22577A]/30 focus:border-[#22577A]"
              />
            </div>
          </div>

          <div className="flex justify-end mt-5">
            <SaveButton
              onClick={handleSaveProfile}
              isDirty={fullName.trim() !== dbFullName.trim() || phone.trim() !== dbPhone.trim()}
              label="Save Changes"
              successToastTitle="Profile details updated"
              successToastDescription="Your changes have been saved."
              className="h-8 px-5 rounded-lg text-[12px]"
            />
          </div>
        </form>
      </Card>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel title="Security" sub="Manage your sign-in method and password" />

        {hasPasswordAuth ? (
          <div>
            {/* Compact row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  <Lock size={14} className="text-zinc-500" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-zinc-800">Password</p>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    Last changed: Not available
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setPwExpanded((v) => !v)}
                className="h-8 px-3.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-[12px] font-semibold cursor-pointer flex items-center gap-1.5"
              >
                Change Password
                {pwExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </Button>
            </div>

            {/* Expandable inline form */}
            {pwExpanded && (
              <form
                onSubmit={handleChangePassword}
                className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="cur-pw" className="text-[12px] font-semibold text-zinc-600">
                    Current Password
                  </Label>
                  <Input
                    id="cur-pw"
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-[13px] border-zinc-200 bg-white placeholder:text-zinc-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw" className="text-[12px] font-semibold text-zinc-600">
                    New Password
                  </Label>
                  <Input
                    id="new-pw"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-9 text-[13px] border-zinc-200 bg-white placeholder:text-zinc-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conf-pw" className="text-[12px] font-semibold text-zinc-600">
                    Confirm New Password
                  </Label>
                  <Input
                    id="conf-pw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-[13px] border-zinc-200 bg-white placeholder:text-zinc-300"
                  />
                </div>
                <div className="md:col-span-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setPwExpanded(false);
                      setCurrentPw('');
                      setNewPw('');
                      setConfirmPw('');
                    }}
                    className="h-8 px-3.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-[12px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <SaveButton
                    onClick={handleChangePassword}
                    isDirty={currentPw.trim() !== '' && newPw.trim() !== '' && confirmPw.trim() !== ''}
                    label="Update Password"
                    successToastTitle="Password changed"
                    successToastDescription="Your password has been updated successfully."
                    className="h-8 px-4 rounded-lg text-[12px]"
                  />
                </div>
              </form>
            )}
          </div>
        ) : (
          /* OAuth provider — no password form */
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Shield size={14} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-800">
                Signed in via {getAuthProvider(currentUser)}
              </p>
              <p className="text-[11px] text-zinc-400 font-medium">
                Password management is handled by your sign-in provider. To change your
                password, visit your {getAuthProvider(currentUser)} account settings.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Data & Privacy ───────────────────────────────────────────────── */}
      <Card>
        <SectionLabel title="Data & Privacy" sub="Download a copy of your account data" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
              <Download size={14} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-800">Download My Data</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed max-w-lg">
                Export a copy of your profile, workspace settings, conversations, appointments,
                and knowledge base metadata as a JSON file. Passwords, API keys, and tokens are
                never included.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleExportData}
            disabled={exportLoading}
            className="h-8 px-4 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-[12px] font-semibold cursor-pointer shrink-0 flex items-center gap-2 disabled:opacity-60"
          >
            {exportLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            {exportLoading ? 'Exporting…' : 'Download My Data'}
          </Button>
        </div>
      </Card>

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <div className="border border-red-200/80 bg-red-50/70 rounded-xl p-5">
        <p className="text-[12px] font-extrabold text-red-700 uppercase tracking-wide mb-3">
          Danger Zone
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-zinc-800">Delete Account</p>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="h-8 px-4 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-[12px] font-semibold cursor-pointer shrink-0 transition-all"
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* ── Delete confirm dialog ─────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete your account?"
          description="This action is permanent and cannot be undone. Your account, workspace, conversations, and all associated data will be permanently deleted."
          confirmLabel="Yes, Delete Account"
          confirmClassName="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

    </PageLayout>
  );
}
