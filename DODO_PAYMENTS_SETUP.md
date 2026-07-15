# Dodo Payments Configuration & Setup Guide

This guide walks you through setting up Dodo Payments for Dudo AI SaaS in both Sandbox/Testing and Production environments.

## 1. Environment Variables Configuration

Ensure the following variables are configured in your application environment (e.g. `.env.local` for local development, or your hosting provider's dashboard for production deployments):

```bash
# 1. API Keys (Available in Dodo Payments Dashboard -> Developers -> API Keys)
DODO_SECRET_KEY=s4kVKsH3wwmYZbUd.wm1Fop-ObXpR0skHNeWO8QLPx4LccvFVuwBZbA6SP9gETph9
NEXT_PUBLIC_DODO_PUBLISHABLE_KEY=pk_snd_091bba0fefcd4852a44cccdcf47602b5

# 2. Webhook Verification Secret (Available in Developers -> Webhooks after creating endpoint)
# Note: If undefined, the webhook endpoint will fallback to verifying using DODO_SECRET_KEY.
DODO_WEBHOOK_SECRET=whsec_your_webhook_signing_secret

# 3. Product IDs (Dodo Payments Dashboard -> Products)
# Never hardcode product/price strings in code; configure the resolved IDs here:
DODO_MONTHLY_PRODUCT_ID=pdt_monthly_product_id_here
DODO_SIX_MONTH_PRODUCT_ID=pdt_six_month_product_id_here

# 4. Mock / Simulated checkout configurations
# If set to true, when API calls fail (e.g. invalid keys during offline local testing),
# the app redirects to a simulated mock checkout flow. Must be false or omitted in production.
ENABLE_DODO_MOCK=false

# 5. App base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 2. Product Setup on Dodo Payments

1. Log in to your [Dodo Payments Dashboard](https://test.dodopayments.com/login).
2. Navigate to **Products** -> **New Product**.
3. Create the **Monthly Plan**:
   - Name: `Monthly Plan`
   - Billing: Recurring (Subscription)
   - Interval: `Monthly`
   - Price: `999 INR`
   - Copy the generated `Product ID` (e.g. `pdt_xxxxx`) and paste it as `DODO_MONTHLY_PRODUCT_ID` in your environment.
4. Create the **6-Month Launch Pack**:
   - Name: `6-Month Pack`
   - Billing: Recurring (Subscription)
   - Interval: `6 Months` (or set up as pre-paid period count)
   - Price: `2,499 INR`
   - Copy the generated `Product ID` (e.g. `pdt_yyyyy`) and paste it as `DODO_SIX_MONTH_PRODUCT_ID` in your environment.

---

## 3. Webhook Registration & Endpoint Setup

Dodo Payments relies on server-to-server webhook events to keep Firestore database entitlements synchronized.

1. Navigate to **Developers** -> **Webhooks** in the Dodo Payments dashboard.
2. Click **Create Webhook Endpoint**.
3. Enter your endpoint URL:
   - For Production: `https://yourdomain.com/api/webhooks/dodo`
   - For Local Testing: Use a tunneling tool like `ngrok` or `localtunnel` (e.g. `https://your-tunnel-subdomain.ngrok-free.app/api/webhooks/dodo`).
4. Select the following **Events to subscribe**:
   - `subscription.created`
   - `subscription.active`
   - `subscription.renewed`
   - `subscription.cancelled`
   - `subscription.paused`
   - `subscription.resumed`
   - `payment.succeeded`
   - `payment.failed`
   - `refund.created`
5. Click **Save**.
6. Copy the **Signing Secret** (prefixed with `whsec_`) and save it as `DODO_WEBHOOK_SECRET` in your environment.

---

## 4. Local Testing & Mock Mode

For fully simulated local testing without live internet tunnels:
1. Set `ENABLE_DODO_MOCK=true` in `.env.local`.
2. This allows mock checkout flows (`/api/billing/mock-checkout`) to immediately update Firestore and insert mock paid invoices into the user history subcollection, allowing complete interactive UI development.
