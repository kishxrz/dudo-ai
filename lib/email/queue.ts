import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import { generateHtmlEmail } from './templates';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Cryptographic hash helper for secure public unsubscribes
import crypto from 'crypto';

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || 'dudo-unsubscribe-secret-key-123';

export function getUnsubscribeSignature(email: string): string {
  return crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(email).digest('hex');
}

export function verifyUnsubscribeSignature(email: string, signature: string): boolean {
  try {
    const expected = getUnsubscribeSignature(email);
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

import { UserPreferences, DEFAULT_PREFERENCES } from './types';

// Check if a template type is considered promotional/marketing
export function isPromotionalTemplate(templateType: string): boolean {
  const systemTypes = ['auth-verify', 'password-reset', 'billing-failed', 'billing-success', 'security-lockout', 'security-takeover'];
  return !systemTypes.includes(templateType);
}

// Map template type to preference field
export function getPreferenceFieldForTemplate(templateType: string): keyof UserPreferences {
  if (templateType.startsWith('onboarding-') || templateType.startsWith('trial-') || templateType === 'pricing-abandon' || templateType === 'founder-pricing') {
    return 'marketingEmails';
  }
  if (templateType === 'weekly-education') {
    return 'weeklyEducation';
  }
  if (templateType === 'feature-launch') {
    return 'featureReleases';
  }
  if (templateType === 'monthly-changelog') {
    return 'productUpdates';
  }
  if (templateType === 'newsletter-thurs') {
    return 'newsletter';
  }
  return 'marketingEmails';
}

/**
 * Queues an email into the database queue.
 * Implements deduplication, subscription checks, and scheduling.
 */
export async function queueEmail(params: {
  userId: string;
  email: string;
  name: string;
  templateType: string;
  extraData?: any;
  scheduledAt?: Date;
  dedupKey?: string;
}): Promise<string | null> {
  const { userId, email, name, templateType, extraData = {}, scheduledAt, dedupKey } = params;

  if (!db) {
    console.warn('Firestore database is not configured. Email queue skipped.');
    return null;
  }

  // 1. Enforce deduplication check
  const activeDedupKey = dedupKey || `${userId}_${templateType}`;
  const queueCol = collection(db, 'email_queue');

  // Check if already queued/sent
  const dupQuery = query(queueCol, where('dedupKey', '==', activeDedupKey));
  const dupSnap = await getDocs(dupQuery);
  if (!dupSnap.empty) {
    console.log(`[Queue] Deduplication triggered for key: ${activeDedupKey}. Skipped.`);
    return null;
  }

  // 2. Fetch user preferences to check opt-outs
  const prefRef = doc(db, 'user_preferences', userId);
  const prefSnap = await getDoc(prefRef);
  const preferences: UserPreferences = prefSnap.exists() 
    ? { ...DEFAULT_PREFERENCES, ...prefSnap.data() } 
    : DEFAULT_PREFERENCES;

  // Check suppression list
  const suppressRef = doc(db, 'suppression_list', email.toLowerCase());
  const suppressSnap = await getDoc(suppressRef);
  if (suppressSnap.exists()) {
    console.log(`[Queue] Email ${email} is on the suppression list. Skipped.`);
    return null;
  }

  // Verify preference
  if (isPromotionalTemplate(templateType)) {
    const prefField = getPreferenceFieldForTemplate(templateType);
    if (!preferences[prefField]) {
      console.log(`[Queue] User ${userId} unsubscribed from ${prefField}. Skipped.`);
      return null;
    }
  }

  // 3. Create document in queue
  const scheduledTime = scheduledAt || new Date();
  const queueDoc = {
    userId,
    to: email,
    name,
    templateType,
    extraData,
    status: 'pending',
    attempts: 0,
    maxAttempts: 3,
    scheduledAt: Timestamp.fromDate(scheduledTime),
    createdAt: Timestamp.now(),
    dedupKey: activeDedupKey,
    subject: '', // Populated on generate
  };

  const docRef = await addDoc(queueCol, queueDoc);
  console.log(`[Queue] Email successfully queued. ID: ${docRef.id}`);
  return docRef.id;
}

/**
 * Triggers lifecycle events for a user, adding relevant sequences to the queue.
 */
export async function triggerLifecycleEvent(
  userId: string, 
  eventName: string, 
  payload: { email: string; name: string; extraData?: any }
): Promise<void> {
  const { email, name, extraData = {} } = payload;
  const userTimezone = extraData.timezone || 'Asia/Kolkata';

  console.log(`[Lifecycle Engine] Event triggered: "${eventName}" for User: ${userId}`);

  // Base schedule offsets helper
  const scheduleOffset = (days: number, hourOfDay = 9): Date => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hourOfDay, 0, 0, 0);
    return d;
  };

  if (eventName === 'signup') {
    // 1. Immediately send Verification Email
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'auth-verify',
      extraData,
      dedupKey: `${userId}_verify_${Date.now()}` // Bypass deduplication check for verification
    });

    // 2. Queue Welcome & Onboarding sequence
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'onboarding-welcome',
      extraData
    });

    // Day 1: WhatsApp Setup (scheduled for 24h later)
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'onboarding-day1',
      extraData,
      scheduledAt: scheduleOffset(1)
    });

    // Day 2: Telegram Setup
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'onboarding-day2',
      extraData,
      scheduledAt: scheduleOffset(2)
    });

    // Day 3: Personality Crafting
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'onboarding-day3',
      extraData,
      scheduledAt: scheduleOffset(3)
    });

    // Day 5: Knowledge Base
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'onboarding-day5',
      extraData,
      scheduledAt: scheduleOffset(5)
    });

    // Day 7: Final Checklist
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'onboarding-day7',
      extraData,
      scheduledAt: scheduleOffset(7)
    });

  } else if (eventName === 'google_login_first') {
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'google-welcome',
      extraData
    });

  } else if (eventName === 'trial_started') {
    // Queue trial alerts
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'trial-started',
      extraData
    });

    // 5 Days Remaining (9 days later)
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'trial-5days',
      extraData,
      scheduledAt: scheduleOffset(9)
    });

    // 3 Days Remaining (11 days later)
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'trial-3days',
      extraData,
      scheduledAt: scheduleOffset(11)
    });

    // 24h Remaining (13 days later)
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'trial-24h',
      extraData,
      scheduledAt: scheduleOffset(13)
    });

    // 4h Remaining (13 days + 20 hours later)
    const fourHourAlert = new Date();
    fourHourAlert.setDate(fourHourAlert.getDate() + 13);
    fourHourAlert.setHours(fourHourAlert.getHours() + 20);
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'trial-4h',
      extraData,
      scheduledAt: fourHourAlert
    });

  } else if (eventName === 'upgrade') {
    // 1. Cancel all pending trial sequences
    await cancelPendingEmails(userId, ['trial-5days', 'trial-3days', 'trial-24h', 'trial-4h', 'trial-expired']);
    
    // 2. Send Billing Upgrade success email
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'billing-success',
      extraData,
      dedupKey: `${userId}_upgrade_${Date.now()}`
    });

  } else if (eventName === 'trial_expired') {
    await queueEmail({
      userId,
      email,
      name,
      templateType: 'trial-expired',
      extraData
    });
  } else if (eventName === 'onboarding_complete') {
    // Pause onboarding emails
    await cancelPendingEmails(userId, ['onboarding-day1', 'onboarding-day2', 'onboarding-day3', 'onboarding-day5', 'onboarding-day7']);
  }
}

