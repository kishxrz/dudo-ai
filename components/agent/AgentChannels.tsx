'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Send, Check, X, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const channelId = 'ch-tg';

const WhatsAppLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#25D366" d="M12.004 2C6.48 2 2.002 6.477 2.002 12c0 1.892.522 3.66 1.43 5.176l-1.42 5.19 5.31-1.39A9.936 9.936 0 0 0 12.004 22c5.52 0 9.998-4.477 9.998-10s-4.478-10-9.998-10z" />
    <path fill="#FFFFFF" d="M8.391 7.308a.961.961 0 0 0-.371.1 1.293 1.293 0 0 0-.294.228c-.12.113-.188.211-.261.306A2.729 2.729 0 0 0 6.9 9.62c.002.49.13.967.33 1.413.409.902 1.082 1.857 1.971 2.742.214.213.423.427.648.626a9.448 9.448 0 0 0 3.84 2.046l.569.087c.185.01.37-.004.556-.013a1.99 1.99 0 0 0 .833-.231c.166-.088.244-.132.383-.22 0 0 .043-.028.125-.09.135-.1.218-.171.33-.288.083-.086.155-.187.21-.302.078-.163.156-.474.188-.733.024-.198.017-.306.014-.373-.004-.107-.093-.218-.19-.265l-.582-.261s-.87-.379-1.401-.621a.498.498 0 0 0-.177-.041.482.482 0 0 0-.378.127v-.002c-.005 0-.072.057-.795.933a.35.35 0 0 1-.368.13 1.416 1.416 0 0 1-.191-.066c-.124-.052-.167-.072-.252-.109l-.005-.002a6.01 6.01 0 0 1-1.57-1c-.126-.11-.243-.23-.363-.346a6.296 6.296 0 0 1-1.02-1.268l-.059-.095a.923.923 0 0 1-.102-.205c-.038-.147.061-.265.061-.265s.243-.266.356-.41a4.38 4.38 0 0 0 .263-.373c.118-.19.155-.385.093-.536-.28-.684-.57-1.365-.868-2.041-.059-.134-.234-.23-.393-.249-.054-.006-.108-.012-.162-.016a3.385 3.385 0 0 0-.403.004z" />
  </svg>
);

const TelegramLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#24A1DE" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" />
    <path fill="#FFFFFF" d="M12.3583 9.38244C11.3857 9.787 9.44177 10.6243 6.52657 11.8944C6.05318 12.0827 5.8052 12.2669 5.78263 12.4469C5.74448 12.7513 6.12559 12.8711 6.64455 13.0343C6.71515 13.0565 6.78829 13.0795 6.86327 13.1038C7.37385 13.2698 8.06068 13.464 8.41773 13.4717C8.74161 13.4787 9.1031 13.3452 9.50219 13.0711C12.226 11.2325 13.632 10.3032 13.7202 10.2831C13.7825 10.269 13.8688 10.2512 13.9273 10.3032C13.9858 10.3032 13.98 10.4536 13.9738 10.48C13.9361 10.641 12.4401 12.0318 11.6659 12.7515C11.4246 12.9759 11.2534 13.135 11.2184 13.1714C11.14 13.2528 11.0601 13.3298 10.9833 13.4038C10.509 13.8611 10.1532 14.204 11.003 14.764C11.4114 15.0331 11.7381 15.2556 12.0641 15.4776C12.4201 15.7201 12.7752 15.9619 13.2347 16.2631C13.3517 16.3398 13.4635 16.4195 13.5724 16.4971C13.9867 16.7925 14.3589 17.0579 14.8188 17.0155C15.086 16.991 15.362 16.7397 15.5022 15.9903C15.8335 14.2193 16.4847 10.382 16.6352 8.80081C16.6484 8.66228 16.6318 8.48498 16.6185 8.40715C16.6051 8.32932 16.5773 8.21842 16.4761 8.13633C16.3563 8.03911 16.1714 8.01861 16.0886 8.02C15.7125 8.0267 15.1354 8.22735 12.3583 9.38244Z" />
  </svg>
);

