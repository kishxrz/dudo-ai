import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';
import { SecurityLogger } from '@/lib/security-logger';

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  const { pathname } = request.nextUrl;
  const ip = RateLimiter.getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // 1. CORS Hardening: Validate Origin (Restrict to production, local, and preview)
  if (origin) {
    const isAllowed = 
      origin === request.nextUrl.origin ||
      origin.startsWith('http://localhost:') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('dudo.site') ||
      origin === 'https://dudo.site';

    if (!isAllowed) {
      SecurityLogger.logEvent({
        eventType: 'permission_denied',
        IP: ip,
        userAgent,
        severity: 'high',
        success: false,
        details: { pathname, attemptedOrigin: origin }
      }).catch(() => {});

      return new NextResponse(JSON.stringify({ error: 'CORS policy: Access Denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle preflight OPTIONS requests directly
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-nonce, x-internal-secret, x-whatsapp-internal-secret',
          'Access-Control-Max-Age': '86400',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }
  }

  // 2. Rate Limiting Throttling
  let limit = 100; // default requests per minute
  const windowMs = 60000; // 1 minute window
  let limiterType = 'general';

  if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/api/auth/')) {
    limit = 10; // Strict limit for auth endpoints
    limiterType = 'auth';
  } else if (pathname.startsWith('/api/playground/chat')) {
    limit = 30; // Limit for AI Chat playground
    limiterType = 'chat';
  } else if (pathname.startsWith('/api/voice/')) {
    limit = 30; // Limit for voice APIs (TTS/STT)
    limiterType = 'voice';
  } else if (pathname.startsWith('/api/webhooks/')) {
    limit = 120; // Webhook rate allowance
    limiterType = 'webhooks';
  } else if (pathname.startsWith('/api/')) {
    limit = 60; // Standard API limit
    limiterType = 'api';
  }

  // Exclude localhost from aggressive limits in development
  const isDev = process.env.NODE_ENV === 'development';
  const isLocalhost = ip === '127.0.0.1' || ip === '::1';
  if (isLocalhost && isDev) {
    limit = 10000;
  }

  const isLimited = RateLimiter.isRateLimited(ip, limit, windowMs, limiterType);
  if (isLimited) {
    console.warn(`[Security Rate Limiter] Blocked IP: ${ip} accessing pathname: ${pathname}`);
    
    // Log rate limit event to the Security Logger
    SecurityLogger.logEvent({
      eventType: 'rate_limit',
      IP: ip,
      userAgent,
      severity: 'medium',
      success: false,
      details: { pathname, limit }
    }).catch(() => {});

    return new NextResponse(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '60'
      },
    });
  }

  // 3. Skip CSP and Cache rules for static assets
  const isStatic = pathname.startsWith('/_next') || 
                   pathname.includes('.') || 
                   pathname.startsWith('/favicon.ico');
                   
  const isApi = pathname.startsWith('/api/');

  if (isStatic) {
    const response = NextResponse.next();
    // Cache static assets immutably
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return response;
  }

  // 4. Cache-Control for Authenticated APIs and Dashboard pages (Prevent Local Caching)
  const isAuthRoute = pathname.startsWith('/dashboard') || (isApi && !pathname.startsWith('/api/webhooks/'));
  
  if (isApi) {
    const response = NextResponse.next();
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    if (isAuthRoute) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    return response;
  }

  // 5. Dynamic CSP Nonce Generation for HTML Pages
  // Note: Using standard crypto module functions in Edge runtime
  const nonce = Buffer.from(globalThis.crypto.randomUUID()).toString('base64');
  const scriptCsp = `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : ""} 'strict-dynamic' https:;`;
  
  // Restricted CSP hosts to eliminate wildcards and secure Google/Firebase resources
  const cspHeader = `
    default-src 'self';
    ${scriptCsp}
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://dodo-ai-agent.firebasestorage.app https://images.unsplash.com;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://speech.googleapis.com https://dodo-ai-agent.firebaseapp.com wss://dodo-ai-agent.firebaseio.com wss://dodo-ai-agent-default-rtdb.firebaseio.com https://api.openai.com https://api.deepgram.com https://api.assemblyai.com https://api.groq.com https://api.anthropic.com https://generativelanguage.googleapis.com https://vitals.vercel-insights.com;
    frame-src 'self' https://accounts.google.com https://dodo-ai-agent.firebaseapp.com;
    object-src 'none';
    base-uri 'self';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', cspHeader);
  
  if (isAuthRoute) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  
  return response;
}

export const config = {
  matcher: '/:path*',
};
