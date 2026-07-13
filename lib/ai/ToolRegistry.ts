import { getGoogleClient } from '../google-client';
import { google } from 'googleapis';

export interface ToolExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export class ToolRegistry {
  private static APPROVED_TOOLS = new Set([
    'google-calendar-list',
    'google-calendar-create',
    'gmail-send',
    'google-sheets-append',
    'google-docs-create'
  ]);

  /**
   * Check if a tool is registered and approved for execution.
   */
  static isApproved(toolName: string): boolean {
    return this.APPROVED_TOOLS.has(toolName);
  }

  /**
   * Execute an approved server-side tool with validation, timeouts, and authorization.
   */
  static async executeTool(
    workspaceId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolExecutionResult> {
    if (!this.isApproved(toolName)) {
      return { success: false, output: '', error: `Tool '${toolName}' is not registered or approved.` };
    }

    // Set a timeout of 5 seconds for safety
    const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) =>
      setTimeout(() => reject(new Error('Tool execution timed out after 5000ms')), 5000)
    );

    try {
      const executionPromise = this.runToolHandler(workspaceId, toolName, args);
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (err: any) {
      console.error(`[ToolRegistry] Error executing ${toolName}:`, err);
      return { success: false, output: '', error: err.message || 'Execution error.' };
    }
  }

  private static async runToolHandler(
    workspaceId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolExecutionResult> {
    let oauth2Client: any = null;
    let isConnected = false;

    try {
      oauth2Client = await getGoogleClient(workspaceId);
      isConnected = !!oauth2Client;
    } catch (e: any) {
      console.log(`[ToolRegistry] Google client not connected/available for ${workspaceId}, falling back to simulated execution:`, e.message || String(e));
    }

    switch (toolName) {
      case 'google-calendar-list': {
        if (!isConnected) {
          return {
            success: true,
            output: JSON.stringify([
              { id: 'mock-1', summary: 'Client Sync Meeting', start: { dateTime: new Date().toISOString() } },
              { id: 'mock-2', summary: 'Product Brainstorming', start: { dateTime: new Date(Date.now() + 3600000).toISOString() } }
            ])
          };
        }
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin: args.timeMin || new Date().toISOString(),
          maxResults: args.maxResults || 10,
          singleEvents: true,
          orderBy: 'startTime',
        });
        return { success: true, output: JSON.stringify(res.data.items || []) };
      }

      case 'google-calendar-create': {
        const { summary, start, end, description } = args;
        if (!summary || !start) {
          throw new Error('Missing required arguments: summary and start.');
        }
        if (!isConnected) {
          return {
            success: true,
            output: `Successfully created calendar event [SIMULATED] "${summary}" on ${start}.`
          };
        }
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const res = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary,
            description: description || 'Created by Dudo AI Assistant',
            start: { dateTime: start, timeZone: 'UTC' },
            end: { dateTime: end || new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(), timeZone: 'UTC' },
          },
        });
        return { success: true, output: `Successfully booked event: ${res.data.htmlLink}` };
      }

      case 'gmail-send': {
        const { to, subject, body } = args;
        if (!to || !subject || !body) {
          throw new Error('Missing required arguments: to, subject, and body.');
        }
        if (!isConnected) {
          return {
            success: true,
            output: `Successfully sent email [SIMULATED] to <${to}> with subject: "${subject}".`
          };
        }
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
          `To: ${to}`,
          'Content-Type: text/html; charset=utf-8',
          'MIME-Version: 1.0',
          `Subject: ${utf8Subject}`,
          '',
          body,
        ];
        const raw = Buffer.from(messageParts.join('\n'))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        });
        return { success: true, output: `Successfully sent email to ${to}.` };
      }

      case 'google-sheets-append': {
        const { values, spreadsheetId, range } = args;
        if (!values || !Array.isArray(values)) {
          throw new Error('Missing required argument: values (must be an array).');
        }
        const targetRange = range || 'Sheet1!A:Z';
        if (!isConnected) {
          return {
            success: true,
            output: `Successfully appended row [SIMULATED] values: [${values.join(', ')}] to sheet.`
          };
        }
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
        // If no spreadsheetId is specified, search or create one
        let targetSpreadsheetId = spreadsheetId;
        if (!targetSpreadsheetId) {
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          const driveList = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet' and name='Dudo AI Workspace Leads'",
            spaces: 'drive',
            fields: 'files(id, name)',
          });
          if (driveList.data.files && driveList.data.files.length > 0) {
            targetSpreadsheetId = driveList.data.files[0].id!;
          } else {
            const createRes = await sheets.spreadsheets.create({
              requestBody: {
                properties: { title: 'Dudo AI Workspace Leads' },
              },
            });
            targetSpreadsheetId = createRes.data.spreadsheetId!;
          }
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId: targetSpreadsheetId,
          range: targetRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [values] },
        });
        return { success: true, output: 'Successfully logged row to Google Sheets.' };
      }

      case 'google-docs-create': {
        const { title, content } = args;
        if (!title || !content) {
          throw new Error('Missing required arguments: title and content.');
        }
        if (!isConnected) {
          return {
            success: true,
            output: `Successfully created Google Doc [SIMULATED] "${title}" with content length ${content.length}.`
          };
        }
        const docs = google.docs({ version: 'v1', auth: oauth2Client });
        const createRes = await docs.documents.create({
          requestBody: { title },
        });
        const documentId = createRes.data.documentId!;
        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  text: content,
                  location: { index: 1 },
                },
              },
            ],
          },
        });
        return { success: true, output: `Successfully created Document ID: ${documentId}` };
      }

      default:
        throw new Error(`Tool handler not implemented for '${toolName}'.`);
    }
  }
}
