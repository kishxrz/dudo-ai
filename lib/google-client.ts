import { google } from 'googleapis';
import { getAdminDb } from './firebase-admin';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { canUseFeature } from './billing-entitlements-server';

export async function getGoogleClient(workspaceId: string, requiredScope?: string) {
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

  let docName = 'googleIdentity';
  if (requiredScope === 'gmail') docName = 'gmailIntegration';
  else if (requiredScope === 'calendar') docName = 'calendarIntegration';
  else if (requiredScope === 'drive') docName = 'driveIntegration';
  else if (requiredScope === 'docs') docName = 'docsIntegration';
  else if (requiredScope === 'sheets') docName = 'sheetsIntegration';

  if (adminDb) {
    const docRef = adminDb.doc(`workspaces/${workspaceId}/integrations/${docName}`);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Google ${requiredScope || 'identity'} integration not connected`);
    const data = snap.data();
    accessToken = data?.accessToken || '';
    refreshToken = data?.refreshToken || '';
    expiryDate = data?.expiresAt || data?.expiryDate || null;
    email = data?.email || '';
    scopes = data?.grantedScopes || data?.scopes || [];
    status = data?.connected ? 'connected' : (data?.status || '');
  } else if (db) {
    const docRef = doc(db, 'workspaces', workspaceId, 'integrations', docName);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error(`Google ${requiredScope || 'identity'} integration not connected`);
    const data = snap.data();
    accessToken = data?.accessToken || '';
    refreshToken = data?.refreshToken || '';
    expiryDate = data?.expiresAt || data?.expiryDate || null;
    email = data?.email || '';
    scopes = data?.grantedScopes || data?.scopes || [];
    status = data?.connected ? 'connected' : (data?.status || '');
  }

  if (status !== 'connected' || !accessToken || !refreshToken) {
    throw new Error(`Google ${requiredScope || 'identity'} integration not connected`);
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
    console.log(`[Google Client] Token for ${docName} expired or expiring soon, refreshing...`);
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;
      const newExpiryDate = credentials.expiry_date || (Date.now() + 3500 * 1000);

      if (newAccessToken) {
        console.log(`[Google Client] Token refreshed successfully for ${docName}, saving to Firestore...`);
        const updatePayload = {
          accessToken: newAccessToken,
          expiresAt: newExpiryDate,
          expiryDate: newExpiryDate,
          lastSync: new Date()
        };
        if (adminDb) {
          await adminDb.doc(`workspaces/${workspaceId}/integrations/${docName}`).update(updatePayload);
        } else if (db) {
          await updateDoc(doc(db, 'workspaces', workspaceId, 'integrations', docName), updatePayload);
        }
        oauth2Client.setCredentials({
          access_token: newAccessToken,
          refresh_token: refreshToken,
          expiry_date: newExpiryDate
        });
      }
    } catch (refreshErr) {
      console.error(`[Google Client] Failed to refresh access token for ${docName}:`, refreshErr);
      throw new Error('Google connection expired. Please reconnect.');
    }
  }

  return oauth2Client;
}
