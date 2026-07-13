import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleClient } from '@/lib/google-client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const query = searchParams.get('query') || '';

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const authClient = await getGoogleClient(workspaceId, 'drive');
    const drive = google.drive({ version: 'v3', auth: authClient });

    // If query is specified, search by name, otherwise list recent files
    const q = query ? `name contains '${query}'` : undefined;

    const response = await drive.files.list({
      q,
      pageSize: 20,
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      orderBy: 'modifiedTime desc',
    });

    return NextResponse.json({ files: response.data.files || [] });
  } catch (err: any) {
    console.error('Error fetching files from Drive:', err);
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

    const authClient = await getGoogleClient(workspaceId, 'drive');
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Trashes the file
    await drive.files.update({
      fileId: id,
      requestBody: {
        trashed: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error trashing file from Drive:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
