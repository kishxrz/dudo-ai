import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  setDoc,
  doc, 
  deleteDoc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';

export async function GET(req: NextRequest) {
  if (!db) return NextResponse.json({ subscribers: [] });

  try {
    const snap = await getDocs(collection(db, 'newsletter_subscribers'));
    const subscribers = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      subscribedAt: d.data().subscribedAt?.toDate ? d.data().subscribedAt.toDate().toISOString() : d.data().subscribedAt
    }));

    return NextResponse.json({ success: true, subscribers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!db) return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });

  try {
    const body = await req.json();
    const { action, email, name, subscribersList } = body;

    // Standard Landing Page Subscribe Action
    if (action === 'subscribe') {
      if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
      const emailKey = email.toLowerCase().trim();

      await setDoc(doc(db, 'newsletter_subscribers', emailKey), {
        email: emailKey,
        name: name || 'Dudo Subscriber',
        subscribedAt: Timestamp.now(),
        source: 'landing_page'
      });

      return NextResponse.json({ success: true });
    }

    // Admin Bulk Import Action
    if (action === 'import') {
      if (!Array.isArray(subscribersList)) {
        return NextResponse.json({ error: 'subscribersList must be an array' }, { status: 400 });
      }

      let count = 0;
      for (const item of subscribersList) {
        if (item.email) {
          const emailKey = item.email.toLowerCase().trim();
          await setDoc(doc(db, 'newsletter_subscribers', emailKey), {
            email: emailKey,
            name: item.name || 'Dudo Subscriber',
            subscribedAt: Timestamp.now(),
            source: 'admin_import'
          });
          count++;
        }
      }

      return NextResponse.json({ success: true, imported: count });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!db) return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    const emailKey = email.toLowerCase().trim();
    await deleteDoc(doc(db, 'newsletter_subscribers', emailKey));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
