import { db } from '../firebase';
import crypto from 'crypto';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  limit, 
  Timestamp 
} from 'firebase/firestore';

export interface ABTestConfig {
  campaignId: string;
  variantASubject: string;
  variantBSubject: string;
  isActive: boolean;
  promotedVariant?: 'A' | 'B';
}

/**
 * Subject optimization selector based on past open rates.
 */
export async function optimizeSubjectLine(
  templateType: string, 
  defaultSubject: string
): Promise<string> {
  if (!db) return defaultSubject;

  try {
    // Look up past events for this template type to see which subjects performed best
    const q = query(
      collection(db, 'email_queue'),
      where('templateType', '==', templateType),
      where('status', '==', 'sent'),
      limit(50)
    );
    const snap = await getDocs(q);
    if (snap.empty) return defaultSubject;

    const subjectStats: Record<string, { sent: number; opens: number }> = {};

    for (const d of snap.docs) {
      const data = d.data();
      const subject = data.subject || defaultSubject;
      if (!subjectStats[subject]) {
        subjectStats[subject] = { sent: 0, opens: 0 };
      }
      subjectStats[subject].sent++;
    }

    // Query opens for these queue IDs
    const queueIds = snap.docs.map(d => d.id);
    // Batch query opens in chunks of 10 (Firestore limit for 'in' query)
    const openStats: Record<string, number> = {};
    const eventsCol = collection(db, 'email_events');

    for (let i = 0; i < queueIds.length; i += 10) {
      const chunk = queueIds.slice(i, i + 10);
      const openQ = query(eventsCol, where('queueId', 'in', chunk), where('eventType', '==', 'open'));
      const openSnap = await getDocs(openQ);
      openSnap.forEach(ev => {
        const evData = ev.data();
        openStats[evData.queueId] = (openStats[evData.queueId] || 0) + 1;
      });
    }

    // Correlate opens back to subjects
    for (const d of snap.docs) {
      const data = d.data();
      const subject = data.subject || defaultSubject;
      if (openStats[d.id]) {
        subjectStats[subject].opens += openStats[d.id];
      }
    }

    // Find subject with highest open rate
    let bestSubject = defaultSubject;
    let highestRate = -1;

    for (const [subj, stats] of Object.entries(subjectStats)) {
      if (stats.sent >= 5) { // Minimum sample size
        const rate = stats.opens / stats.sent;
        if (rate > highestRate) {
          highestRate = rate;
          bestSubject = subj;
        }
      }
    }

    return bestSubject;
  } catch (err) {
    console.warn('[Subject Optimizer] Failed to run statistics optimization, returning default:', err);
    return defaultSubject;
  }
}

/**
 * Assigns A/B test variant and subject line to a queued email.
 */
export async function assignABTest(
  userId: string, 
  templateType: string, 
  defaultSubject: string
): Promise<{ variant: 'A' | 'B'; subject: string }> {
  if (!db) return { variant: 'A', subject: defaultSubject };

  try {
    // Look for an active A/B test for this template type
    const testQ = query(
      collection(db, 'ab_tests'),
      where('campaignId', '==', templateType),
      where('isActive', '==', true),
      limit(1)
    );
    const snap = await getDocs(testQ);

    if (snap.empty) {
      // No active A/B test configuration found, return default
      return { variant: 'A', subject: defaultSubject };
    }

    const test = snap.docs[0].data() as ABTestConfig;

    // If a variant was already permanently promoted, return it
    if (test.promotedVariant) {
      const subject = test.promotedVariant === 'A' ? test.variantASubject : test.variantBSubject;
      return { variant: test.promotedVariant, subject };
    }

    // Split users randomly based on their user ID hash to keep assignment sticky
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const lastChar = hash.charAt(hash.length - 1);
    const charCode = parseInt(lastChar, 16);
    const variant: 'A' | 'B' = charCode % 2 === 0 ? 'A' : 'B';

    const subject = variant === 'A' ? test.variantASubject : test.variantBSubject;
    return { variant, subject };

  } catch (err) {
    console.warn('[A/B Test Engine] Failed to assign variant, returning variant A:', err);
    return { variant: 'A', subject: defaultSubject };
  }
}