export default function AgentChannels() {
  const { workspaceId } = useWorkspace();
  const { currentUser: user } = useAuth();
  const [activeChannel, setActiveChannel] = useState<'telegram' | 'whatsapp'>('telegram');
  const [waAllowed, setWaAllowed] = useState(true);
  
  // Telegram states
  const [token, setToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // WhatsApp states
  const [waStatus, setWaStatus] = useState<'disconnected' | 'qr_ready' | 'connected'>('disconnected');
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waError, setWaError] = useState('');
  const [qrLoading, setQrLoading] = useState(true);
  const [connectStartTime, setConnectStartTime] = useState<number | null>(null);
  const [qrTimeout, setQrTimeout] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const lastQrRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkPlan() {
      if (!workspaceId) return;
      try {
        const { canUseFeature } = await import('@/lib/billing-entitlements');
        const allowed = await canUseFeature(workspaceId, 'channels.whatsapp');
        setWaAllowed(allowed);
      } catch (e) {
        console.error(e);
      }
    }
    checkPlan();
  }, [workspaceId]);

  // Load Telegram status on mount / workspaceId change
  useEffect(() => {
    async function loadConfig() {
      let savedToken = '';
      let savedStatus = false;

      if (db && workspaceId) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'channels', channelId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            savedToken = data.token || '';
            savedStatus = data.status === 'connected';
          }
        } catch (e) {
          console.error('Failed to load from Firestore:', e);
        }
      }

      if (!savedToken && typeof window !== 'undefined') {
        const localToken = localStorage.getItem('__dudo_telegram_token');
        const localStatus = localStorage.getItem('__dudo_telegram_connected') === 'true';
        if (localToken) {
          savedToken = localToken;
          savedStatus = localStatus;
        }
      }

      setToken(savedToken);
      setIsConnected(savedStatus);
      setLoading(false);
    }
    loadConfig();
  }, [workspaceId]);

  useEffect(() => {
    const checkStatusAndQr = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        let currentStatus: string = 'disconnected';
        if (res.ok) {
          const data = await res.json();
          setWaStatus(data.status);
          currentStatus = data.status;
          if (data.status === 'connected') {
            lastQrRef.current = null;
            setWaQrCode(null);
            setQrLoading(false);
            setQrTimeout(false);
            setConnectStartTime(null);
            return;
          }

          // If server indicates QR is ready, set image src to the QR route (binary PNG)
          if (data.status === 'qr_ready') {
            const qrUrl = `/api/whatsapp/qr?ts=${Date.now()}`;
            if (lastQrRef.current !== qrUrl) {
              lastQrRef.current = qrUrl;
              setWaQrCode(qrUrl);
            }
            setWaStatus('qr_ready');
            setQrLoading(false);
            setQrTimeout(false);
            setConnectStartTime(null);
          } else {
            if (currentStatus === 'disconnected' && !connectStartTime) {
              setQrLoading(false);
            }
          }
        }
      } catch (e) {
        console.error('Error polling WhatsApp status/QR:', e);
        if (!connectStartTime) {
          setQrLoading(false);
        }
      }
    };

    checkStatusAndQr();
    const checkInterval = setInterval(checkStatusAndQr, 10000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [connectStartTime]);

  // Reset imgLoaded when QR code changes, and set a fallback timeout to force show the image
  useEffect(() => {
    if (waQrCode) {
      setImgLoaded(false);
      console.log('[AgentChannels] New QR code set. Resetting imgLoaded to false. Initializing 2s fallback...');
      const timer = setTimeout(() => {
        console.log('[AgentChannels] Fallback timer triggered - forcing imgLoaded to true');
        setImgLoaded(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [waQrCode]);

  // 10-second timeout check for QR generation
  useEffect(() => {
    if (connectStartTime && !waQrCode && waStatus !== 'connected' && !qrTimeout) {
      const timer = setTimeout(() => {
        setQrTimeout(true);
        setQrLoading(false);
        setWaConnecting(false);
        setConnectStartTime(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [connectStartTime, waQrCode, waStatus, qrTimeout]);

  // Telegram Connect
  const handleConnect = async () => {
    const botToken = token.trim();
    if (!botToken) {
      setErrorMessage('Please enter a valid Bot Token.');
      return;
    }
    setConnecting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, token: botToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Telegram.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('__dudo_telegram_token', botToken);
        localStorage.setItem('__dudo_telegram_connected', 'true');
        localStorage.setItem('__dudo_dev_status', 'live');
        window.dispatchEvent(new Event('dudo-status-changed'));
        window.dispatchEvent(new Event('dudo-config-changed'));
      }

      setSuccessMessage('Telegram connected!');
      setIsConnected(true);
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Failed to connect Telegram.';
      setErrorMessage(msg);
    } finally {
      setConnecting(false);
    }
  };

  // Telegram Disconnect
  const handleDisconnect = async () => {
    setConnecting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('/api/telegram/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect Telegram.');
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('__dudo_telegram_token');
        localStorage.setItem('__dudo_telegram_connected', 'false');
        localStorage.setItem('__dudo_dev_status', 'draft');
        window.dispatchEvent(new Event('dudo-status-changed'));
        window.dispatchEvent(new Event('dudo-config-changed'));
      }

      setIsConnected(false);
      setToken('');
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Failed to disconnect Telegram.';
      setErrorMessage(msg);
    } finally {
      setConnecting(false);
    }
  };

  // WhatsApp Connect
  const handleConnectWhatsApp = async () => {
    setWaConnecting(true);
    setWaError('');
    setQrLoading(true);
    setQrTimeout(false);
    setConnectStartTime(Date.now());
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.qr) {
          lastQrRef.current = data.qr;
          setWaQrCode(data.qr);
          setWaStatus('qr_ready');
          setQrLoading(false);
          setConnectStartTime(null);
        } else if (data.status === 'initializing') {
          console.log('WhatsApp client is initializing, waiting for QR code generation...');
        } else {
          console.log('No QR code returned.');
        }
      } else {
        const errText = await res.text();
        setWaError(errText || 'Failed to connect WhatsApp.');
        setQrLoading(false);
        setConnectStartTime(null);
      }
    } catch (e: any) {
      console.error(e);
      setWaError(e.message || 'Failed to initiate WhatsApp connection.');
      setQrLoading(false);
      setConnectStartTime(null);
    } finally {
      setWaConnecting(false);
    }
  };

  // WhatsApp Disconnect
  const handleDisconnectWhatsApp = async () => {
    setWaConnecting(true);
    setWaError('');
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
      });
      if (res.ok) {
        setWaStatus('disconnected');
        lastQrRef.current = null;
        setWaQrCode(null);
      } else {
        const errText = await res.text();
        setWaError(errText || 'Failed to disconnect WhatsApp.');
      }
    } catch (e: any) {
      console.error(e);
      setWaError(e.message || 'Failed to disconnect WhatsApp.');
    } finally {
      setWaConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#22577A] border-r-2 border-r-transparent" />
      </div>
    );
  }


  return (
    <div className="space-y-4 max-w-4xl mx-auto select-none">
      <div>
        <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-3">Connect New Channel</h3>
        
        {/* Channel Grid cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* WhatsApp Card */}
          <div 
            onClick={() => setActiveChannel('whatsapp')}
            className={cn(
              'border rounded-xl p-4 shadow-sm relative flex flex-col justify-between transition-all duration-150 cursor-pointer bg-white',
              activeChannel === 'whatsapp' 
                ? 'border-[#22577A] ring-1 ring-[#22577A]/30' 
                : 'border-zinc-200 hover:border-zinc-350'
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                  <WhatsAppLogo className="w-5.5 h-5.5" />
                </div>
                {waStatus === 'connected' ? (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 flex items-center gap-0.5">
                    <Check size={8} className="stroke-[3]" />
                    CONNECTED
                  </span>
                ) : qrTimeout ? (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                    <X size={8} className="stroke-[3]" />
                    ERROR
                  </span>
                ) : waStatus === 'qr_ready' ? (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-0.5">
                    SCAN QR
                  </span>
                ) : (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-zinc-55 text-zinc-500 border border-zinc-200 flex items-center gap-0.5">
                    NOT CONNECTED
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-zinc-800">WhatsApp</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {waStatus === 'connected' ? 'Connected successfully' : 'Scan QR code to connect WhatsApp'}
              </p>
            </div>
          </div>

          {/* Telegram Card */}
          <div 
            onClick={() => setActiveChannel('telegram')}
            className={cn(
              'border rounded-xl p-4 shadow-sm relative flex flex-col justify-between transition-all duration-150 cursor-pointer bg-white',
              activeChannel === 'telegram' 
                ? 'border-[#22577A] ring-1 ring-[#22577A]/30' 
                : 'border-zinc-200 hover:border-zinc-350'
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#24A1DE]/10 flex items-center justify-center">
                  <TelegramLogo className="w-5.5 h-5.5" />
                </div>
                {isConnected ? (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-200 flex items-center gap-0.5">
                    <Check size={8} className="stroke-[3]" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-zinc-55 text-zinc-500 border border-zinc-200 flex items-center gap-0.5">
                    NOT CONNECTED
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-zinc-800">Telegram</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">Enter bot token from @BotFather</p>
            </div>
          </div>

        </div>
      </div>

      {/* Conditional Content based on active channel selection */}
      {activeChannel === 'whatsapp' ? (
        !waAllowed ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-3 min-h-[220px]">
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 text-lg font-bold">
              🔒
            </div>
            <h4 className="text-xs font-bold text-zinc-900 leading-none">Upgrade to Connect WhatsApp</h4>
            <p className="text-[10px] text-zinc-500 leading-normal max-w-sm">
              WhatsApp channel integration is only available on the Monthly Plan or 6-Month Pack. Upgrade to unlock this channel.
            </p>
            <Link href="/dashboard/billing" className="no-underline">
              <Button className="h-7 px-3 bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-lg text-[10px] border-none cursor-pointer">
                Upgrade to Unlock
              </Button>
            </Link>
          </div>
        ) : (
          /* WhatsApp connection form */
          <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-fade-in">
          {waStatus === 'connected' ? (
            /* Connected state with checkmark animation */
            <div className="flex flex-col items-center justify-center p-6 bg-green-50/20 border border-green-200 rounded-lg space-y-3">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-11 w-11 rounded-full bg-green-400 opacity-20 animate-ping"></span>
                <div className="relative w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/10">
                  <Check className="w-5 h-5 text-white stroke-[3]" />
                </div>
              </div>
              <div className="text-center">
                <h4 className="text-xs font-bold text-green-800">WhatsApp Connected</h4>
                <p className="text-[10px] text-green-600 mt-0.5 font-semibold">Ready to automate conversations</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-700">
                  WhatsApp Connection
                </Label>
                
                {qrTimeout ? (
                  /* Error / timeout state */
                  <div className="flex flex-col items-center justify-center p-5 bg-red-50/20 border border-red-200 rounded-lg space-y-2">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-xs text-red-600 font-semibold">Failed to generate QR.</p>
                    <Button
                      onClick={handleConnectWhatsApp}
                      className="bg-[#22577A] hover:bg-[#1A4461] text-white h-7.5 text-xs font-semibold px-3 rounded-md cursor-pointer flex items-center gap-1"
                    >
                      Retry
                    </Button>
                  </div>
                ) : qrLoading ? (
                  /* Loading skeleton / spinner */
                  <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
                    <div className="w-40 h-40 flex flex-col items-center justify-center bg-white border border-zinc-100 rounded-lg shadow-inner relative overflow-hidden">
                      <div className="absolute inset-0 bg-zinc-100 animate-pulse opacity-50"></div>
                      <div className="relative z-10 w-8 h-8 border-3 border-[#22577A] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-semibold animate-pulse">Generating QR code...</p>
                  </div>
                ) : waStatus === 'qr_ready' && waQrCode ? (
                  /* QR Ready - scanning state */
                  <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                    <div className="relative p-1 bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                      <div className="absolute inset-0 rounded-lg border-2 border-[#22577A] animate-pulse"></div>
                      
                      <div className="relative z-10 bg-white rounded-md p-1">
                        <img
                          key={waQrCode}
                          src={waQrCode}
                          onLoad={() => setImgLoaded(true)}
                          className={cn(
                            "w-40 h-40 border border-zinc-200 rounded p-1 bg-white transition-opacity duration-500 ease-in-out",
                            imgLoaded ? "opacity-100" : "opacity-0"
                          )}
                          alt="WhatsApp QR Code"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-ping"></span>
                      Waiting for scan...
                    </p>
                  </div>
                ) : (
                  /* Disconnected state */
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-center text-xs text-zinc-500 font-medium leading-relaxed">
                    Click "Connect WhatsApp" below to generate a QR code.
                  </div>
                )}
                
                {waError && (
                  <p className="text-xs font-semibold text-red-500 mt-1">
                    {waError}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            {waStatus === 'connected' ? (
              <Button
                onClick={handleDisconnectWhatsApp}
                disabled={waConnecting}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white h-8 text-xs font-bold px-3.5 rounded-md flex items-center gap-1 border-none cursor-pointer"
              >
                {waConnecting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-destructive border-t-transparent rounded-full animate-spin mr-1" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <X size={11} />
                    Disconnect WhatsApp
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleConnectWhatsApp}
                disabled={waConnecting || (qrLoading && !qrTimeout)}
                className="bg-[#22577A] hover:bg-[#1A4461] text-white h-8 text-xs font-semibold px-3.5 rounded-md flex items-center gap-1 cursor-pointer"
              >
                {waConnecting || (qrLoading && !qrTimeout) ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Check size={11} />
                    Connect WhatsApp
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        )
      ) : (
        /* Telegram connection form */
        <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-fade-in">
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 p-3.5 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs font-bold">
                <Check className="w-4 h-4 text-green-600 stroke-[3]" />
                <span>Telegram Connected ✅</span>
              </div>
              {successMessage && (
                <p className="text-xs font-semibold text-green-600">
                  {successMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="telegram-token" className="text-xs font-bold text-zinc-700">
                  Bot Token
                </Label>
                <Input
                  id="telegram-token"
                  type="text"
                  disabled={connecting}
                  placeholder="123456:ABC-DEF..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-9.5 text-xs border-zinc-200 focus-visible:ring-[#22577A] placeholder:text-zinc-400 text-zinc-800 bg-white"
                />
                <p className="text-[10px] text-zinc-400">
                  Get this from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[#22577A] hover:underline font-medium">@BotFather</a> on Telegram
                </p>
              </div>

              {errorMessage && (
                <p className="text-xs font-semibold text-red-500">
                  {errorMessage}
                </p>
              )}

              {successMessage && (
                <p className="text-xs font-semibold text-green-600">
                  {successMessage}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            {isConnected ? (
              <Button
                onClick={handleDisconnect}
                disabled={connecting}
                className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white h-8 text-xs font-bold px-3.5 rounded-md flex items-center gap-1 border-none cursor-pointer"
              >
                {connecting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-destructive border-t-transparent rounded-full animate-spin mr-1" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <X size={11} />
                    Disconnect Telegram
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-[#22577A] hover:bg-[#1A4461] text-white h-8 text-xs font-semibold px-3.5 rounded-md flex items-center gap-1 cursor-pointer"
              >
                {connecting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Check size={11} />
                    Connect Telegram
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
