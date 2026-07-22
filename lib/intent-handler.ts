import { getAdminDb } from './firebase-admin';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { parseDateTime } from './date-parser';
import { getGoogleClient } from './google-client';
import { google } from 'googleapis';

function cleanName(rawName: string): string {
  let cleaned = rawName.trim();
  const prefixRegex = /^(?:is\s+|Name\s+is\s+|name\s+is\s+|lead\s+|a\s+new\s+lead:\s*)+/i;
  cleaned = cleaned.replace(prefixRegex, '');
  return cleaned.trim();
}

function extractInterest(message: string): string {
  const msgLower = message.toLowerCase();
  let extracted = message;
  
  const triggers = [
    "interested in", "want to order", "looking for", "need a",
    "price of", "how much for", "how much does", "how much", "cost of", "tell me about",
    "i want to order", "i want", "can i get", "do you have",
    "add to sheet", "save lead", "record", "log", "lead"
  ];

  for (const t of triggers) {
    const idx = msgLower.indexOf(t);
    if (idx !== -1) {
      extracted = message.substring(idx + t.length).trim();
      break;
    }
  }

  // Remove common stop words including time and preposition terms
  const stopWordsRegex = /\b(i|want|a|an|the|to|order|get|need|buy|please|does|cost|for|of|lead|tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|week|morning|evening|afternoon|night|am|pm|at|by|on|from)\b/gi;
  let cleaned = extracted.replace(stopWordsRegex, '').replace(/\s+/g, ' ').trim();
  
  cleaned = cleaned.replace(/[.,?!:;?]+$/, '').trim();
  return cleaned;
}

