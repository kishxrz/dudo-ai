import { NextRequest, NextResponse } from 'next/server';
import { queueEmail, processQueue } from '@/lib/email/queue';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || 'test-recipient@example.com';
  const name = searchParams.get('name') || 'Dudo Developer';

  try {
    console.log(`[Test Trigger] Queueing test onboarding welcome email for ${email}...`);
    
    const queueId = await queueEmail({
      userId: 'dev-user-id',
      email,
      name,
      templateType: 'onboarding-welcome',
      extraData: {
        dashboardLink: '/dashboard'
      },
      dedupKey: `dev_test_welcome_${Date.now()}` // Unique key to bypass duplicate check
    });

    if (!queueId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to queue email. Check if Firestore is configured or if user is unsubscribed.' 
      }, { status: 400 });
    }

    console.log(`[Test Trigger] Successfully queued email. Processing queue...`);
    const result = await processQueue();

    return NextResponse.json({
      success: true,
      message: `Test email successfully triggered and processed.`,
      queueId,
      sentCount: result.sent,
      failedCount: result.failed,
      logInstruction: 'If SUPPORT_EMAIL_PASS is not configured, view the fully-rendered HTML email output inside "scratch/dev-emails.log"!'
    });
  } catch (err: any) {
    console.error('[Test Trigger Failed]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
