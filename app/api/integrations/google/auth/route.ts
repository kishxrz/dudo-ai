import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { canUseFeature } from '@/lib/billing-entitlements-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const scope = searchParams.get('scope') || '';

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const allowed = await canUseFeature(workspaceId, 'booking');
    if (!allowed) {
      return NextResponse.redirect(new URL('/dashboard/integration?error=upgrade_required', req.url));
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopeParam = scope || 'identity';
    let requestedScopes: string[] = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    if (scopeParam === 'gmail') {
      requestedScopes.push('https://www.googleapis.com/auth/gmail.modify');
    } else if (scopeParam === 'calendar') {
      requestedScopes.push('https://www.googleapis.com/auth/calendar');
    } else if (scopeParam === 'sheets') {
      requestedScopes.push('https://www.googleapis.com/auth/spreadsheets');
    } else if (scopeParam === 'drive') {
      requestedScopes.push('https://www.googleapis.com/auth/drive');
    } else if (scopeParam === 'docs') {
      requestedScopes.push('https://www.googleapis.com/auth/documents');
    }

    const state = `${workspaceId}:${scopeParam}`;

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: requestedScopes,
      state: state,
      include_granted_scopes: true,
    });

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('Error in Google Auth Route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
