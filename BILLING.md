# Dudo AI SaaS Billing System

This document outlines the architecture, requirements, endpoints, and database models used for integrating Dodo Payments into the Dudo AI SaaS billing platform.

## 1. Plan Configurations & Entitlements

The billing system enforces limits based on subscription plans using the client-side (`lib/billing-entitlements.ts`) and server-side (`lib/billing-entitlements-server.ts`) libraries:

| Feature / Limit | Free Trial | Monthly Plan (₹999) | 6-Month Pack (₹2,499) |
| :--- | :--- | :--- | :--- |
| **Duration** | exactly 30 minutes | Monthly renewal | 6 months one-time |
| **Price** | ₹0 | ₹999 / month | ₹2,499 |
| **AI Agents** | 1 | 1 | 1 |
| **Channels** | Telegram only | WhatsApp + Telegram | WhatsApp + Telegram |
| **Skills limit** | 0 | 10 | 100 |
| **API Providers** | Default providers | All providers | All providers |
| **Booking/Calendar**| Disabled | Enabled | Enabled |
| **Conversations** | 5 | 100 | 1,000 |

### Trial Expiration Redirection
When a workspace subscription is marked as `status = 'expired'` or when the trial duration (30 minutes from start date) passes, the application automatically redirects the user to `/dashboard/billing` and disables all premium features.

---

## 2. API Endpoints

All billing backend operations are verified using Firebase Authentication ID tokens in the `Authorization: Bearer <ID_TOKEN>` header. Workspace ownership is checked before any operation.

### `POST /api/billing/checkout`
- **Purpose:** Initiates a Dodo Payments checkout session.
- **Payload:** `{ workspaceId: string, planId: 'monthly' | '6months' }`
- **Behavior:** Fetches the matching environment variable `DODO_MONTHLY_PRODUCT_ID` or `DODO_SIX_MONTH_PRODUCT_ID`. Creates a Dodo checkout session and returns `checkoutUrl`.
- **Mock Mode:** Falls back to `/api/billing/mock-checkout` in development or if `ENABLE_DODO_MOCK=true`.

### `GET /api/billing/mock-checkout`
- **Purpose:** Simulates a checkout redirect for testing.
- **Behavior:** Updates Firestore with active subscription values and adds a paid invoice to the history collection, then redirects the client back to `/dashboard/billing?status=success`.

### `POST /api/billing/portal`
- **Purpose:** Fetches a secure customer portal session.
- **Payload:** `{ workspaceId: string }`
- **Behavior:** Creates a Dodo customer portal session and returns `portalUrl`.

### `POST /api/billing/cancel`
- **Purpose:** Disables subscription auto-renewal.
- **Payload:** `{ workspaceId: string }`
- **Behavior:** Updates Dodo Payments subscription `cancel_at_next_billing_date: true` and sets local Firestore subscription document fields.

### `POST /api/billing/resume`
- **Purpose:** Enables subscription auto-renewal.
- **Payload:** `{ workspaceId: string }`
- **Behavior:** Updates Dodo Payments subscription `cancel_at_next_billing_date: false` and resets local Firestore subscription document fields.

---

## 3. Webhook Architecture

The webhook endpoint is located at `POST /api/webhooks/dodo`.

### Signature Verification
- In production, signatures are verified timing-safely.
- Uses timing-safe comparisons of the SHA256 HMAC generated using the `DODO_WEBHOOK_SECRET` on the payload signature buffer `${webhookId}.${webhookTimestamp}.${rawBody}`.

### Idempotency Control
- Event IDs are stored under `workspaces/{workspaceId}/billing/webhookEvents/{eventId}` inside a Firestore transaction.
- Duplicate webhook events are rejected early, return `200 OK`, and are not processed twice.

### Event Mapping & Firestore Sync
1. **`subscription.*` (created, active, renewed, cancelled, paused, resumed):** Syncs plan state, dates, customer ID, subscription ID, auto-renew status, price, and conversation limits to `workspaces/{workspaceId}/billing/subscription`.
2. **`payment.succeeded`:** Saves a paid billing record containing date, plan name, amount, currency, status, payment method details, and invoice download link in `workspaces/{workspaceId}/billing/history/records/{recordId}`.
3. **`payment.failed`:** Updates payment status to failed and logs a failed transaction.
4. **`refund.created`:** Logs a negative amount refund transaction in history.
