/**
 * Dudo Premium Email Design System Components
 * Uses high-readability responsive HTML/CSS structures inline.
 */

export const colors = {
  bg: '#090A0F',          // Deep premium dark background
  card: '#131622',        // Slate rounded card background
  border: '#222638',      // Border color matching dark theme
  accent: '#22577A',      // Premium blue highlight
  accentLight: '#38A3A5', // Teal micro highlight
  textPrimary: '#F4F4F5',  // High contrast white text
  textSecondary: '#A1A1AA',// Zinc-400 label text
  success: '#10B981',     // Success green
  warning: '#F59E0B',     // Alert amber
  error: '#EF4444',       // Danger red
};

export const EmailLayout = (title: string, bodyContent: string, unsubscribeUrl: string, preferencesUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: ${colors.bg};
      color: ${colors.textPrimary};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    img {
      max-width: 100%;
      height: auto;
      border: 0;
      display: block;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: ${colors.bg};
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${colors.card};
      border: 1px solid ${colors.border};
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .content-padding {
      padding: 32px 24px;
    }
    .footer {
      max-width: 600px;
      margin: 0 auto;
      text-align: center;
      padding-top: 24px;
    }
    .footer-text {
      font-size: 11px;
      color: ${colors.textSecondary};
      line-height: 1.6;
    }
    .footer-link {
      color: ${colors.accentLight};
      text-decoration: none;
      font-weight: 600;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header / Logo -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${colors.bg}; border-bottom: 1px solid ${colors.border};">
        <tr>
          <td align="center" style="padding: 24px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color: ${colors.accent}; color: ${colors.textPrimary}; font-size: 16px; font-weight: 900; letter-spacing: 2px; padding: 6px 12px; border-radius: 6px; text-transform: uppercase;">
                  DUDO
                </td>
                <td style="font-size: 14px; font-weight: 700; color: ${colors.textSecondary}; padding-left: 8px;">
                  AI Employee
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Main Body Content -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="content-padding">
            ${bodyContent}
          </td>
        </tr>
      </table>
    </div>

    <!-- Universal Footer -->
    <div class="footer">
      <p class="footer-text">
        This is an automated communication from Dudo Inc. Manage your preferences to control what notifications you receive.
      </p>
      <p class="footer-text" style="margin-top: 8px;">
        <a href="${preferencesUrl}" class="footer-link">Manage Preferences</a> &nbsp;·&nbsp;
        <a href="${unsubscribeUrl}" class="footer-link">One-Click Unsubscribe</a> &nbsp;·&nbsp;
        <a href="${preferencesUrl}/privacy" class="footer-link">Privacy Policy</a> &nbsp;·&nbsp;
        <a href="${preferencesUrl}/terms" class="footer-link">Terms of Service</a>
      </p>
      <p class="footer-text" style="color: #52525B; margin-top: 16px;">
        Dudo Technologies Inc. · 100 Pine Street, 16th Floor · San Francisco, CA 94111
      </p>
    </div>
  </div>
</body>
</html>
`;

export const HeroBanner = (title: string, subtitle: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
    <tr>
      <td align="center" style="background: linear-gradient(135deg, ${colors.accent} 0%, #1a3c5a 100%); padding: 32px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <h2 style="margin: 0; color: ${colors.textPrimary}; font-size: 22px; font-weight: 900; text-align: center; letter-spacing: -0.5px; line-height: 1.2;">
          ${title}
        </h2>
        <p style="margin: 8px 0 0 0; color: rgba(244,244,245,0.8); font-size: 13px; font-weight: 500; text-align: center; line-height: 1.4; max-width: 400px;">
          ${subtitle}
        </p>
      </td>
    </tr>
  </table>
`;

export const CTAButton = (text: string, url: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
    <tr>
      <td align="center">
        <a href="${url}" style="background-color: ${colors.accent}; color: ${colors.textPrimary}; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(34, 87, 122, 0.4); border: 1px solid rgba(255,255,255,0.1); transition: background-color 0.2s;">
          ${text}
        </a>
      </td>
    </tr>
  </table>
`;

export const FeatureCard = (title: string, desc: string, icon = '⚡') => `
  <div style="background-color: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 10px; padding: 16px; margin-bottom: 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="top" style="font-size: 20px; width: 32px; text-align: center; padding-right: 12px;">
          ${icon}
        </td>
        <td valign="top">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: ${colors.textPrimary};">${title}</h4>
          <p style="margin: 0; font-size: 12px; color: ${colors.textSecondary}; line-height: 1.5; font-weight: 500;">${desc}</p>
        </td>
      </tr>
    </table>
  </div>
`;

export const StatisticCard = (value: string, label: string) => `
  <div style="background-color: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 8px; padding: 12px; text-align: center; display: inline-block; min-width: 120px; margin: 6px;">
    <div style="font-size: 20px; font-weight: 900; color: ${colors.accentLight};">${value}</div>
    <div style="font-size: 10px; color: ${colors.textSecondary}; font-weight: bold; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</div>
  </div>
`;

export const TipsBox = (text: string) => `
  <div style="background-color: rgba(56, 163, 165, 0.05); border-left: 4px solid ${colors.accentLight}; border-radius: 0 8px 8px 0; padding: 16px; margin: 20px 0;">
    <div style="font-weight: 800; font-size: 11px; color: ${colors.accentLight}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">⚡ Tip of the Week</div>
    <div style="font-size: 12px; color: ${colors.textPrimary}; line-height: 1.6; font-weight: 500;">${text}</div>
  </div>
`;

export const WarningBox = (title: string, text: string) => `
  <div style="background-color: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.15); border-left: 4px solid ${colors.error}; border-radius: 6px; padding: 16px; margin: 20px 0;">
    <div style="font-weight: 800; font-size: 12px; color: ${colors.error}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">⚠️ ${title}</div>
    <div style="font-size: 12px; color: ${colors.textPrimary}; line-height: 1.5; font-weight: 500;">${text}</div>
  </div>
`;

export const SuccessBox = (title: string, text: string) => `
  <div style="background-color: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.15); border-left: 4px solid ${colors.success}; border-radius: 6px; padding: 16px; margin: 20px 0;">
    <div style="font-weight: 800; font-size: 12px; color: ${colors.success}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">✓ ${title}</div>
    <div style="font-size: 12px; color: ${colors.textPrimary}; line-height: 1.5; font-weight: 500;">${text}</div>
  </div>
`;

export const PricingCard = (tierName: string, price: string, period: string, features: string[], ctaText: string, ctaUrl: string) => `
  <div style="background-color: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 12px; padding: 24px; text-align: center; margin: 16px 0;">
    <h3 style="margin: 0; font-size: 16px; font-weight: 900; color: ${colors.textPrimary}; text-transform: uppercase; letter-spacing: 1px;">${tierName}</h3>
    <div style="margin: 16px 0;">
      <span style="font-size: 32px; font-weight: 900; color: ${colors.textPrimary};">${price}</span>
      <span style="font-size: 13px; color: ${colors.textSecondary}; font-weight: bold;">/${period}</span>
    </div>
    <div style="text-align: left; margin: 20px 0; border-top: 1px solid ${colors.border}; padding-top: 16px;">
      ${features.map(f => `
        <div style="font-size: 12px; color: ${colors.textPrimary}; margin-bottom: 10px; font-weight: 550;">
          <span style="color: ${colors.success}; font-weight: bold; margin-right: 6px;">✓</span> ${f}
        </div>
      `).join('')}
    </div>
    <a href="${ctaUrl}" style="background-color: ${colors.accent}; color: ${colors.textPrimary}; font-size: 12px; font-weight: 800; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: block; border: 1px solid rgba(255,255,255,0.1);">${ctaText}</a>
  </div>
`;

export const ComparisonTable = (headers: string[], rows: string[][]) => `
  <table width="100%" cellpadding="8" cellspacing="0" border="0" style="margin: 20px 0; border-collapse: collapse; border: 1px solid ${colors.border}; border-radius: 8px; overflow: hidden; background-color: ${colors.bg};">
    <tr style="background-color: ${colors.border};">
      ${headers.map(h => `<th align="left" style="font-size: 11px; font-weight: 850; color: ${colors.textPrimary}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${colors.border};">${h}</th>`).join('')}
    </tr>
    ${rows.map((row, i) => `
      <tr style="border-bottom: 1px solid ${colors.border};">
        ${row.map(cell => `<td style="font-size: 11px; color: ${colors.textPrimary}; font-weight: 550;">${cell}</td>`).join('')}
      </tr>
    `).join('')}
  </table>
`;

export const TestimonialCard = (quote: string, author: string, company: string) => `
  <div style="background-color: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 12px; padding: 20px; margin: 20px 0; position: relative;">
    <p style="margin: 0 0 12px 0; font-size: 12px; color: ${colors.textPrimary}; font-style: italic; line-height: 1.6; font-weight: 500;">
      "${quote}"
    </p>
    <div style="font-size: 11px; font-weight: 800; color: ${colors.accentLight};">
      ${author}
    </div>
    <div style="font-size: 10px; color: ${colors.textSecondary}; font-weight: 600; margin-top: 2px;">
      ${company}
    </div>
  </div>
`;
