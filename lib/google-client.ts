import { google } from 'googleapis';
import { getAdminDb } from './firebase-admin';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function getGoogleClient(workspaceId: string, requiredScope?: string) {
  const { canUseFeature } = require('./billing-entitlements-server');
  const allowed = await canUseFeature(workspaceId, 'booking');
  if (!allowed) {
    throw new Error('Upgrade required: Google Calendar/Booking integrations are not allowed on your current plan.');
  }

  const adminDb = getAdminDb();
  let accessToken = '';
  let refreshToken = '';
  let expiryDate: number | null = null;
  let email = '';
  let scopes: string[] = [];
  let status = '';

  if (adminDb) {
    const docRef = adminDb.doc(`workspaces/${workspaceId}/integrations/google`);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('Google integration not connected');
    const data = snap.data();
    accessToken = data?.accessToken || '';
    refreshToken = data?.refreshToken || '';
    expiryDate = data?.expiryDate || null;
    email = data?.email || '';
    scopes = data?.scopes || [];
    status = data?.status || '';
  } else if (db) {
    const docRef = doc(db, 'workspaces', workspaceId, 'integrations', 'google');
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Google integration not connected');
    const data = snap.data();
    accessToken = data?.accessToken || '';
    refreshToken = data?.refreshToken || '';
    expiryDate = data?.expiryDate || null;
    email = data?.email || '';
    scopes = data?.scopes || [];
    status = data?.status || '';
  }

  if (status !== 'connected' || !accessToken || !refreshToken) {
    throw new Error('Google integration not connected');
  }

  if (requiredScope && !scopes.includes(requiredScope)) {
    throw new Error(`Google ${requiredScope} integration is not connected`);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate || undefined
  });

  // Check if token is expired or close to expiring (within 2 minutes)
  const now = Date.now();
  if (!expiryDate || now >= expiryDate - 120000) {
    console.log('[Google Client] Token expired or expiring soon, refreshing...');
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;
      const newExpiryDate = credentials.expiry_date || (Date.now() + 3500 * 1000);

      if (newAccessToken) {
        console.log('[Google Client] Token refreshed successfully, saving to Firestore...');
        if (adminDb) {
          await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).update({
            accessToken: newAccessToken,
            expiryDate: newExpiryDate
          });
        } else if (db) {
          await updateDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'), {
            accessToken: newAccessToken,
            expiryDate: newExpiryDate
          });
        }
        oauth2Client.setCredentials({
          access_token: newAccessToken,
          refresh_token: refreshToken,
          expiry_date: newExpiryDate
        });
      }
    } catch (refreshErr) {
      console.error('[Google Client] Failed to refresh access token:', refreshErr);
      throw new Error('Google connection expired. Please reconnect.');
    }
  }

  return oauth2Client;
}
