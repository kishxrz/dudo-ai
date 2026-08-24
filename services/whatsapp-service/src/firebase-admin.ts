import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth as getFirebaseAuth, type Auth } from 'firebase-admin/auth';

let cachedDb: Firestore | null = null;
let loggedUnavailable = false;

function hasExplicitServiceAccountEnv(): boolean {
  return !!(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

function hasApplicationDefaultEnv(): boolean {
  return !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT);
}

function formatPrivateKey(key: string): string {
  let k = key.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.replace(/\\n/g, '\n');
}

export function getAdminDb(): Firestore | null {
  if (cachedDb !== null) {
    return cachedDb;
  }

  try {
    if (getApps().length === 0) {
      if (hasExplicitServiceAccountEnv()) {
        const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY!);
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
            privateKey: privateKey,
          }),
        });
        console.log('[firebase-admin] Initialized using explicit service account.');
      } else if (hasApplicationDefaultEnv()) {
        initializeApp({
          credential: applicationDefault(),
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
        });
        console.log('[firebase-admin] Initialized using application default credentials.');
      } else {
        if (!loggedUnavailable) {
          console.error(
            '[firebase-admin] No admin credentials found. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS.'
          );
          loggedUnavailable = true;
        }
        cachedDb = null;
        return null;
      }
    }

    cachedDb = getFirestore();
    return cachedDb;
  } catch (error) {
    console.error('[firebase-admin] Failed to initialize Admin SDK:', error);
    cachedDb = null;
    return null;
  }
}

export function getAuth(): Auth {
  if (getApps().length === 0) {
    getAdminDb();
  }
  return getFirebaseAuth();
}
export type { Firestore, Auth };
