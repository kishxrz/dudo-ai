import { queueEmail, processQueue } from '../lib/email/queue';

async function run() {
  console.log('Queueing test onboarding welcome email...');
  const queueId = await queueEmail({
    userId: 'dev-user-id',
    email: 'kishore@example.com',
    name: 'Kishore',
    templateType: 'onboarding-welcome',
    extraData: {
      dashboardLink: 'http://localhost:3000/dashboard'
    },
    dedupKey: `dev_test_welcome_${Date.now()}` // Bypass duplicate check
  });

  if (queueId) {
    console.log(`Successfully queued email. Queue ID: ${queueId}`);
    console.log('Processing email queue...');
    const result = await processQueue();
    console.log(`Queue processed: ${result.sent} sent, ${result.failed} failed.`);
    console.log('Check "scratch/dev-emails.log" to view the rendered HTML email output!');
  } else {
    console.error('Failed to queue email.');
  }
  process.exit(0);
}

run();
