import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null | undefined;
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

export function getAdminDb(): Firestore | null {
  if (cachedDb !== undefined) {
    return cachedDb;
  }

  try {
    if (!getApps().length) {
      if (hasExplicitServiceAccountEnv()) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          }),
        });
      } else if (hasApplicationDefaultEnv()) {
        initializeApp({
          credential: applicationDefault(),
          projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else {
        if (!loggedUnavailable) {
          console.error(
            '[firebase-admin] No admin credentials found. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS.'
          );
          loggedUnavailable = true;
        }
        cachedDb = null;
        return cachedDb;
      }
    }

    cachedDb = getFirestore();
    return cachedDb;
  } catch (error) {
    console.error('[firebase-admin] Failed to initialize Admin SDK:', error);
    cachedDb = null;
    return cachedDb;
  }
}