export async function handleIntent(
  workspaceId: string,
  userMessage: string,
  channel?: string,
  senderName?: string,
  permittedTools?: string[]
): Promise<{ actionTaken: boolean; actionResult: string } | null> {
  // Check if Google is connected for this workspace
  let isConnected = false;
  const adminDb = getAdminDb();
  try {
    if (adminDb) {
      const docRef = adminDb.doc(`workspaces/${workspaceId}/integrations/google`);
      const snap = await docRef.get();
      if (snap.exists && snap.data()?.status === 'connected') {
        isConnected = true;
      }
    } else if (db) {
      const docRef = doc(db, 'workspaces', workspaceId, 'integrations', 'google');
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data()?.status === 'connected') {
        isConnected = true;
      }
    }
  } catch (e) {
    console.error('[intent-handler] Error checking Google integration:', e);
    return null;
  }

  if (!isConnected) {
    return null;
  }

  const isToolPermitted = (toolName: string) => {
    if (!permittedTools) return true; // fallback
    return permittedTools.includes(toolName);
  };

  const msgLower = userMessage.toLowerCase();

  // CALENDAR intents:
  // Keywords: "appointment", "book appointment", "schedule appointment", "when can I visit", "can I come", "want to visit", "consultation", "meeting", "come to your shop", "book a slot", "reserve a time"
  const calendarKeywords = [
    "appointment",
    "book appointment",
    "schedule appointment",
    "when can i visit",
    "can i come",
    "want to visit",
    "consultation",
    "meeting",
    "come to your shop",
    "book a slot",
    "reserve a time"
  ];

  // Guard: Skip Calendar entirely if any sheets/order keywords are present
  const orderKeywords = ["want to order", "i want", "looking for", "interested in", "how much", "price"];
  const hasOrderIntent = orderKeywords.some(k => msgLower.includes(k));

  const isCalendar = !hasOrderIntent && calendarKeywords.some(k => msgLower.includes(k));

  if (isCalendar) {
    if (!isToolPermitted('google-calendar')) {
      console.log('[intent-handler] Calendar blocked by skill permissions');
      return null;
    }
    const parsed = parseDateTime(userMessage);
    const baseUrl = process.env.INTERNAL_API_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    try {
      const res = await fetch(`${baseUrl}/api/integrations/google/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: parsed.title,
          date: parsed.date,
          time: parsed.time,
        }),
      });

      if (!res.ok) {
        console.error('Calendar integration error:', await res.text());
        return null;
      }

      return {
        actionTaken: true,
        actionResult: `[BACKGROUND: Appointment created in calendar]`,
      };
    } catch (e) {
      console.error('Calendar execution failed:', e);
      return null;
    }
  }

  // GMAIL intents:
  // Keywords: "send email", "email to", "mail to"
  // Keep them working as explicit triggers
  const gmailKeywords = ["send email", "email to", "mail to"];
  const isGmail = gmailKeywords.some(k => msgLower.includes(k));

  if (isGmail) {
    if (!isToolPermitted('gmail')) {
      console.log('[intent-handler] Gmail blocked by skill permissions');
      return null;
    }
    // Extract: to, subject, body from message
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = userMessage.match(emailRegex);
    const to = emailMatch ? emailMatch[0] : 'dudosupport@gmail.com';

    let subject = 'Message from Assistant';
    let body = userMessage;

    const subjectIndex = msgLower.indexOf('subject');
    const bodyIndex = msgLower.indexOf('body');

    if (subjectIndex !== -1) {
      if (bodyIndex !== -1 && bodyIndex > subjectIndex) {
        subject = userMessage.substring(subjectIndex + 7, bodyIndex).trim();
        body = userMessage.substring(bodyIndex + 4).trim();
      } else {
        subject = userMessage.substring(subjectIndex + 7).trim();
      }
    } else if (bodyIndex !== -1) {
      body = userMessage.substring(bodyIndex + 4).trim();
    }

    subject = subject.replace(/^[:\s\-]+/, '').trim() || 'Message from Assistant';
    body = body.replace(/^[:\s\-]+/, '').trim();

    const baseUrl = process.env.INTERNAL_API_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    try {
      const res = await fetch(`${baseUrl}/api/integrations/google/gmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          to,
          subject,
          body,
        }),
      });

      if (!res.ok) {
        console.error('Gmail integration error:', await res.text());
        return null;
      }

      return {
        actionTaken: true,
        actionResult: `✅ Email sent to ${to}`,
      };
    } catch (e) {
      console.error('Gmail execution failed:', e);
      return null;
    }
  }

  // SHEETS intents:
  // Trigger when customer shows interest: interested in, want to order, looking for, need a, price of, how much, cost of, tell me about, I want, can I get, do you have
  // Keep original sheets keywords: log, record, add to sheet, save lead
  const sheetsKeywords = [
    "interested in", "want to order", "looking for", "need a",
    "price of", "how much", "cost of", "tell me about",
    "i want", "can i get", "do you have",
    "log", "record", "add to sheet", "save lead"
  ];
  const isSheets = sheetsKeywords.some(k => msgLower.includes(k));

  if (isSheets) {
    if (!isToolPermitted('google-sheets')) {
      console.log('[intent-handler] Sheets blocked by skill permissions');
      return null;
    }
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const name = cleanName(senderName || 'Customer');
    
    // Extract phone (look for exactly 10 digits), default to 'unknown'
    const phoneMatch = userMessage.match(/\b\d{10}\b/);
    const phone = phoneMatch ? phoneMatch[0] : 'unknown';

    // Extract interest using smart stop words parsing
    const interest = extractInterest(userMessage);

    // Validation
    const isValidName = name.length >= 2 && !/lead|new|log/i.test(name);
    const isValidPhone = phone === 'unknown' || /^\d{10}$/.test(phone);
    const isValidInterest = interest.length >= 3;

    if (!isValidName || !isValidPhone || !isValidInterest) {
      console.log('[intent-handler] Sheets validation failed, returning actionTaken: false', { name, phone, interest });
      return { actionTaken: false, actionResult: '' };
    }

    try {
      // Get or create spreadsheet titled 'Dudo Leads'
      const authClient = await getGoogleClient(workspaceId, 'sheets');
      const drive = google.drive({ version: 'v3', auth: authClient });
      
      const searchRes = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.spreadsheet' and name = 'Dudo Leads' and trashed = false",
        pageSize: 1,
        fields: 'files(id, name)',
      });

      let spreadsheetId = searchRes.data.files?.[0]?.id;

      if (!spreadsheetId) {
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const createRes = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: 'Dudo Leads',
            },
          },
        });
        spreadsheetId = createRes.data.spreadsheetId || undefined;
        if (!spreadsheetId) {
          throw new Error('Failed to create Dudo Leads spreadsheet');
        }
      }

      const sheets = google.sheets({ version: 'v4', auth: authClient });
      let hasHeaders = false;
      try {
        const checkRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Sheet1!A1:A1',
        });
        if (checkRes.data.values && checkRes.data.values.length > 0) {
          hasHeaders = true;
        }
      } catch (err) {
        console.log('[intent-handler] Error checking headers, assuming empty:', err);
      }

      const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
      if (!hasHeaders) {
        // Write header row first
        console.log('[intent-handler] Spreadsheet is empty. Adding header row...');
        const headerRes = await fetch(`${baseUrl}/api/integrations/google/sheets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            spreadsheetId,
            sheetName: 'Sheet1',
            values: ["Timestamp", "Name", "Phone", "Interest", "Channel", "Status"],
          }),
        });
        if (!headerRes.ok) {
          console.error('Failed to write header row:', await headerRes.text());
        }
      }

      // Append data row
      const res = await fetch(`${baseUrl}/api/integrations/google/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          spreadsheetId,
          sheetName: 'Sheet1',
          values: [timestamp, name, phone, interest, channel || 'unknown', 'new'],
        }),
      });

      if (!res.ok) {
        console.error('Sheets integration error:', await res.text());
        return null;
      }

      return {
        actionTaken: true,
        actionResult: `[BACKGROUND: Lead logged to sheets successfully]`,
      };
    } catch (e) {
      console.error('Sheets execution failed:', e);
      return null;
    }
  }

  // DOCS intents:
  // Keywords: "read document", "show document", "pricing document", "business document", "check document"
  const docsKeywords = ["read document", "show document", "pricing document", "business document", "check document"];
  const isDocs = docsKeywords.some(k => msgLower.includes(k));

  if (isDocs) {
    if (!isToolPermitted('google-docs')) {
      console.log('[intent-handler] Docs blocked by skill permissions');
      return null;
    }
    const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
    try {
      const listRes = await fetch(`${baseUrl}/api/integrations/google/docs?workspaceId=${workspaceId}`);
      if (!listRes.ok) {
        console.error('Docs list error:', await listRes.text());
        return null;
      }
      const listData = await listRes.json();
      const docsList = listData.docs || [];
      
      if (docsList.length === 0) {
        return {
          actionTaken: true,
          actionResult: "No documents found in Google Docs",
        };
      }

      // Fetch first 200 characters of each document (up to top 5)
      const docsToFetch = docsList.slice(0, 5);
      const detailedDocs = await Promise.all(
        docsToFetch.map(async (docObj: any) => {
          try {
            const detailRes = await fetch(`${baseUrl}/api/integrations/google/docs?workspaceId=${workspaceId}&id=${docObj.id}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData) {
                return {
                  title: docObj.name || 'Untitled Document',
                  content: (detailData.content || '').substring(0, 200),
                };
              }
            }
          } catch (e) {
            console.error(`Failed to fetch doc content for ${docObj.id}:`, e);
          }
          return {
            title: docObj.name || 'Untitled Document',
            content: '',
          };
        })
      );

      const docSnippets = detailedDocs
        .map(d => `Document: "${d.title}"\nContent snippet: ${d.content}...`)
        .join('\n\n');

      return {
        actionTaken: true,
        actionResult: `✅ Here are the recent documents:\n\n${docSnippets}`,
      };
    } catch (e) {
      console.error('Docs execution failed:', e);
      return null;
    }
  }

  return null;
}
