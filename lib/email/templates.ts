import { 
  EmailLayout, 
  HeroBanner, 
  CTAButton, 
  FeatureCard, 
  StatisticCard, 
  TipsBox, 
  WarningBox, 
  SuccessBox, 
  PricingCard, 
  ComparisonTable, 
  TestimonialCard 
} from './components';

export function generateHtmlEmail(
  templateType: string, 
  name: string, 
  unsubscribeUrl: string, 
  preferencesUrl: string, 
  extraData: any = {}
): { subject: string; html: string } {
  let subject = '';
  let bodyContent = '';

  const host = unsubscribeUrl.includes('/email-preferences') 
    ? unsubscribeUrl.split('/email-preferences')[0] 
    : 'https://dudo.ai';

  const dashboardLink = extraData.dashboardLink || `${host}/dashboard`;
  const billingLink = `${host}/dashboard/billing`;
  const actionLink = extraData.actionLink || dashboardLink;

  switch (templateType) {
    // ─── Authentication Emails ───────────────────────────────────────────────
    case 'auth-verify':
      subject = 'Verify your Dudo email address';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 18px; font-weight: 800;">Verify your email address</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Welcome to Dudo! To complete your signup and protect your account, please verify your email address by clicking the button below.
        </p>
        ${CTAButton('Verify Email Address', actionLink)}
        <p style="font-size: 11px; line-height: 1.4; color: #A1A1AA; margin-top: 16px; font-weight: 550;">
          This link will expire in 24 hours. If you did not sign up for a Dudo account, you can safely ignore this email.
        </p>
      `;
      break;

    case 'google-welcome':
      subject = 'Welcome to Dudo - Getting Started Checklist';
      bodyContent = `
        ${HeroBanner('Welcome to Dudo!', 'Your AI Employee journey starts here')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          You've successfully signed in with your Google account. We are excited to help you automate your customer support, sales, and operations.
        </p>
        <div style="margin: 20px 0;">
          <h4 style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #38A3A5; margin-bottom: 12px;">Getting Started Checklist:</h4>
          ${FeatureCard('1. Create your AI Employee profile', 'Describe their personality, communication style, and timezone.', '🤖')}
          ${FeatureCard('2. Connect WhatsApp and Telegram channels', 'Let your customers interact with your agent instantly.', '🔌')}
          ${FeatureCard('3. Upload your Knowledge Base', 'Upload files, documents, and instructions to train your agent.', '📚')}
        </div>
        ${CTAButton('Go to Dashboard', dashboardLink)}
      `;
      break;

    case 'password-reset':
      subject = 'Reset your Dudo password';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 18px; font-weight: 800;">Password Reset Request</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          We received a request to reset your password. Click the button below to choose a new password.
        </p>
        ${CTAButton('Reset Password', actionLink)}
        <p style="font-size: 11px; line-height: 1.4; color: #A1A1AA; margin-top: 16px; font-weight: 550;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      `;
      break;

    // ─── Onboarding Emails ───────────────────────────────────────────────────
    case 'onboarding-welcome':
      subject = 'Welcome to Dudo - Automate your business with AI Employees';
      bodyContent = `
        ${HeroBanner('Meet your new AI Employee', 'Seamless customer communication on autopilot')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Thank you for joining Dudo! We help you deploy autonomous AI agents that run 24/7, answering customer queries, scheduling appointments, and handling sales over WhatsApp and Telegram.
        </p>
        ${FeatureCard('Enterprise Grade Security', 'Your data is protected. Use Boss Takeover commands to override the AI at any time.', '🛡️')}
        ${FeatureCard('Instant Sync RAG Engine', 'Update your knowledge base and the AI learns instantly without training delays.', '⚡')}
        ${CTAButton('Complete Setup', billingLink)}
      `;
      break;

    case 'onboarding-day1':
      subject = 'Day 1: Connect WhatsApp to launch your AI Employee';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Connect WhatsApp in 60 seconds</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          A conversational AI is only useful if your customers can reach it. Connecting WhatsApp is the fastest way to get your AI Employee in front of your users.
        </p>
        ${FeatureCard('Scan QR Code', 'Scan the QR code from your dashboard to connect any standard or business WhatsApp number.', '📲')}
        ${FeatureCard('Instant Responses', 'No API review required. Your agent starts responding to messages immediately.', '💬')}
        ${CTAButton('Connect WhatsApp Now', actionLink)}
      `;
      break;

    case 'onboarding-day2':
      subject = 'Day 2: Expand to Telegram for multichat automation';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Why connect Telegram?</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Adding Telegram extends your reach. You can connect a custom Telegram bot with a single bot token from BotFather.
        </p>
        ${FeatureCard('Group Support', 'Dudo agents can manage inquiries inside private chats or public developer groups.', '👥')}
        ${FeatureCard('Zero Message Fees', 'Telegram bot API is completely free with no usage limits.', '💎')}
        ${CTAButton('Connect Telegram', actionLink)}
      `;
      break;

    case 'onboarding-day3':
      subject = 'Day 3: Crafting your AI Employee\'s personality';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Define their communication style</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          An AI Employee should represent your company voice. Customize their behavior, timezone, default system prompts, and speech capabilities.
        </p>
        ${FeatureCard('Voice Capabilities', 'Support voice notes on WhatsApp with automated speech-to-text transcriptions.', '🎙️')}
        ${FeatureCard('Custom Prompts', 'Inject special context like greeting styles, reply formats, or pricing lists.', '📝')}
        ${CTAButton('Customize Personality', actionLink)}
      `;
      break;

    case 'onboarding-day5':
      subject = 'Day 5: Training your AI on documents & websites';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Build your Knowledge Base</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Your AI Employee needs factual context to resolve inquiries correctly. Upload PDF guidelines, product catalogs, FAQ documents, or paste plain text.
        </p>
        ${FeatureCard('Dynamic Context Retrieval', 'Dudo automatically retrieves the most relevant facts dynamically on every message.', '🔍')}
        ${FeatureCard('Conflict Avoidance', 'Keep the AI grounded to prevent halluncinations or fabricated product info.', '🛡️')}
        ${CTAButton('Upload Documents', actionLink)}
      `;
      break;

    case 'onboarding-day7':
      subject = 'Day 7: Final onboarding checklist review';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">You\'re almost fully set up!</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Let\'s look at your progress. Completing your checklist guarantees a high-performing autonomous support channel.
        </p>
        ${FeatureCard('WhatsApp Status', extraData.whatsappConnected ? '✓ Connected' : '❌ Disconnected - Scan QR code', '📲')}
        ${FeatureCard('Telegram Status', extraData.telegramConnected ? '✓ Connected' : '❌ Disconnected - Provide Bot Token', '🔌')}
        ${FeatureCard('Knowledge Docs', `${extraData.docsCount || 0} files uploaded`, '📚')}
        ${CTAButton('Open Dashboard Checklist', actionLink)}
      `;
      break;

    // ─── Trial Sequence Emails ───────────────────────────────────────────────
    case 'trial-started':
      subject = 'Your 14-day Dudo Premium Trial has started!';
      bodyContent = `
        ${HeroBanner('Premium Trial Active', 'All features unlocked for 14 days')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Your free trial has started. Here is what is included:
        </p>
        ${FeatureCard('Unlimited AI Conversations', 'Handle customer messages concurrently without queue wait times.', '💬')}
        ${FeatureCard('Advanced RAG Engine & Large Uploads', 'Upload files up to 20MB for immediate ingestion.', '⚡')}
        ${FeatureCard('Enterprise Security & Boss Control', 'Take control of active chat rooms instantly via command overrides.', '🛡️')}
        ${CTAButton('Start Customizing', actionLink)}
      `;
      break;

    case 'trial-5days':
      subject = '5 days remaining in your Dudo free trial';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Trial Expiry Notice</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          This is a heads-up that you have 5 days left in your premium trial. Upgrade now to secure your AI Employee responses without interruption.
        </p>
        ${StatisticCard('5 Days', 'Remaining')}
        ${StatisticCard(extraData.convCount || '0', 'AI Chats Resolved')}
        ${CTAButton('Upgrade Plan', billingLink)}
      `;
      break;

    case 'trial-3days':
      subject = '3 days left: Upgrade to keep your AI Employee online';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Don\'t let your AI sleep</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Your AI Employee has been resolving queries automatically. Once your trial expires in 3 days, customers will no longer receive automated responses.
        </p>
        ${TestimonialCard('Dudo resolved over 80% of our WhatsApp tickets automatically. We saved 15 hours a week in our first trial phase.', 'Aarav Patel', 'Growth Director, FreshCart')}
        ${CTAButton('Upgrade to Premium', billingLink)}
      `;
      break;

    case 'trial-24h':
      subject = 'Urgent: 24 hours left on your Dudo trial';
      bodyContent = `
        ${WarningBox('Trial Ending Tomorrow', 'Your AI Employee will go offline in exactly 24 hours unless you upgrade.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Avoid operations disruption. Upgrade your Dudo subscription to ensure customer messages on WhatsApp and Telegram are processed continuously.
        </p>
        ${CTAButton('Lock in Premium Access', billingLink)}
      `;
      break;

    case 'trial-4h':
      subject = 'Final Notice: 4 hours remaining (Urgent)';
      bodyContent = `
        ${WarningBox('AI Mode Pausing in 4 Hours', 'Your active chats will remain, but the AI will no longer auto-respond.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          This is your final notice. Your trial ends in 4 hours. All custom knowledge docs, configurations, and chat records are saved, but the AI will pause.
        </p>
        ${CTAButton('Upgrade Immediately', billingLink)}
      `;
      break;

    case 'trial-expired':
      subject = 'Your Dudo trial has expired - AI paused';
      bodyContent = `
        ${WarningBox('AI Employee Offline', 'Your AI Employee is now paused. Customers will not receive replies.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Don\'t worry—nothing has been deleted. Your setup, connected channels, and documents are preserved. Simply upgrade to reactivate immediately.
        </p>
        ${CTAButton('Reactivate AI Employee', billingLink)}
      `;
      break;

    // ─── Billing & Subscriptions ─────────────────────────────────────────────
    case 'billing-success':
      subject = 'Payment Successful - Dudo Premium Plan';
      bodyContent = `
        ${SuccessBox('Payment Received', 'Thank you for your payment. Your subscription is active.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Your payment of ${extraData.currency || '₹'}${extraData.amount || '999'} was successfully processed.<br/>
          Thank you for choosing Dudo. Your AI employee is online and actively monitoring your channels.
        </p>
        ${CTAButton('Go to Billing Portal', billingLink)}
      `;
      break;

    case 'billing-failed':
      subject = 'Action Required: Your payment for Dudo failed';
      bodyContent = `
        ${WarningBox('Payment Failed', 'We were unable to process your subscription payment.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          We attempted to renew your Dudo plan, but your payment method was declined.<br/>
          To prevent your AI employee from going offline, please update your billing details.
        </p>
        ${CTAButton('Update Payment Method', billingLink)}
      `;
      break;

    case 'subscription-renewal':
      subject = 'Your Dudo subscription is renewing soon';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Subscription Renewal Notice</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          This is a friendly reminder that your subscription is scheduled to automatically renew on ${extraData.renewalDate || 'next billing date'}.<br/>
          Amount: ${extraData.currency || '₹'}${extraData.amount || '999'}.
        </p>
        ${CTAButton('Manage Subscription', billingLink)}
      `;
      break;

    case 'account-cancelled':
      subject = 'Dudo Subscription Cancelled';
      bodyContent = `
        ${WarningBox('Subscription Cancelled', 'Your subscription auto-renewal has been cancelled.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Your Dudo premium plan auto-renewal has been successfully cancelled. You will continue to have access to all premium features until your current period expires on ${extraData.expiryDate || 'expiry date'}.<br/>
          Once expired, your AI employee will pause. You can reactivate anytime.
        </p>
        ${CTAButton('Re-activate Renewal', billingLink)}
      `;
      break;

    // ─── Security Alerts ─────────────────────────────────────────────────────
    case 'security-new-device':
      subject = 'Security Alert: Login from new device detected';
      bodyContent = `
        ${WarningBox('New Login Detected', 'A new login was detected on your Dudo account.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          We detected a login from a new device or browser:<br/>
          - **IP Address**: ${extraData.ip || 'Unknown'}<br/>
          - **Device/OS**: ${extraData.device || 'Unknown OS'}<br/>
          - **Time**: ${extraData.time || new Date().toLocaleString()}<br/><br/>
          If this was you, no action is needed. If you did not log in recently, please reset your password immediately.
        </p>
        ${CTAButton('Secure My Account', `${host}/login`)}
      `;
      break;

    case 'security-password-changed':
      subject = 'Security Alert: Password changed successfully';
      bodyContent = `
        ${SuccessBox('Password Updated', 'Your Dudo account password was successfully updated.')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          This is a confirmation that your Dudo account password has been updated. <br/><br/>
          If you made this change, no action is required. If you did not make this change, please contact support immediately to lock your account.
        </p>
        ${CTAButton('Contact Support', `${host}/contact`)}
      `;
      break;

    // ─── Pricing & Abandonment ───────────────────────────────────────────────
    case 'pricing-abandon':
      subject = 'Maximize operational efficiency with Dudo';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Unlock 24/7 Customer Support ROI</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          We noticed you were reviewing our plans. An AI Employee operates at 95% lower cost than manual ticket resolution. Here is how upgrading pays for itself:
        </p>
        ${ComparisonTable(['Feature', 'Free Tier', 'Premium Plan'], [
          ['Concurrent Chats', '1 chat', 'Unlimited'],
          ['Knowledge Size', '50 KB', '100 MB'],
          ['Security Controls', 'Basic', 'Full Takeover Boss Commands'],
          ['Response Speed', 'Normal', 'High Priority Instant']
        ])}
        ${CTAButton('Upgrade & Scale Today', billingLink)}
      `;
      break;

    case 'founder-pricing':
      subject = 'Reminder: Founder lifetime discount expires soon';
      bodyContent = `
        ${HeroBanner('Founder Lifetime Offer', '50% off Forever')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          This is a reminder that our early supporter Founder pricing is expiring. There are only a few lifetime seats remaining at this rate.
        </p>
        ${SuccessBox('Lifetime Benefits', 'Lock in $49/mo (normally $99/mo) forever. Your rate will never increase.')}
        ${CTAButton('Claim Founder Seats', billingLink)}
      `;
      break;

    case 'abandoned-setup':
      subject = 'Complete your Dudo setup to launch your AI';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Let\'s bring your agent online</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Your sign-up is complete, but your AI Employee is missing key steps:
        </p>
        ${FeatureCard('Connect channels', 'Connect WhatsApp to start receiving queries.', '📲')}
        ${FeatureCard('Upload knowledge', 'Provide documents so your agent can answer correctly.', '📚')}
        ${CTAButton('Resume Setup Now', actionLink)}
      `;
      break;

    // ─── Marketing & Newsletters ─────────────────────────────────────────────
    case 'weekly-education':
      subject = extraData.articleTitle || 'Weekly AI Operations Guide';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">${extraData.articleTitle || 'Automation Tip of the Week'}</h3>
        <p style="font-size: 13px; line-height: 1.6; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          ${extraData.articleBody || 'Here is your weekly guide on optimizing prompt instructions and structure for custom conversational bots.'}
        </p>
        ${TipsBox(extraData.actionableTip || 'Always structure prompts with XML-like tags to cleanly demarcate constraints.')}
        <div style="background-color: #131622; border: 1px solid #222638; border-radius: 8px; padding: 14px; margin-top: 14px;">
          <strong style="color: #38A3A5; font-size: 11px; text-transform: uppercase;">Feature Spotlight:</strong>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #A1A1AA; font-weight: 500;">${extraData.featureSpotlight || 'Instant RAG updates.'}</p>
        </div>
        ${CTAButton('Read Full Guide', actionLink)}
      `;
      break;

    case 'feature-launch':
      subject = `New Feature: ${extraData.featureTitle || 'Advanced Custom AI Skills'}`;
      bodyContent = `
        ${HeroBanner(extraData.featureTitle || 'New Feature Alert', 'Shipment notification from Dudo')}
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          We just shipped a major update to help you build better automated workflows.
        </p>
        <div style="margin: 20px 0; background-color: #090A0F; border: 1px solid #222638; border-radius: 10px; padding: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #38A3A5; font-size: 13px;">${extraData.featureSub || 'Integrate with calendar tools.'}</h4>
          <p style="margin: 0; font-size: 12px; color: #A1A1AA; line-height: 1.5;">${extraData.featureDesc || 'Let customers book slots directly over WhatsApp.'}</p>
        </div>
        ${CTAButton('Try Feature Now', actionLink)}
      `;
      break;

    case 'monthly-changelog':
      subject = extraData.title || `Dudo Changelog: What's New in Dudo`;
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 16px; font-weight: 800;">Changelog Updates</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          Here is a summary of features, enhancements, and stability updates we shipped this month.
        </p>
        <div style="margin: 20px 0; font-weight: 500;">
          <div style="font-size: 13px; font-weight: bold; color: #38A3A5; margin-bottom: 6px;">🚀 New Features</div>
          <p style="font-size: 12px; color: #A1A1AA; margin-bottom: 12px;">${extraData.newFeatures || 'Added support for audio recordings transcriptions.'}</p>

          <div style="font-size: 13px; font-weight: bold; color: #10B981; margin-bottom: 6px;">🛠️ Improvements</div>
          <p style="font-size: 12px; color: #A1A1AA; margin-bottom: 12px;">${extraData.improvements || 'Improved document parsing speeds.'}</p>

          <div style="font-size: 13px; font-weight: bold; color: #EF4444; margin-bottom: 6px;">🐞 Bug Fixes</div>
          <p style="font-size: 12px; color: #A1A1AA;">${extraData.bugFixes || 'Fixed scroll layouts in settings tab.'}</p>
        </div>
        ${CTAButton('Explore Updates', actionLink)}
      `;
      break;

    case 'newsletter-thurs':
      subject = extraData.title || 'Dudo Weekly: Advanced Prompting & Business Automation';
      bodyContent = `
        <h3 style="margin-top: 0; font-size: 18px; font-weight: 900; line-height: 1.2;">
          ${extraData.title}
        </h3>
        <p style="font-size: 11px; color: #38A3A5; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">
          Weekly AI Employee Newsletter
        </p>
        <div style="margin: 20px 0; font-size: 13px; line-height: 1.6; color: #E4E4E7; font-weight: 500;">
          Hi ${name},<br/><br/>
          ${extraData.articleBody}
        </div>
        ${TipsBox(extraData.tipOfTheWeek)}
        <div style="background-color: #090A0F; border: 1px solid #222638; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
          <strong style="color: #22577A; font-size: 11px; text-transform: uppercase;">Prompt of the Week:</strong>
          <pre style="margin: 8px 0 0 0; background: #131622; padding: 8px; border-radius: 4px; font-size: 11px; overflow-x: auto; color: #38A3A5; border: 1px solid #222638; font-family: monospace; white-space: pre-wrap;">${extraData.promptOfTheWeek}</pre>
        </div>
        ${FeatureCard('Feature Spotlight', extraData.featureSpotlight, '✨')}
        ${FeatureCard('Community Highlight', extraData.communityHighlight, '👥')}
        ${CTAButton('Launch Dudo Dashboard', actionLink)}
      `;
      break;

    // ─── Default fallback ────────────────────────────────────────────────────
    default:
      subject = 'Update from Dudo AI';
      bodyContent = `
        <h3 style="margin-top: 0;">Notification</h3>
        <p style="font-size: 13px; line-height: 1.5; color: #E4E4E7;">
          Hi ${name},<br/><br/>
          This is an alert from your Dudo AI account.
        </p>
        ${CTAButton('Open Dashboard', actionLink)}
      `;
      break;
  }

  return {
    subject,
    html: EmailLayout(subject, bodyContent, unsubscribeUrl, preferencesUrl)
  };
}
