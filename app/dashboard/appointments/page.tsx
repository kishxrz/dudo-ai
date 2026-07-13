'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Search,
  MoreVertical,
  X,
  CalendarDays,
  Clock,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/useWorkspace';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { parseDateTime } from '@/lib/date-parser';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageLayout } from '@/components/ui/PageLayout';

// ─── Channel SVG Logos ────────────────────────────────────────────────────────

const WhatsAppLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#25D366" d="M12.004 2C6.48 2 2.002 6.477 2.002 12c0 1.892.522 3.66 1.43 5.176l-1.42 5.19 5.31-1.39A9.936 9.936 0 0 0 12.004 22c5.52 0 9.998-4.477 9.998-10s-4.478-10-9.998-10z" />
    <path fill="#FFFFFF" d="M8.391 7.308a.961.961 0 0 0-.371.1 1.293 1.293 0 0 0-.294.228c-.12.113-.188.211-.261.306A2.729 2.729 0 0 0 6.9 9.62c.002.49.13.967.33 1.413.409.902 1.082 1.857 1.971 2.742.214.213.423.427.648.626a9.448 9.448 0 0 0 3.84 2.046l.569.087c.185.01.37-.004.556-.013a1.99 1.99 0 0 0 .833-.231c.166-.088.244-.132.383-.22 0 0 .043-.028.125-.09.135-.1.218-.171.33-.288.083-.086.155-.187.21-.302.078-.163.156-.474.188-.733.024-.198.017-.306.014-.373-.004-.107-.093-.218-.19-.265l-.582-.261s-.87-.379-1.401-.621a.498.498 0 0 0-.177-.041.482.482 0 0 0-.378.127v-.002c-.005 0-.072.057-.795.933a.35.35 0 0 1-.368.13 1.416 1.416 0 0 1-.191-.066c-.124-.052-.167-.072-.252-.109l-.005-.002a6.01 6.01 0 0 1-1.57-1c-.126-.11-.243-.23-.363-.346a6.296 6.296 0 0 1-1.02-1.268l-.059-.095a.923.923 0 0 1-.102-.205c-.038-.147.061-.265.061-.265s.243-.266.356-.41a4.38 4.38 0 0 0 .263-.373c.118-.19.155-.385.093-.536-.28-.684-.57-1.365-.868-2.041-.059-.134-.234-.23-.393-.249-.054-.006-.108-.012-.162-.016a3.385 3.385 0 0 0-.403.004z" />
  </svg>
);

const TelegramLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#24A1DE" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" />
    <path fill="#FFFFFF" d="M12.3583 9.38244C11.3857 9.787 9.44177 10.6243 6.52657 11.8944C6.05318 12.0827 5.8052 12.2669 5.78263 12.4469C5.74448 12.7513 6.12559 12.8711 6.64455 13.0343C6.71515 13.0565 6.78829 13.0795 6.86327 13.1038C7.37385 13.2698 8.06068 13.464 8.41773 13.4717C8.74161 13.4787 9.1031 13.3452 9.50219 13.0711C12.226 11.2325 13.632 10.3032 13.7202 10.2831C13.7825 10.269 13.8688 10.2512 13.9273 10.3032C13.9858 10.3032 13.98 10.4536 13.9738 10.48C13.9361 10.641 12.4401 12.0318 11.6659 12.7515C11.4246 12.9759 11.2534 13.135 11.2184 13.1714C11.14 13.2528 11.0601 13.3298 10.9833 13.4038C10.509 13.8611 10.1532 14.204 11.003 14.764C11.4114 15.0331 11.7381 15.2556 12.0641 15.4776C12.4201 15.7201 12.7752 15.9619 13.2347 16.2631C13.3517 16.3398 13.4635 16.4195 13.5724 16.4971C13.9867 16.7925 14.3589 17.0579 14.8188 17.0155C15.086 16.991 15.362 16.7397 15.5022 15.9903C15.8335 14.2193 16.4847 10.382 16.6352 8.80081C16.6484 8.66228 16.6318 8.48498 16.6185 8.40715C16.6051 8.32932 16.5773 8.21842 16.4761 8.13633C16.3563 8.03911 16.1714 8.01861 16.0886 8.02C15.7125 8.0267 15.1354 8.22735 12.3583 9.38244Z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
  ];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type ApptStatus = 'today' | 'upcoming' | 'past';

function deriveStatus(appt: any): ApptStatus {
  try {
    const ts: Date = appt.timestamp instanceof Date ? appt.timestamp : new Date(appt.timestamp);
    const now = new Date();
    const apptDay = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (apptDay.getTime() === today.getTime()) return 'today';
    if (apptDay > today) return 'upcoming';
    return 'past';
  } catch {
    return 'past';
  }
}

function formatDate(raw: string, ts: Date): string {
  if (!raw) return ts.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  // already human-readable
  if (/[a-zA-Z]/.test(raw)) return raw;
  // try parsing
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { /* noop */ }
  return raw;
}

