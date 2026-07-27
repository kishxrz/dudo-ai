'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plug, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import Link from 'next/link';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { IntegrationCard } from '@/components/ui/IntegrationCard';
import { FormSection } from '@/components/ui/FormSection';

// High-fidelity SVG Logos for Google Workspace products
const GmailLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 256 193" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <path d="M58.1818182,192.049515 L58.1818182,93.1404244 L27.5066233,65.0770089 L0,49.5040608 L0,174.59497 C0,184.253152 7.82545455,192.049515 17.4545455,192.049515 L58.1818182,192.049515 Z" fill="#4285F4" />
      <path d="M197.818182,192.049515 L238.545455,192.049515 C248.203636,192.049515 256,184.224061 256,174.59497 L256,49.5040608 L224.844415,67.3422767 L197.818182,93.1404244 L197.818182,192.049515 Z" fill="#34A853" />
      <polygon fill="#EA4335" points="58.1818182 93.1404244 54.0077618 54.4932827 58.1818182 17.5040608 128 69.8676972 197.818182 17.5040608 202.487488 52.4960089 197.818182 93.1404244 128 145.504061" />
      <path d="M197.818182,17.5040608 L197.818182,93.1404244 L256,49.5040608 L256,26.2313335 C256,4.64587897 231.36,-7.65957557 214.109091,5.28587897 L197.818182,17.5040608 Z" fill="#FBBC04" />
      <path d="M0,49.5040608 L26.7588051,69.5731646 L58.1818182,93.1404244 L58.1818182,17.5040608 L41.8909091,5.28587897 C24.6109091,-7.65957557 0,4.64587897 0,26.2313335 L0,49.5040608 Z" fill="#C5221F" />
    </g>
  </svg>
);

const GoogleCalendarLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <polygon fill="#FFFFFF" points="195.368421 60.6315789 60.6315789 60.6315789 60.6315789 195.368421 195.368421 195.368421" />
      <polygon fill="#EA4335" points="195.368421 256 256 195.368421 225.684211 190.196005 195.368421 195.368421 189.835162 223.098002" />
      <path d="M0,195.368421 L0,235.789474 C0,246.955789 9.04421053,256 20.2105263,256 L60.6315789,256 L66.8568645,225.684211 L60.6315789,195.368421 L27.5991874,190.196005 L0,195.368421 Z" fill="#188038" />
      <path d="M256,60.6315789 L256,20.2105263 C256,9.04421053 246.955789,0 235.789474,0 L195.368421,0 C191.679582,15.0358547 189.835162,26.1010948 189.835162,33.1957202 C189.835162,40.2903456 191.679582,49.4356319 195.368421,60.6315789 C208.777986,64.4714866 218.883249,66.3914404 225.684211,66.3914404 C232.485172,66.3914404 242.590435,64.4714866 256,60.6315789 Z" fill="#1967D2" />
      <polygon fill="#FBBC04" points="256 60.6315789 195.368421 60.6315789 195.368421 195.368421 256 195.368421" />
      <polygon fill="#34A853" points="195.368421 195.368421 60.6315789 195.368421 60.6315789 256 195.368421 256" />
      <path d="M195.368421,0 L20.2105263,0 C9.04421053,0 0,9.04421053 0,20.2105263 L0,195.368421 L60.6315789,195.368421 L60.6315789,60.6315789 L195.368421,60.6315789 L195.368421,0 Z" fill="#4285F4" />
      <path d="M88.2694737,165.153684 C83.2336842,161.751579 79.7473684,156.783158 77.8442105,150.214737 L89.5326316,145.397895 C90.5936842,149.44 92.4463158,152.572632 95.0905263,154.795789 C97.7178947,157.018947 100.917895,158.113684 104.656842,158.113684 C108.48,158.113684 111.764211,156.951579 114.509474,154.627368 C117.254737,152.303158 118.635789,149.338947 118.635789,145.751579 C118.635789,142.08 117.187368,139.082105 114.290526,136.757895 C111.393684,134.433684 107.755789,133.271579 103.410526,133.271579 L96.6568421,133.271579 L96.6568421,121.701053 L102.72,121.701053 C106.458947,121.701053 109.608421,120.690526 112.168421,118.669474 C114.728421,116.648421 116.008421,113.886316 116.008421,110.366316 C116.008421,107.233684 114.863158,104.741053 112.572632,102.871579 C110.282105,101.002105 107.385263,100.058947 103.865263,100.058947 C100.429474,100.058947 97.7010526,100.968421 95.68,102.804211 C93.6602819,104.644885 92.1418208,106.968942 91.2673684,109.557895 L79.6968421,104.741053 C81.2294737,100.395789 84.0421053,96.5557895 88.1684211,93.2378947 C92.2947368,89.92 97.5663158,88.2526316 103.966316,88.2526316 C108.698947,88.2526316 112.96,89.1621053 116.732632,90.9978947 C120.505263,92.8336842 123.469474,95.3768421 125.608421,98.6105263 C127.747368,101.861053 128.808421,105.498947 128.808421,109.541053 C128.808421,113.667368 127.814737,117.153684 125.827368,120.016842 C123.84,122.88 121.397895,125.069474 118.501053,126.602105 L118.501053,127.292632 C122.241568,128.834789 125.490747,131.367752 127.898947,134.618947 C130.341053,137.903158 131.570526,141.827368 131.570526,146.408421 C131.570526,150.989474 130.408421,155.082105 128.084211,158.669474 C125.76,162.256842 122.543158,165.086316 118.467368,167.141053 C114.374737,169.195789 109.776842,170.240124 104.673684,170.240124 C98.7621053,170.256842 93.3052632,168.555789 88.2694737,165.153684 L88.2694737,165.153684 Z M160.067368,107.149474 L147.233684,116.429474 L140.816842,106.694737 L163.84,90.0884211 L172.665263,90.0884211 L172.665263,168.421053 L160.067368,168.421053 L160.067368,107.149474 Z" fill="#4285F4" />
    </g>
  </svg>
);

const GoogleSheetsLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#107C41" />
    <path d="M14 8h6l-6-6v6z" fill="#34A853" />
    <rect x="7.5" y="10.5" width="9" height="6" rx="0.5" fill="#FFFFFF" />
    <line x1="12" y1="10.5" x2="12" y2="16.5" stroke="#107C41" strokeWidth="1" />
    <line x1="7.5" y1="12.5" x2="16.5" y2="12.5" stroke="#107C41" strokeWidth="1" />
    <line x1="7.5" y1="14.5" x2="16.5" y2="14.5" stroke="#107C41" strokeWidth="1" />
  </svg>
);

const GoogleDriveLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 256 229" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA" />
      <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335" />
      <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D" />
      <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC" />
      <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47" />
      <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00" />
    </g>
  </svg>
);

const GoogleDocsLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" fill="#4285F4" />
    <path d="M14 8h6l-6-6v6z" fill="#1A73E8" />
    <line x1="7" y1="11.5" x2="17" y2="11.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="14" x2="17" y2="14" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="16.5" x2="13" y2="16.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function IntegrationsPage() {
  const { workspaceId } = useWorkspace();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [connectedScopes, setConnectedScopes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const [toolName, setToolName] = useState('');
  const [toolActionDesc, setToolActionDesc] = useState('');
  const [importance, setImportance] = useState('Nice to have');
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false });
  const [isLocked, setIsLocked] = useState(false);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 130;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      setCoords({
        top: openUpward 
          ? rect.top - dropdownHeight - 4 
          : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUpward,
      });
    }
  };

  useEffect(() => {
    if (dropdownOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [dropdownOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        triggerRef.current?.contains(target) || 
        dropdownRef.current?.contains(target) ||
        target.closest('.custom-select-container')
      ) {
        return;
      }
      setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

  // Status check on mount / workspaceId change
  useEffect(() => {
    async function checkStatus() {
      if (!workspaceId) return;
      try {
        const { canUseFeature } = await import('@/lib/billing-entitlements');
        const allowed = await canUseFeature(workspaceId, 'booking');
        if (!allowed) {
          setIsLocked(true);
          setIsLoading(false);
          return;
        }
        setIsLocked(false);
        const res = await fetch(`/api/integrations/google/status?workspaceId=${workspaceId}`);
        if (res.ok) {
          const data = await res.json();
          setGoogleConnected(data.connected);
          setGoogleEmail(data.email || '');
          setConnectedScopes(data.scopes || []);
        }
      } catch (e) {
        console.error('Failed to load Google status:', e);
      } finally {
        setIsLoading(false);
      }
    }
    checkStatus();
  }, [workspaceId]);

  // Check for success parameter in redirect URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('success') === 'true') {
        setShowSuccessToast(true);
        // Clear query parameter from URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        setTimeout(() => setShowSuccessToast(false), 5000);
      }
    }
  }, []);

  const handleConnect = async (scope: string) => {
    if (!workspaceId) return;
    if (googleConnected) {
      try {
        const res = await fetch('/api/integrations/google/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ workspaceId, scope }),
        });
        if (res.ok) {
          setConnectedScopes((prev) => Array.from(new Set([...prev, scope])));
        } else {
          console.error(`Failed to connect ${scope}`);
        }
      } catch (e) {
        console.error(`Failed to connect ${scope}:`, e);
      }
    } else {
      window.location.href = `/api/integrations/google/auth?workspaceId=${workspaceId}&scope=${scope}`;
    }
  };

  const handleDisconnect = async (scope: string) => {
    if (!workspaceId) return;
    try {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId, scope }),
      });
      if (res.ok) {
        setConnectedScopes((prev) => {
          const updated = prev.filter((s) => s !== scope);
          if (updated.length === 0) {
            setGoogleConnected(false);
            setGoogleEmail('');
          }
          return updated;
        });
      } else {
        console.error(`Failed to disconnect ${scope}`);
      }
    } catch (e) {
      console.error(`Failed to disconnect ${scope}:`, e);
    }
  };

  const handleSubmitRequest = () => {
    if (!toolName.trim() || !toolActionDesc.trim()) return;
    setRequestStatus('success');
    setToolName('');
    setToolActionDesc('');
    setTimeout(() => setRequestStatus(null), 4000);
  };

  const connectors = [
    {
      key: 'gmail' as const,
      name: 'Gmail',
      icon: GmailLogo,
      desc: connectedScopes.includes('gmail') && googleEmail
        ? `AI can read & send emails. Connected as: ${googleEmail}`
        : 'AI can read & send emails',
    },
    {
      key: 'calendar' as const,
      name: 'Google Calendar',
      icon: GoogleCalendarLogo,
      desc: connectedScopes.includes('calendar') && googleEmail
        ? `AI can book & manage appointments. Connected as: ${googleEmail}`
        : 'AI can book & manage appointments',
    },
    {
      key: 'sheets' as const,
      name: 'Google Sheets',
      icon: GoogleSheetsLogo,
      desc: connectedScopes.includes('sheets') && googleEmail
        ? `AI can log leads and orders. Connected as: ${googleEmail}`
        : 'AI can log leads and orders',
    },
    {
      key: 'drive' as const,
      name: 'Google Drive',
      icon: GoogleDriveLogo,
      desc: connectedScopes.includes('drive') && googleEmail
        ? `AI can search your business files. Connected as: ${googleEmail}`
        : 'AI can search your business files',
    },
    {
      key: 'docs' as const,
      name: 'Google Docs',
      icon: GoogleDocsLogo,
      desc: connectedScopes.includes('docs') && googleEmail
        ? `AI can read your business documents. Connected as: ${googleEmail}`
        : 'AI can read your business documents',
    },
  ];

  if (isLoading) {
    return (
      <PageLayout className="max-w-[1150px] w-full text-left mx-auto gap-5 px-6 pb-16 box-border">
        <LoadingSpinner size="lg" text="Loading Integrations..." />
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
          <h2 className="text-lg font-bold text-zinc-900 leading-none">Upgrade to Unlock Integrations</h2>
          <p className="text-xs text-zinc-500 leading-normal">
            Google Calendar, sheets, docs, gmail, and drive integrations are only available on the Monthly Plan or 6-Month Pack.
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
    <PageLayout className="max-w-[1150px] w-full text-left mx-auto gap-5 px-6 pb-16 box-border">
      {/* 1. Custom Header matching Scheduled Jobs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 text-[#22577A] mt-1">
            <Plug size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-zinc-950 tracking-tight leading-none mb-2">
              Connectors
            </h1>
            <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
              Plug your apps in and the AI agent can use them - send Gmail, create Calendar events, log to Sheets, and more.
            </p>
          </div>
        </div>
      </div>

      {showSuccessToast && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs font-bold text-green-700 flex items-center gap-2 animate-fade-in mb-1">
          <Check size={14} className="text-green-600" />
          Successfully connected to Google services! Your agent can now use these tools.
        </div>
      )}

      {/* Quick Connect Subheading */}
      <div className="space-y-2 text-left">
        <SectionHeader 
          title="Quick Connect" 
          actions={
            <span className="text-[9px] font-black text-[#22577A] tracking-wider uppercase bg-[#FFF3E5] border border-[#EED9B4] px-2.5 py-0.5 rounded-full">
              Recommended
            </span>
          }
        />
        <p className="text-xs text-zinc-600 font-medium leading-relaxed">
          Sign in once, your AI agent can use your Google apps. Tokens stay encrypted; revoke any time.
        </p>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {connectors.map((connector) => {
          const isConnected = connectedScopes.includes(connector.key);
          return (
            <IntegrationCard
              key={connector.key}
              title={connector.name}
              description={connector.desc}
              icon={connector.icon}
              connected={isConnected}
              statusLabel={isConnected ? 'Connected' : 'Not Connected'}
              onAction={() => isConnected ? handleDisconnect(connector.key) : handleConnect(connector.key)}
              actionText={isConnected ? 'Disconnect' : 'Connect'}
            />
          );
        })}
      </div>

      {/* Roadmap Form Section */}
      <div className="space-y-3 max-w-2xl text-left mt-4">
        <SectionHeader title="Roadmap Requests" />
        
        <FormSection
          title="Need a different tool?"
          description="Don't see your CRM, ERP, social channel, or any other app? Tell us and we'll add it to the roadmap."
        >
          {requestStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-xs font-bold text-green-700 flex items-center gap-2 animate-fade-in">
              <Check size={14} className="text-green-600" />
              Roadmap request submitted successfully! We'll look into adding this tool.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700">Tool / service name</label>
            <input
              type="text"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="e.g. Kylas CRM, LeadSquared, Razorpay"
              className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-normal text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-[#22577A] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700">What would you like the AI to do with it?</label>
            <textarea
              value={toolActionDesc}
              onChange={(e) => setToolActionDesc(e.target.value)}
              placeholder="e.g. log every WhatsApp lead into Kylas under the Mumbai pipeline, with name + phone + first message"
              className="w-full min-h-[90px] bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-normal text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-[#22577A] transition-colors resize-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5 relative custom-select-container">
            <label className="text-xs font-semibold text-zinc-700">How important is this for you?</label>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-normal text-zinc-900 text-left outline-none focus:border-[#22577A] transition-colors flex items-center justify-between cursor-pointer select-none"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
            >
              <span>{importance}</span>
              <svg
                className={cn("w-4 h-4 text-zinc-400 transition-transform duration-200", dropdownOpen ? "transform rotate-180" : "")}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && typeof document !== 'undefined' && createPortal(
              <div
                ref={dropdownRef}
                style={{
                  position: 'fixed',
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: `${coords.width}px`,
                }}
                className="z-[9999] bg-white border border-zinc-200/90 rounded-xl shadow-xl py-1 outline-none animate-fade-in list-none p-0"
                role="listbox"
              >
                {['Nice to have', 'Important', 'Crucial'].map((option) => (
                  <div
                    key={option}
                    onClick={() => {
                      setImportance(option);
                      setDropdownOpen(false);
                      triggerRef.current?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setImportance(option);
                        setDropdownOpen(false);
                        triggerRef.current?.focus();
                      } else if (e.key === 'Escape') {
                        setDropdownOpen(false);
                        triggerRef.current?.focus();
                      }
                    }}
                    tabIndex={0}
                    role="option"
                    aria-selected={importance === option}
                    className={cn(
                      "px-3.5 py-2.5 text-sm cursor-pointer outline-none transition-colors",
                      importance === option
                        ? "bg-zinc-50 text-zinc-950 font-medium"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {importance === option && (
                        <Check size={14} className="text-zinc-800" />
                      )}
                    </div>
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSubmitRequest}
              className="bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-xl px-5.5 h-9 text-xs border-none shadow-md shadow-[#22577A]/10 cursor-pointer transition-all hover:scale-[1.02]"
            >
              Send request
            </Button>
          </div>
        </FormSection>
      </div>

    </PageLayout>
  );
}
