import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { generateWeeklyNewsletter } from '@/lib/email/newsletter-generator';
import { queueEmail } from '@/lib/email/queue';

export async function POST(req: NextRequest) {
  if (!db) {
    return NextResponse.json({ error: 'Firestore not configured' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const isDraft = searchParams.get('draft') === 'true';

    // 1. Generate weekly newsletter (either LLM or rotation mock)
    const content = await generateWeeklyNewsletter();

    if (isDraft) {
      return NextResponse.json({ success: true, ...content });
    }

    // 2. Fetch all active subscribers from newsletter_subscribers
    const subscribersCol = collection(db, 'newsletter_subscribers');
    const subscribersSnap = await getDocs(subscribersCol);

    const queuedEmails: string[] = [];

    // Loop through and queue the newsletter
    for (const d of subscribersSnap.docs) {
      const data = d.data();
      const email = data.email;
      const name = data.name || 'Dudo Subscriber';
      const userId = data.userId || 'subscriber-guest';

      // Unique dedup key for this specific newsletter topic/date
      const dedupKey = `newsletter_${content.topic}_${email}_${new Date().toISOString().substring(0, 10)}`;

      const queueId = await queueEmail({
        userId,
        email,
        name,
        templateType: 'newsletter-thurs',
        extraData: content,
        dedupKey
      });

      if (queueId) {
        queuedEmails.push(email);
      }
    }

    return NextResponse.json({
      success: true,
      topic: content.topic,
      title: content.title,
      subscribersTargeted: subscribersSnap.size,
      queuedSuccessfully: queuedEmails.length,
      emails: queuedEmails
    });
  } catch (err: any) {
    console.error('[Cron Newsletter Failed]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