function formatTime(raw: string, ts: Date): string {
  if (!raw) return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return raw;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApptStatus }) {
  if (status === 'today') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#22577A] border border-[#22577A]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] shrink-0" />
        Today
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
      Past
    </span>
  );
}

// ─── Channel Badge ────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: string }) {
  const ch = channel.toLowerCase();
  if (ch === 'whatsapp') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]/50">
        <WhatsAppLogo className="w-3 h-3 shrink-0" />
        WhatsApp
      </span>
    );
  }
  if (ch === 'telegram') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9]/50">
        <TelegramLogo className="w-3 h-3 shrink-0" />
        Telegram
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 capitalize">
      {channel}
    </span>
  );
}

// ─── Details Modal ────────────────────────────────────────────────────────────

function DetailsModal({ appt, onClose }: { appt: any; onClose: () => void }) {
  const status = deriveStatus(appt);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#22577A]/10 flex items-center justify-center">
              <CalendarDays size={14} className="text-[#22577A]" />
            </div>
            <span className="text-sm font-bold text-zinc-900">Appointment Details</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer border-none bg-transparent"
          >
            <X size={14} />
          </button>
        </div>

        {/* Customer avatar + name */}
        <div className="flex flex-col items-center py-6 px-5 border-b border-zinc-100">
          <div className={cn('w-14 h-14 rounded-full flex items-center justify-center text-base font-bold mb-2', getAvatarColor(appt.customerName))}>
            {getInitials(appt.customerName)}
          </div>
          <p className="text-sm font-bold text-zinc-900">{appt.customerName}</p>
          <div className="mt-1.5">
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          <DetailLine icon={<CalendarDays size={13} className="text-zinc-400" />} label="Date" value={formatDate(appt.date, appt.timestamp)} />
          <DetailLine icon={<Clock size={13} className="text-zinc-400" />} label="Time" value={formatTime(appt.time, appt.timestamp)} />
          <DetailLine
            icon={<User size={13} className="text-zinc-400" />}
            label="Channel"
            value={<ChannelBadge channel={appt.channel} />}
          />
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-all cursor-pointer border-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 shrink-0">
        {icon}
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-right text-xs font-semibold text-zinc-700">{value}</div>
    </div>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────

function ActionMenu({ onViewDetails }: { onViewDetails: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer border-none bg-transparent"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-40 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onViewDetails(); }}
            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer border-none bg-transparent"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { workspaceId } = useWorkspace();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  // UI-only filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'telegram'>('all');
  const [detailAppt, setDetailAppt] = useState<any | null>(null);

  // ── Firebase fetch (unchanged) ─────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }

    async function checkPlanAndFetch() {
      setLoading(true);
      try {
        const { canUseFeature } = await import('@/lib/billing-entitlements');
        const allowed = await canUseFeature(workspaceId, 'booking');
        if (!allowed) {
          setIsLocked(true);
          setLoading(false);
          return;
        }
        setIsLocked(false);
        await fetchAppointments();
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }

    async function fetchAppointments() {
      try {
        const appts: any[] = [];

        try {
          const apptsCol = collection(db, 'workspaces', workspaceId, 'appointments');
          const apptsSnap = await getDocs(apptsCol);
          apptsSnap.forEach(doc => {
            const data = doc.data();
            appts.push({
              id: doc.id,
              customerName: data.customerName || data.customer?.name || 'Customer',
              date: data.date || '',
              time: data.time || '',
              channel: data.channel || 'unknown',
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
            });
          });
        } catch (e) {
          console.log('No appointments collection or query error:', e);
        }

        const convsCol = collection(db, 'workspaces', workspaceId, 'conversations');
        const convsSnap = await getDocs(convsCol);
        convsSnap.forEach(doc => {
          const data = doc.data();
          const userMsg = (data.userMessage || '').toLowerCase();
          if (userMsg.includes('appointment') || userMsg.includes('book') || userMsg.includes('schedule')) {
            const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now());
            const exists = appts.some(a => a.id === doc.id || (a.customerName === (data.customer?.name || 'Customer') && a.timestamp?.getTime() === timestamp.getTime()));
            if (!exists) {
              const { date, time } = parseDateTime(data.userMessage || '');
              appts.push({
                id: doc.id,
                customerName: data.customer?.name || 'Customer',
                date: date || timestamp.toLocaleDateString(),
                time: time || timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                channel: data.channel || 'unknown',
                timestamp,
              });
            }
          }
        });

        appts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setAppointments(appts);
      } catch (err) {
        console.error('Error fetching appointments:', err);
      } finally {
        setLoading(false);
      }
    }

    checkPlanAndFetch();
  }, [workspaceId]);

  // ── Stats (derived from all appointments) ──────────────────────────────────
  const total = appointments.length;
  const todayCount = appointments.filter(a => deriveStatus(a) === 'today').length;
  const upcomingCount = appointments.filter(a => deriveStatus(a) === 'upcoming').length;
  const pastCount = appointments.filter(a => deriveStatus(a) === 'past').length;

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = appointments.filter((appt) => {
    if (statusFilter !== 'all' && deriveStatus(appt) !== statusFilter) return false;
    if (channelFilter !== 'all' && appt.channel.toLowerCase() !== channelFilter) return false;
    if (search.trim()) {
      if (!(appt.customerName || '').toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout className="max-w-[1200px] w-full mx-auto px-6 py-6 flex items-center justify-center min-h-[400px]">
        <div className="w-5 h-5 rounded-full border-2 border-[#22577A] border-t-transparent animate-spin" />
      </PageLayout>
    );
  }

  if (isLocked) {
    return (
      <PageLayout className="max-w-[1200px] w-full mx-auto px-6 py-12 flex flex-col justify-center items-center min-h-[450px]">
        <div className="flex flex-col items-center justify-center text-center p-8 bg-white border border-zinc-200 rounded-2xl max-w-md shadow-sm gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-lg text-amber-500 font-bold">
            🔒
          </div>
          <h2 className="text-lg font-bold text-zinc-900 leading-none">Upgrade to Unlock Bookings</h2>
          <p className="text-xs text-zinc-500 leading-normal">
            Appointments, calendar synchronization, and booking intents are only available on the Monthly Plan or 6-Month Pack.
          </p>
          <Link href="/dashboard/billing" className="no-underline">
            <Button className="h-9 px-4.5 bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-xl text-xs border-none cursor-pointer">
              Go to Billing
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <div className="px-6 py-8 flex flex-col gap-6 max-w-5xl mx-auto w-full">

      {/* ── Page header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-zinc-200/70">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-[#22577A]" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950 leading-none">Appointments</h1>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-500">Bookings made by your AI across WhatsApp &amp; Telegram.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/schedule" className="no-underline">
            <Button className="h-8 px-3.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-semibold rounded-lg shadow-sm text-xs cursor-pointer transition-colors">
              View Schedule
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total', value: total },
            { label: 'Today', value: todayCount },
            { label: 'Upcoming', value: upcomingCount },
            { label: 'Past', value: pastCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-xl font-bold text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zinc-100">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-8 rounded-lg border border-zinc-200 focus:outline-none focus:border-[#22577A]/50 focus:ring-1 focus:ring-[#22577A]/20 text-xs font-medium text-zinc-800 placeholder:text-zinc-400 bg-zinc-50 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer p-0"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status segmented */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5">
            {(['all', 'today', 'upcoming', 'past'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border-none capitalize',
                  statusFilter === f
                    ? 'bg-white text-[#22577A] shadow-sm font-bold'
                    : 'text-zinc-500 bg-transparent hover:text-zinc-700'
                )}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Channel segmented */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5">
            {(['all', 'whatsapp', 'telegram'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border-none',
                  channelFilter === ch
                    ? 'bg-white text-[#22577A] shadow-sm font-bold'
                    : 'text-zinc-500 bg-transparent hover:text-zinc-700'
                )}
              >
                {ch === 'all' ? 'All Channels' : ch === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton rows={4} type="list" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-3">
              <Calendar size={20} className="text-zinc-400" />
            </div>
            <p className="text-sm font-bold text-zinc-700 mb-1">
              {appointments.length === 0 ? 'No appointments yet' : 'No results found'}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-[260px]">
              {appointments.length === 0
                ? 'When your AI books an appointment, it will show up here.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  {['Customer', 'Date', 'Time', 'Channel', 'Status', ''].map((col) => (
                    <th
                      key={col}
                      className="py-2.5 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((appt) => {
                  const status = deriveStatus(appt);
                  return (
                    <tr key={appt.id} className="hover:bg-zinc-50 transition-colors">
                      {/* Customer */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0', getAvatarColor(appt.customerName))}>
                            {getInitials(appt.customerName)}
                          </div>
                          <span className="font-semibold text-zinc-800 text-xs">{appt.customerName}</span>
                        </div>
                      </td>
                      {/* Date */}
                      <td className="py-3 px-4 text-zinc-600 font-medium whitespace-nowrap">
                        {formatDate(appt.date, appt.timestamp)}
                      </td>
                      {/* Time */}
                      <td className="py-3 px-4 text-zinc-600 font-medium whitespace-nowrap">
                        {formatTime(appt.time, appt.timestamp)}
                      </td>
                      {/* Channel */}
                      <td className="py-3 px-4">
                        <ChannelBadge channel={appt.channel} />
                      </td>
                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={status} />
                      </td>
                      {/* Actions */}
                      <td className="py-3 px-4">
                        <ActionMenu onViewDetails={() => setDetailAppt(appt)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details modal */}
      {detailAppt && (
        <DetailsModal appt={detailAppt} onClose={() => setDetailAppt(null)} />
      )}
    </div>
  );
}
