import React from 'react';

export default function Logo({ className = "w-8 h-8", strokeColor = "white" }: { className?: string, strokeColor?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DBA11A" />
          <stop offset="100%" stopColor="#F3BE42" />
        </linearGradient>
      </defs>
      
      {/* Connecting Spoke Lines */}
      <line x1="50" y1="50" x2="25" y2="25" stroke="url(#logo-gradient)" strokeWidth="6.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="75" y2="25" stroke="url(#logo-gradient)" strokeWidth="6.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="15" y2="52" stroke="url(#logo-gradient)" strokeWidth="6.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="85" y2="54" stroke="url(#logo-gradient)" strokeWidth="6.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="43" y2="82" stroke="url(#logo-gradient)" strokeWidth="6.5" strokeLinecap="round" />

      {/* Center Main Circle */}
      <circle cx="50" cy="50" r="16.5" fill="url(#logo-gradient)" stroke={strokeColor} strokeWidth="3" />

      {/* Surrounding Outer Circles */}
      <circle cx="25" cy="25" r="9.5" fill="url(#logo-gradient)" stroke={strokeColor} strokeWidth="2.5" />
      <circle cx="75" cy="25" r="9.5" fill="url(#logo-gradient)" stroke={strokeColor} strokeWidth="2.5" />
      <circle cx="15" cy="52" r="9.5" fill="url(#logo-gradient)" stroke={strokeColor} strokeWidth="2.5" />
      <circle cx="85" cy="54" r="9.5" fill="url(#logo-gradient)" stroke={strokeColor} strokeWidth="2.5" />
      <circle cx="43" cy="82" r="9.5" fill="url(#logo-gradient)" stroke={strokeColor} strokeWidth="2.5" />
    </svg>
  );
}