/**
 * Cancels/removes pending emails matching template types for a specific user.
 */
export async function cancelPendingEmails(userId: string, templates: string[]): Promise<void> {
  if (!db) return;
  const queueCol = collection(db, 'email_queue');
  
  for (const t of templates) {
    const q = query(queueCol, where('userId', '==', userId), where('templateType', '==', t), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'email_queue', d.id), {
        status: 'cancelled',
        cancelledAt: Timestamp.now()
      });
    }
  }
  console.log(`[Queue] Cancelled pending templates [${templates.join(', ')}] for User ${userId}`);
}

/**
 * Processes pending items in the email queue.
 * Integrates SMTP / local fallback logs.
 */
export async function processQueue(batchSize = 10): Promise<{ processed: number; sent: number; failed: number }> {
  if (!db) return { processed: 0, sent: 0, failed: 0 };

  const queueCol = collection(db, 'email_queue');
  const now = new Date();
  
  // Query pending emails using basic status equality filter (does not require composite index)
  const q = query(
    queueCol,
    where('status', '==', 'pending')
  );

  const snap = await getDocs(q);
  
  // Filter for items scheduled now or in the past, and sort them ascending
  const mappedItems = snap.docs.map(document => {
    const data = document.data();
    const scheduledDate = data.scheduledAt?.toDate ? data.scheduledAt.toDate() : new Date(data.scheduledAt);
    return { document, scheduledDate, schedTime: scheduledDate.getTime() };
  });

  const filteredItems = mappedItems.filter(item => item.schedTime <= now.getTime());
  filteredItems.sort((a, b) => a.schedTime - b.schedTime);

  // Apply batchSize limit
  const batchDocs = filteredItems.slice(0, batchSize).map(item => item.document);

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const document of batchDocs) {
    processed++;
    const queueId = document.id;
    const emailData = document.data();
    const { userId, to, name, templateType, extraData = {}, attempts, maxAttempts } = emailData;

    try {
      // 1. Verify user preferences one final time in case of dynamic opt-outs
      const prefRef = doc(db, 'user_preferences', userId);
      const prefSnap = await getDoc(prefRef);
      const preferences: UserPreferences = prefSnap.exists() 
        ? { ...DEFAULT_PREFERENCES, ...prefSnap.data() } 
        : DEFAULT_PREFERENCES;

      // Verify suppression list
      const suppressRef = doc(db, 'suppression_list', to.toLowerCase());
      const suppressSnap = await getDoc(suppressRef);
      if (suppressSnap.exists()) {
        await updateDoc(doc(db, 'email_queue', queueId), {
          status: 'suppressed',
          suppressedAt: Timestamp.now(),
          error: 'Address is in suppression list'
        });
        continue;
      }

      if (isPromotionalTemplate(templateType)) {
        const prefField = getPreferenceFieldForTemplate(templateType);
        if (!preferences[prefField]) {
          await updateDoc(doc(db, 'email_queue', queueId), {
            status: 'unsubscribed',
            unsubscribedAt: Timestamp.now(),
            error: `User opted out of ${prefField}`
          });
          continue;
        }
      }

      // 2. Generate template content
      const unsubSignature = getUnsubscribeSignature(to);
      const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const unsubscribeUrl = `${host}/email-preferences?email=${encodeURIComponent(to)}&signature=${unsubSignature}`;
      const preferencesUrl = `${host}/dashboard/agent?tab=email-preferences`;

      const { subject, html } = generateHtmlEmail(templateType, name, unsubscribeUrl, preferencesUrl, extraData);

      // Inject open tracking pixel at the bottom of the body
      const openPixel = `<img src="${host}/api/email/track?action=open&id=${queueId}" width="1" height="1" alt="" style="display:none;" />`;
      const htmlWithTracking = html.replace('</body>', `${openPixel}</body>`);

      // 3. Send email using SMTP transporter or log locally in development
      const smtpPass = process.env.SUPPORT_EMAIL_PASS;
      const smtpUser = process.env.SUPPORT_EMAIL_USER || 'dudosupport@gmail.com';

      if (smtpPass) {
        // Production SMTP Send
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass }
        });

        const isPromo = isPromotionalTemplate(templateType);
        const headers: Record<string, string> = {
          'Message-ID': `<${queueId}-${Date.now()}@dudo.ai>`,
          'X-Entity-Ref-ID': queueId,
        };

        if (isPromo) {
          headers['List-Unsubscribe'] = `<${unsubscribeUrl}>, <mailto:${smtpUser}?subject=unsubscribe>`;
          headers['Precedence'] = 'bulk';
        } else {
          headers['Precedence'] = 'transactional';
        }

        await transporter.sendMail({
          from: `"Dudo AI" <${smtpUser}>`,
          to,
          subject,
          html: htmlWithTracking,
          text: `Hi ${name},\n\nWe sent an update: "${subject}". Please open this email in a client that supports HTML to view the details.\n\nBest,\nThe Dudo Team\n\nTo manage preferences: ${unsubscribeUrl}`,
          headers
        });
      } else {
        // Local fallback: Print to email filesystem log for dev validation
        const logDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        const logPath = path.join(logDir, 'dev-emails.log');
        const logEntry = `\n========================================\n` +
                          `TIMESTAMP: ${new Date().toISOString()}\n` +
                          `QUEUE ID: ${queueId}\n` +
                          `TO: ${to} (${name})\n` +
                          `SUBJECT: ${subject}\n` +
                          `TEMPLATE: ${templateType}\n` +
                          `UNSUBSCRIBE URL: ${unsubscribeUrl}\n` +
                          `----------------------------------------\n` +
                          `${htmlWithTracking}\n` +
                          `========================================\n`;
        fs.appendFileSync(logPath, logEntry);
        console.log(`[Dev Transporter] Printed email to dev-emails.log: ${subject}`);
      }

      // 4. Update status to sent
      await updateDoc(doc(db, 'email_queue', queueId), {
        status: 'sent',
        sentAt: Timestamp.now(),
        attempts: attempts + 1,
        subject
      });

      // Record event delivery
      await addDoc(collection(db, 'email_events'), {
        queueId,
        userId,
        email: to,
        templateType,
        eventType: 'delivered',
        timestamp: Timestamp.now(),
      });

      sent++;

    } catch (err: any) {
      console.error(`[Queue Processing Error] Failed to send queue id: ${queueId}`, err);
      failed++;
      const nextAttempt = attempts + 1;
      const isFailedPermanently = nextAttempt >= maxAttempts;

      await updateDoc(doc(db, 'email_queue', queueId), {
        status: isFailedPermanently ? 'failed' : 'pending',
        attempts: nextAttempt,
        failedAt: Timestamp.now(),
        error: err.message || err.toString()
      });

      // Record failed event
      await addDoc(collection(db, 'email_events'), {
        queueId,
        userId,
        email: to,
        templateType,
        eventType: 'bounce',
        timestamp: Timestamp.now(),
        error: err.message || err.toString()
      });
    }
  }

  return { processed, sent, failed };
}
