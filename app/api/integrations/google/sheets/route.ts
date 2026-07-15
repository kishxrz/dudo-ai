import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleClient } from '@/lib/google-client';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const spreadsheetId = searchParams.get('spreadsheetId');

    if (!workspaceId || !spreadsheetId) {
      return NextResponse.json({ error: 'Missing workspaceId or spreadsheetId' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const authClient = await getGoogleClient(workspaceId, 'sheets');
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetTitles = response.data.sheets?.map(s => s.properties?.title || '') || [];
    return NextResponse.json({ sheets: sheetTitles });
  } catch (err: any) {
    console.error('Error fetching spreadsheet sheets:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 550 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const bodyJson = await req.json();
    const { workspaceId, spreadsheetId, sheetName, values } = bodyJson;

    console.log('[Sheets Integration API] Received POST request:', {
      workspaceId,
      spreadsheetId,
      sheetName,
      values,
    });

    if (!workspaceId || !spreadsheetId || !sheetName || !Array.isArray(values)) {
      return NextResponse.json({ error: 'Missing workspaceId, spreadsheetId, sheetName, or values array' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const authClient = await getGoogleClient(workspaceId, 'sheets');
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Ensure values is formatted as a 2D array: [[val1, val2, ...]]
    const formattedValues = Array.isArray(values[0]) ? values : [values];

    console.log('[Sheets Integration API] Appending to Google Sheets:', {
      spreadsheetId,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      values: formattedValues,
    });

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: formattedValues,
      },
    });

    return NextResponse.json({ success: true, updatedRange: response.data.updates?.updatedRange });
  } catch (err: any) {
    console.error('Error appending row to sheet:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const bodyJson = await req.json();
    const { workspaceId, spreadsheetId, range, value } = bodyJson;

    if (!workspaceId || !spreadsheetId || !range || value === undefined) {
      return NextResponse.json({ error: 'Missing workspaceId, spreadsheetId, range, or value' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const authClient = await getGoogleClient(workspaceId, 'sheets');
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });

    return NextResponse.json({ success: true, updatedCells: response.data.updatedCells });
  } catch (err: any) {
    console.error('Error updating cell in sheet:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
