import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getGoogleClient } from '@/lib/google-client';

export const runtime = 'nodejs';

// Helper to extract plain text from google doc structure
function extractText(content: any[]): string {
  let text = '';
  for (const element of content) {
    if (element.paragraph) {
      for (const part of element.paragraph.elements) {
        if (part.textRun) {
          text += part.textRun.content;
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells) {
          text += extractText(cell.content);
        }
      }
    } else if (element.sectionBreak) {
      text += '\n';
    }
  }
  return text;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const id = searchParams.get('id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const authClient = await getGoogleClient(workspaceId, 'docs');

    // If doc ID is provided, read the doc content
    if (id) {
      const docs = google.docs({ version: 'v1', auth: authClient });
      const docResponse = await docs.documents.get({
        documentId: id,
      });

      const bodyContent = docResponse.data.body?.content || [];
      const plainText = extractText(bodyContent);

      return NextResponse.json({
        id,
        title: docResponse.data.title || '',
        content: plainText,
      });
    }

    // Otherwise list recent docs from Google Drive
    const drive = google.drive({ version: 'v3', auth: authClient });
    const driveResponse = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.document'",
      pageSize: 20,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc',
    });

    return NextResponse.json({ docs: driveResponse.data.files || [] });
  } catch (err: any) {
    console.error('Error fetching document:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
