import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // We passed workspaceId or workspaceId:scope in state

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state/workspaceId' }, { status: 400 });
    }

    let workspaceId = state;
    let initialScope = '';
    if (state.includes(':')) {
      const parts = state.split(':');
      workspaceId = parts[0];
      initialScope = parts[1];
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info (email)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || '';

    // Save tokens and integration state to Firestore
    const adminDb = getAdminDb();
    
    // Retrieve existing scopes if any
    let existingScopes: string[] = [];
    if (adminDb) {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).get();
      if (snap.exists) {
        const d = snap.data();
        if (d?.status === 'connected') {
          existingScopes = d?.scopes || [];
        }
      }
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'));
      if (snap.exists()) {
        const d = snap.data();
        if (d?.status === 'connected') {
          existingScopes = d?.scopes || [];
        }
      }
    }

    const newScopes = initialScope ? [initialScope] : ['gmail', 'calendar', 'sheets', 'drive', 'docs'];
    const mergedScopes = Array.from(new Set([...existingScopes, ...newScopes]));

    const payload = {
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
      expiryDate: tokens.expiry_date || null,
      email,
      connectedAt: adminDb ? new Date() : serverTimestamp(),
      scopes: mergedScopes,
      status: 'connected',
    };

    if (adminDb) {
      // Admin SDK write
      await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).set(payload, { merge: true });
      await adminDb.collection(`workspaces/${workspaceId}/integrations/google/logs`).add({
        action: 'connect',
        email,
        timestamp: new Date(),
      });
    } else if (db) {
      // Client SDK write
      await setDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'), payload, { merge: true });
      await addDoc(collection(db, 'workspaces', workspaceId, 'integrations', 'google', 'logs'), {
        action: 'connect',
        email,
        timestamp: serverTimestamp(),
      });
    }

    // Redirect to integration page with success status
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    return NextResponse.redirect(`${baseUrl}/dashboard/integration?success=true`);
  } catch (err: any) {
    console.error('Error in Google callback route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
