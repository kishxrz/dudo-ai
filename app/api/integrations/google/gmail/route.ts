import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleClient } from '@/lib/google-client';

export const runtime = 'nodejs';

// helper to format email body
function makeBody(to: string, from: string, subject: string, message: string) {
  const str = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    message,
  ].join('\n');

  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const authClient = await getGoogleClient(workspaceId, 'gmail');
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'label:INBOX',
    });

    const messages = response.data.messages || [];
    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
        });
        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
        const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
        const snippet = detail.data.snippet || '';

        return {
          id: msg.id,
          threadId: msg.threadId,
          from,
          subject,
          date,
          snippet,
        };
      })
    );

    return NextResponse.json({ emails: detailedMessages });
  } catch (err: any) {
    console.error('Error listing emails:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 550 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const bodyJson = await req.json();
    const { workspaceId, to, subject, body } = bodyJson;

    if (!workspaceId || !to || !subject || !body) {
      return NextResponse.json({ error: 'Missing workspaceId, to, subject, or body' }, { status: 400 });
    }

    const authClient = await getGoogleClient(workspaceId, 'gmail');
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // Get sender's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
    const userInfo = await oauth2.userinfo.get();
    const from = userInfo.data.email || 'me';

    const rawMessage = makeBody(to, from, subject, body);
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    return NextResponse.json({ success: true, messageId: response.data.id });
  } catch (err: any) {
    console.error('Error sending email:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const id = searchParams.get('id');

    if (!workspaceId || !id) {
      return NextResponse.json({ error: 'Missing workspaceId or id' }, { status: 400 });
    }

    const authClient = await getGoogleClient(workspaceId, 'gmail');
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    await gmail.users.messages.trash({
      userId: 'me',
      id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error trashing email:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
