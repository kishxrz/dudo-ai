import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { verifyUnsubscribeSignature } from '@/lib/email/queue';
import { DEFAULT_PREFERENCES, UserPreferences } from '@/lib/email/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const signature = searchParams.get('signature');

  if (!email || !signature) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // 1. Verify cryptographic signature
  const isValid = verifyUnsubscribeSignature(email, signature);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
  }

  if (!db) {
    return NextResponse.json({ preferences: DEFAULT_PREFERENCES });
  }

  try {
    // Look up user ID associated with this email
    const usersQ = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
    const usersSnap = await getDocs(usersQ);

    let preferences = DEFAULT_PREFERENCES;
    let isSuppressed = false;

    // Check suppression list
    const suppressSnap = await getDoc(doc(db, 'suppression_list', email.toLowerCase()));
    if (suppressSnap.exists()) {
      isSuppressed = true;
    }

    if (!usersSnap.empty) {
      const userId = usersSnap.docs[0].id;
      const prefSnap = await getDoc(doc(db, 'user_preferences', userId));
      if (prefSnap.exists()) {
        preferences = { ...DEFAULT_PREFERENCES, ...prefSnap.data() } as UserPreferences;
      }
    }

    return NextResponse.json({ 
      success: true, 
      preferences,
      isSuppressed,
      email 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, signature, preferences, unsubscribeAll } = body;

    if (!email || !signature) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const isValid = verifyUnsubscribeSignature(email, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({ success: true });
    }

    // Look up user ID associated with this email
    const usersQ = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
    const usersSnap = await getDocs(usersQ);

    const emailKey = email.toLowerCase();

    if (unsubscribeAll) {
      // 1. Add email to suppression list (hard opt-out)
      await setDoc(doc(db, 'suppression_list', emailKey), {
        email: emailKey,
        unsubscribedAt: new Date().toISOString(),
        reason: 'One-click unsubscribe link'
      });

      // 2. Set all marketing preferences to false for the matched user
      if (!usersSnap.empty) {
        const userId = usersSnap.docs[0].id;
        await setDoc(doc(db, 'user_preferences', userId), {
          productUpdates: false,
          newsletter: false,
          weeklyEducation: false,
          marketingEmails: false,
          featureReleases: false,
        }, { merge: true });
      }
      return NextResponse.json({ success: true, unsubscribed: true });
    }

    // Otherwise, update individual preferences
    if (!usersSnap.empty) {
      const userId = usersSnap.docs[0].id;
      await setDoc(doc(db, 'user_preferences', userId), preferences, { merge: true });
    }

    // Remove from suppression list if they opted back into anything
    const suppressRef = doc(db, 'suppression_list', emailKey);
    const suppressSnap = await getDoc(suppressRef);
    if (suppressSnap.exists()) {
      await deleteDoc(suppressRef);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
