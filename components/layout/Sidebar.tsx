'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Calendar,
  BookOpen,
  GraduationCap,
  Puzzle,
  Clock,
  ScrollText,
  FileText,
  CreditCard,
  Settings,
  MessageCircle,
  Bug,
  LogOut,
  X,
  Send,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import Logo from '@/components/ui/logo';

const mainNavItems = [
  { href: '/dashboard',               label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/dashboard/conversations', label: 'Conversations',     icon: MessageSquare },
  { href: '/dashboard/appointments',  label: 'Appointments',      icon: Calendar },
  { href: '/dashboard/knowledge',     label: 'Knowledge Base',    icon: BookOpen },
  { href: '/dashboard/learning',      label: 'Learning',          icon: GraduationCap },
  { href: '/dashboard/integration',   label: 'Integrations',      icon: Puzzle },
  { href: '/dashboard/analytics',     label: 'Analytics',         icon: BarChart3 },
  { href: '/dashboard/schedule',      label: 'Schedules',         icon: Clock },
  { href: '/dashboard/logs',          label: 'Logs',              icon: ScrollText },
  { href: '/dashboard/documentation', label: 'Documentation',     icon: FileText },
  { href: '/dashboard/billing',       label: 'Billing',           icon: CreditCard },
  { href: '/dashboard/agent',         label: 'Agent Config',      icon: Settings },
];

const secondaryNavItems = [
  { href: '/dashboard/talk-to-dudo',  label: 'Talk to Dudo',      icon: MessageCircle },
  { href: '/dashboard/report-bug',    label: 'Contact / Report a Bug', icon: Bug },
];

export default function Sidebar({
  onExpandedChange,
  mobileOpen = false,
  onMobileClose,
}: {
  onExpandedChange?: (expanded: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadAvatar = () => {
        setAvatarUrl(localStorage.getItem('__dudo_user_avatar') || null);
      };
      loadAvatar();
      window.addEventListener('dudo-avatar-changed', loadAvatar);
      return () => window.removeEventListener('dudo-avatar-changed', loadAvatar);
    }
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Form states
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Rahul Khanna';
  const displayEmail = currentUser?.email || 'rahul.khanna@dudo.com';

  const [profileName, setProfileName] = useState(displayName);

  useEffect(() => {
    const loadProfileName = () => {
      let pName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
      if (typeof window !== 'undefined') {
        const localName = localStorage.getItem('__dudo_user_fullname');
        if (localName) pName = localName;
      }
      setProfileName(pName);
    };
    loadProfileName();
    window.addEventListener('dudo-profile-changed', loadProfileName);
    return () => {
      window.removeEventListener('dudo-profile-changed', loadProfileName);
    };
  }, [currentUser, displayName]);
  
  const [bugName, setBugName] = useState('');
  const [bugEmail, setBugEmail] = useState('');
  const [bugPhone, setBugPhone] = useState('');
  const [bugMessage, setBugMessage] = useState('');
  const [bugSubmitted, setBugSubmitted] = useState(false);
  const [bugLoading, setBugLoading] = useState(false);



  useEffect(() => {
    if (!showProfilePopup) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#profile-popup-container') && !target.closest('#profile-popup-menu')) {
        setShowProfilePopup(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showProfilePopup]);

  const [isClickClosed, setIsClickClosed] = useState(false);

  const updateExpanded = (value: boolean) => {
    setExpanded(value);
    onExpandedChange?.(value);
  };

  const handleMouseEnter = () => {
    if (!isClickClosed) {
      updateExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    setIsClickClosed(false);
    updateExpanded(false);
  };

  const handleLinkClick = () => {
    onMobileClose?.();
    setIsClickClosed(true);
    updateExpanded(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugName.trim() || !bugEmail.trim() || !bugMessage.trim()) {
      alert("Please fill in Name, Email, and Message.");
      return;
    }
    setBugLoading(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: bugName,
          email: bugEmail,
          phone: bugPhone,
          message: bugMessage,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send support message.');
      }

      setBugSubmitted(true);
      setTimeout(() => {
        setBugSubmitted(false);
        setShowBugModal(false);
        setBugMessage('');
        setBugPhone('');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while sending your message. Please try again.');
    } finally {
      setBugLoading(false);
    }
  };

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col h-[100dvh] bg-white border-r border-zinc-200 select-none overflow-hidden group",
          "transition-all duration-200 ease-in-out",
          "w-[240px] md:w-[60px]",
          expanded ? "md:w-[240px]" : "md:w-[60px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand Logo Header */}
        <div className="h-14 flex items-center shrink-0 border-b border-zinc-100">
          <Link
            href="/"
            onClick={handleLinkClick}
            className={cn(
              'no-underline flex items-center w-full transition-all duration-150',
              'gap-2 px-4 justify-start',
              expanded 
                ? 'md:gap-2 md:px-4 md:justify-start'
                : 'md:justify-center md:px-0'
            )}
          >
            <Logo className="w-[26px] h-[26px] shrink-0" strokeColor="white" />
            <span
              className={cn(
                'text-[19px] font-black text-zinc-950 tracking-tight leading-none whitespace-nowrap transition-all duration-150',
                'w-auto opacity-100',
                expanded
                  ? 'md:w-auto md:opacity-100'
                  : 'md:w-0 md:opacity-0'
              )}
            >
              Dudo
            </span>
          </Link>
        </div>

        {/* Navigation items list */}
        <div className="flex-1 overflow-hidden pt-13 pb-2 px-2 flex flex-col justify-between">
          <nav className="flex flex-col gap-1.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

              return (
                <Link key={item.href} href={item.href} onClick={handleLinkClick} className="no-underline">
                  <div
                    className={cn(
                      'flex items-center w-full transition-all duration-150 select-none cursor-pointer rounded-r-xl py-1',
                      'gap-2.5 px-3 justify-start',
                      expanded
                        ? 'md:gap-2.5 md:px-3 md:justify-start'
                        : 'md:justify-center md:px-0 md:gap-0',
                      isActive
                        ? 'bg-[#FFF3E5] text-[#22577A] border-[#DBA11A] border-l-2 font-medium'
                        : 'text-zinc-700 border-l-2 border-transparent hover:bg-zinc-50 hover:text-zinc-900 font-normal'
                    )}
                  >
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Icon size={16} className={cn(isActive ? 'text-[#22577A]' : 'text-zinc-400')} />
                    </span>
                    <span
                      className={cn(
                        'text-[15px] tracking-tight whitespace-nowrap leading-none transition-all duration-150',
                        'w-auto opacity-100',
                        expanded
                          ? 'md:w-auto md:opacity-100'
                          : 'md:w-0 md:opacity-0'
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-1.5">
            {/* Divider */}
            <div className="border-t border-zinc-200 my-2 mx-2" />

            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              const isTalkToDudo = item.href === '/dashboard/talk-to-dudo';
              const isReportBug = item.href === '/dashboard/report-bug';

              const handleClick = (e: React.MouseEvent) => {
                handleLinkClick();
                if (isTalkToDudo) {
                  e.preventDefault();
                  window.open('https://api.whatsapp.com/send/?phone=916374385901&text=Hi+Dudo+support%2C+I+need+help+with&type=phone_number&app_absent=0', '_blank');
                } else if (isReportBug) {
                  e.preventDefault();
                  setBugName(profileName && profileName !== 'Rahul Khanna' && profileName !== 'User' ? profileName : displayName);
                  setBugEmail(displayEmail && displayEmail !== 'rahul.khanna@dudo.com' ? displayEmail : (currentUser?.email || ''));
                  setShowBugModal(true);
                }
              };

              return (
                <Link key={item.href} href={item.href} onClick={handleClick} className="no-underline">
                  <div
                    className={cn(
                      'flex items-center w-full transition-all duration-150 select-none cursor-pointer rounded-r-xl py-1',
                      'gap-2.5 px-3 justify-start',
                      expanded
                        ? 'md:gap-2.5 md:px-3 md:justify-start'
                        : 'md:justify-center md:px-0 md:gap-0',
                      isActive
                        ? 'bg-[#EED9B4] text-[#22577A] border-[#DBA11A] border-l-2 font-medium'
                        : 'text-zinc-700 border-l-2 border-transparent hover:bg-zinc-50 hover:text-zinc-900 font-normal'
                    )}
                  >
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      {isTalkToDudo ? (
                        <Icon size={16} className="text-emerald-600" />
                      ) : (
                        <Icon size={16} className={cn(isActive ? 'text-[#22577A]' : 'text-zinc-400')} />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-[15px] tracking-tight whitespace-nowrap leading-none transition-all duration-150',
                        'w-auto opacity-100',
                        expanded
                          ? 'md:w-auto md:opacity-100'
                          : 'md:w-0 md:opacity-0'
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom user profile & actions info */}
        <div id="profile-popup-container" className="border-t border-zinc-150 p-1.5 shrink-0 bg-white">
          {/* Clickable Profile Avatar Button */}
          <button
            onClick={() => setShowProfilePopup(!showProfilePopup)}
            className={cn(
              'flex items-center w-full rounded-xl transition-all duration-150 bg-transparent border-none cursor-pointer text-left hover:bg-zinc-50',
              'gap-2.5 px-3 py-1 justify-start',
              expanded
                ? 'md:gap-2.5 md:px-3 md:py-1 md:justify-start'
                : 'md:justify-center md:py-1 md:px-0 md:gap-0'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-[#EED9B4] text-[#22577A] flex items-center justify-center font-black text-[10px] shrink-0 border border-[#22577A]/20 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div
              className={cn(
                'min-w-0 overflow-hidden text-left transition-all duration-150',
                'w-auto opacity-100',
                expanded
                  ? 'md:w-auto md:opacity-100'
                  : 'md:w-0 md:opacity-0'
              )}
            >
              <div className="text-[11px] font-black text-zinc-900 truncate leading-none mb-0.5">{profileName}</div>
              <div className="text-[9px] text-zinc-400 truncate leading-none font-semibold">{displayEmail}</div>
            </div>
          </button>
        </div>
      </aside>

      {/* Popup Menu Card */}
      <div
        id="profile-popup-menu"
        className={cn(
          "fixed bottom-[60px] bg-white border border-zinc-150 rounded-2xl shadow-2xl z-[9999] p-3 select-none flex flex-col gap-2.5 origin-bottom-left",
          "transition-all duration-200 ease-in-out",
          "left-3 w-[216px]",
          expanded
            ? "md:left-[252px] md:w-[224px]"
            : "md:left-[72px] md:w-[224px]",
          showProfilePopup
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-2 scale-95 pointer-events-none"
        )}
      >
        {/* User details header link to profile */}
        <Link
          href="/dashboard/profile"
          onClick={() => {
            setShowProfilePopup(false);
            onMobileClose?.();
          }}
          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-zinc-50 transition-colors no-underline text-left cursor-pointer"
          title="View/Edit Profile"
        >
          <div className="w-8 h-8 rounded-full bg-[#22577A]/10 text-[#22577A] flex items-center justify-center font-black text-[10px] shrink-0 border border-[#22577A]/20 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-[11px] font-black text-zinc-900 truncate leading-none mb-0.5">{profileName}</div>
            <div className="text-[9px] text-zinc-400 truncate leading-none font-semibold">{displayEmail}</div>
          </div>
        </Link>

        {/* Divider */}
        <div className="border-t border-zinc-100 my-0.5" />

        {/* Settings Link */}
        <Link
          href="/dashboard/settings"
          onClick={() => {
            setShowProfilePopup(false);
            onMobileClose?.();
          }}
          className="no-underline flex items-center gap-2.5 px-2.5 py-2 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 transition-colors rounded-lg text-xs font-semibold text-left cursor-pointer"
        >
          <Settings size={14} className="text-zinc-600" />
          <span>Settings</span>
        </Link>

        {/* Billing Link */}
        <Link
          href="/dashboard/billing"
          onClick={() => {
            setShowProfilePopup(false);
            onMobileClose?.();
          }}
          className="no-underline flex items-center gap-2.5 px-2.5 py-2 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 transition-colors rounded-lg text-xs font-semibold text-left cursor-pointer"
        >
          <CreditCard size={14} className="text-zinc-600" />
          <span>Billing</span>
        </Link>

        {/* Divider */}
        <div className="border-t border-zinc-100 my-0.5" />

        {/* Sign out Action */}
        <button
          onClick={() => {
            setShowProfilePopup(false);
            onMobileClose?.();
            handleSignOut();
          }}
          className="flex items-center gap-2.5 px-2.5 py-2 text-red-600 hover:bg-red-50 hover:text-[#8B1A1A] transition-colors rounded-lg border-none bg-transparent text-xs font-semibold text-left w-full cursor-pointer"
        >
          <LogOut size={14} className="text-red-500 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>

      {/* ─── Bug / Contact Modal ─── */}
      {showBugModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 text-left select-none animate-in fade-in duration-200"
          onClick={() => setShowBugModal(false)}
        >
          <div 
            className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#22577A]/10 border border-[#22577A]/20 flex items-center justify-center shrink-0 text-[#22577A]">
                  <Bug size={16} />
                </div>
                <h3 className="text-sm font-black text-zinc-900 leading-none">Contact / Report a Bug</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowBugModal(false)}
                className="w-7 h-7 rounded-lg border-none bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed -mt-1">
              Tell us what went wrong or what you need - we'll reply by email.
            </p>

            {bugSubmitted ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Check size={20} />
                </div>
                <h4 className="text-xs font-black text-zinc-800">Message Sent!</h4>
                <p className="text-[10px] text-zinc-400 font-semibold max-w-[240px] mx-auto">
                  Thank you! We'll look into this and get back to you shortly.
                </p>
              </div>
            ) : (
              <>
                {/* Green WhatsApp card at top */}
                <a
                  href="https://api.whatsapp.com/send/?phone=916374385901&text=Hi+Dudo+support%2C+I+need+help+with&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline flex items-center gap-3 bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#A5D6A7]/40 rounded-xl p-3.5 transition-colors cursor-pointer group text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 text-white shadow-xs">
                    <MessageCircle size={15} className="fill-current" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-[#1B5E20] group-hover:underline">Talk to Dudo</h4>
                    <p className="text-[9px] text-[#2E7D32] font-semibold mt-0.5 leading-none">
                      Chat with our support agent on WhatsApp — instant help
                    </p>
                  </div>
                </a>

                {/* Divider */}
                <div className="flex items-center gap-3 select-none text-[10px] text-zinc-400 font-bold uppercase tracking-wider my-0.5">
                  <div className="flex-1 h-px bg-zinc-100" />
                  <span>or send us a message</span>
                  <div className="flex-1 h-px bg-zinc-100" />
                </div>

                {/* Form fields */}
                <form onSubmit={handleSendSupport} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={bugName}
                      onChange={(e) => setBugName(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-400 text-xs font-semibold text-zinc-800 bg-white placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Email</label>
                    <input
                      type="email"
                      placeholder="Your email"
                      value={bugEmail}
                      onChange={(e) => setBugEmail(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-400 text-xs font-semibold text-zinc-800 bg-white placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Contact number</label>
                    <input
                      type="text"
                      placeholder="Your phone number"
                      value={bugPhone}
                      onChange={(e) => setBugPhone(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-400 text-xs font-semibold text-zinc-800 bg-white placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Issue / message</label>
                    <textarea
                      placeholder="Describe the issue or your question..."
                      rows={3}
                      value={bugMessage}
                      onChange={(e) => setBugMessage(e.target.value)}
                      className="w-full p-3 rounded-lg border border-zinc-200 focus:outline-none focus:border-zinc-400 text-xs font-semibold resize-none text-zinc-800 bg-white placeholder:text-zinc-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={bugLoading}
                    className="w-full h-9.5 mt-2 bg-[#22577A] hover:bg-[#1C4662] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] shadow-md shadow-[#22577A]/10"
                  >
                    {bugLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={12} />
                        Send to support
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
