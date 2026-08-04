import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore';

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const queueId = searchParams.get('id');

  if (!queueId) {
    return NextResponse.json({ error: 'Missing email tracking ID' }, { status: 400 });
  }

  // Resolve headers for IP and user-agent details
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (action === 'open') {
    if (db) {
      try {
        // Fetch original queue details to obtain userId/templateType
        const queueSnap = await getDoc(doc(db, 'email_queue', queueId));
        if (queueSnap.exists()) {
          const qData = queueSnap.data();
          await addDoc(collection(db, 'email_events'), {
            queueId,
            userId: qData.userId || 'unknown',
            email: qData.to,
            templateType: qData.templateType,
            eventType: 'open',
            ip,
            userAgent,
            timestamp: Timestamp.now()
          });
        }
      } catch (err) {
        console.error('[Tracking Open Failed]', err);
      }
    }

    // Return the transparent tracking pixel
    return new NextResponse(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  }

  if (action === 'click') {
    const destinationUrl = searchParams.get('url') || '/dashboard';

    if (db) {
      try {
        const queueSnap = await getDoc(doc(db, 'email_queue', queueId));
        if (queueSnap.exists()) {
          const qData = queueSnap.data();
          await addDoc(collection(db, 'email_events'), {
            queueId,
            userId: qData.userId || 'unknown',
            email: qData.to,
            templateType: qData.templateType,
            eventType: 'click',
            destinationUrl,
            ip,
            userAgent,
            timestamp: Timestamp.now()
          });
        }
      } catch (err) {
        console.error('[Tracking Click Failed]', err);
      }
    }

    // Perform redirect to original destination
    return NextResponse.redirect(new URL(destinationUrl, req.url));
  }

  return NextResponse.json({ error: 'Invalid tracking action' }, { status: 400 });
}
