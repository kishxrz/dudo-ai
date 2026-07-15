import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleClient } from '@/lib/google-client';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const authClient = await getGoogleClient(workspaceId, 'calendar');
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const formattedEvents = events.map((event) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      attendees: event.attendees?.map((a) => a.email) || [],
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (err: any) {
    console.error('Error listing calendar events:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const bodyJson = await req.json();
    const { workspaceId, title, date, time, description, attendees } = bodyJson;

    if (!workspaceId || !title || !date || !time) {
      return NextResponse.json({ error: 'Missing workspaceId, title, date, or time' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const authClient = await getGoogleClient(workspaceId, 'calendar');
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour default

    const attendeeObjects = Array.isArray(attendees)
      ? attendees.map((email: string) => ({ email }))
      : typeof attendees === 'string' && attendees.trim().length > 0
      ? [{ email: attendees.trim() }]
      : [];

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description: description || '',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: attendeeObjects,
      },
    });

    return NextResponse.json({ success: true, event: response.data });
  } catch (err: any) {
    console.error('Error creating calendar event:', err);
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

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const authClient = await getGoogleClient(workspaceId, 'calendar');
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting calendar event:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
