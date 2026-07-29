import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RateLimiter } from '@/lib/rate-limiter';

export function proxy(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // 1. CORS Hardening: Validate Origin
  if (origin) {
    const isAllowed = 
      origin === request.nextUrl.origin ||
      origin.startsWith('http://localhost:') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('dudo.site') ||
      origin === 'https://dudo.site';

    if (!isAllowed) {
      return new NextResponse(JSON.stringify({ error: 'CORS policy: Access Denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const { pathname } = request.nextUrl;
  const ip = RateLimiter.getClientIp(request);

  // 2. Rate Limiting Protection
  let limit = 100; // default requests per minute
  const windowMs = 60000; // 1 minute window

  if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/api/auth/')) {
    limit = 10; // Strict limit for auth endpoints
  } else if (pathname.startsWith('/api/playground/chat')) {
    limit = 30; // Limit for AI Chat playground
  } else if (pathname.startsWith('/api/voice/')) {
    limit = 30; // Limit for voice APIs (TTS/STT)
  } else if (pathname.startsWith('/api/webhooks/')) {
    limit = 120; // Webhook rate allowance
  } else if (pathname.startsWith('/api/')) {
    limit = 60; // Standard API limit
  }

  const isLimited = RateLimiter.isRateLimited(ip, limit, windowMs);
  if (isLimited) {
    console.warn(`[Security Rate Limiter] Blocked IP: ${ip} accessing pathname: ${pathname}`);
    return new NextResponse(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '60'
      },
    });
  }

  // 3. Skip CSP for static files and API webhooks
  const isStatic = pathname.startsWith('/_next') || 
                   pathname.includes('.') || 
                   pathname.startsWith('/favicon.ico');
                   
  const isApi = pathname.startsWith('/api/');

  if (isStatic || isApi) {
    return NextResponse.next();
  }

  // 4. Dynamic CSP Nonce Generation for HTML Pages
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const scriptCsp = `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : ""} 'strict-dynamic' https:;`;
  
  const cspHeader = `
    default-src 'self';
    ${scriptCsp}
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*.googleusercontent.com https://firebasestorage.googleapis.com https://*.firebasestorage.app;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com wss://*.firebaseio.com https://api.openai.com https://api.deepgram.com https://api.assemblyai.com https://api.groq.com https://api.anthropic.com https://generativelanguage.googleapis.com https://vitals.vercel-insights.com;
    frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;
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
  return response;
}

export const config = {
  matcher: '/:path*',
};
