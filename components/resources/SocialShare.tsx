'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Share2, Link } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface SocialShareProps {
  title: string;
  slug: string;
}

export default function SocialShare({ title, slug }: SocialShareProps) {
  const toast = useToast();
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/resources/blog/${slug}`);
    }
  }, [slug]);

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link Copied', 'Article link copied to clipboard.');
  };

  return (
    <div className="flex items-center justify-between gap-1 flex-nowrap text-zinc-400 select-none w-full border-t border-zinc-100 pt-6">
      <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 text-zinc-450">
        <Share2 size={11} className="text-[#22577A]" /> Share
      </span>
      
      <div className="flex items-center gap-1 shrink-0 flex-nowrap">
        {/* LinkedIn */}
        <a 
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Share on LinkedIn"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-500 transition-colors bg-white cursor-pointer hover:text-blue-700 hover:border-blue-200"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
        </a>

        {/* X/Twitter */}
        <a 
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Share on X"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-500 transition-colors bg-white cursor-pointer hover:text-black hover:border-zinc-300"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>

        {/* Facebook */}
        <a 
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Share on Facebook"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-500 transition-colors bg-white cursor-pointer hover:text-blue-600 hover:border-blue-200"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
          </svg>
        </a>

        {/* WhatsApp */}
        <a 
          href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Share on WhatsApp"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-500 transition-colors bg-white cursor-pointer hover:text-emerald-600 hover:border-emerald-200"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.51-.077 1.719-.702 1.967-1.379.248-.679.248-1.262.173-1.379-.074-.117-.272-.187-.57-.336L17.472 14.382zM12.008 21.82c-1.95 0-3.86-.507-5.54-1.466L3.6 21.21l.88-3.322a9.75 9.75 0 0 1-1.606-5.32c.005-5.395 4.39-9.78 9.785-9.78 2.612 0 5.07 1.017 6.917 2.868 1.846 1.85 2.86 4.306 2.853 6.91-.005 5.397-4.39 9.782-9.786 9.782zM12 0C5.388 0 0 5.388 0 12a11.9 11.9 0 0 0 1.84 6.34L0 24l5.83-1.53A11.9 11.9 0 0 0 12 24c6.612 0 12-5.388 12-12S18.612 0 12 0z" />
          </svg>
        </a>

        {/* Instagram */}
        <button 
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Link Copied', 'Instagram doesn\'t support direct web sharing, copied article link instead!');
          }}
          title="Share on Instagram"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-500 transition-colors bg-white cursor-pointer hover:text-pink-600 hover:border-pink-200"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M12 0C8.74 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
          </svg>
        </button>

        {/* Reddit */}
        <a 
          href={`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`} 
          target="_blank" 
          rel="noopener noreferrer"
          title="Share on Reddit"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-500 transition-colors bg-white cursor-pointer hover:text-orange-600 hover:border-orange-200"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.29-1.72l1.41-4.53 3.9 1.1c.02.72.6 1.3 1.33 1.3 1.09 0 1.98-.88 1.98-1.98s-.89-1.98-1.98-1.98c-.73 0-1.32.58-1.34 1.3l-4.42-1.24c-.17-.05-.36.04-.41.21L10.9 7.97c-2.48.04-4.73.68-6.39 1.69-.57-.76-1.47-1.23-2.43-1.23-1.65 0-3 1.35-3 3 0 1.21.73 2.24 1.77 2.68-.06.47-.09.95-.09 1.44 0 4.14 4.7 7.5 10.5 7.5s10.5-3.36 10.5-7.5c0-.49-.03-.97-.09-1.44 1.04-.44 1.77-1.47 1.77-2.68zM5.01 13.5c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm12 5.03c-1.83 1.83-5.3 1.83-7.13 0-.19-.19-.19-.51 0-.7.19-.19.51-.19.7 0 1.45 1.45 4.28 1.45 5.73 0 .19-.19.51-.19.7 0 .19.19.19.51 0 .7zm-.88-3.03c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
          </svg>
        </a>

        {/* Copy Link */}
        <button 
          onClick={handleCopyLink}
          title="Copy Link"
          className="w-6 h-6 rounded-md border border-zinc-150 hover:bg-zinc-50 flex items-center justify-center text-zinc-550 transition-colors bg-white cursor-pointer hover:text-zinc-850 hover:border-zinc-350"
        >
          <Link size={12} />
        </button>
      </div>
    </div>
  );
}

export function AuthorAvatar({ avatar, name, className = "w-7 h-7" }: { avatar: string | undefined; name: string; className?: string }) {
  const [error, setError] = useState(false);
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  if (error || !avatar) {
    return (
      <div className={cn(className, "rounded-full bg-[#22577A]/10 border border-[#22577A]/25 flex items-center justify-center text-[10px] font-bold text-[#22577A] shrink-0 select-none")}>
        {initials}
      </div>
    );
  }

  return (
    <img 
      src={avatar} 
      alt={name} 
      onError={() => setError(true)}
      className={cn(className, "rounded-full object-cover border border-zinc-200 shrink-0")}
    />
  );
}
