/**
 * Centralized subscription plan configuration.
 * Adding future plans (Yearly, Enterprise, Teams) only requires editing here.
 */

// ─── Plan IDs ─────────────────────────────────────────────────────────────────

export type PlanId = 'trial' | 'monthly' | 'six_month';
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'expired' | 'paused' | 'past_due';

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export interface PlanLimits {
  /** Allowed messaging channels */
  allowedChannels: string[];
  /** Max number of AI agents */
  agentLimit: number;
  /** Max enabled skills */
  maxEnabledSkills: number;
  /** Allowed AI providers */
  apiProviders: string[];
  /** Whether Google Calendar / Appointments are unlocked */
  bookingAccess: boolean;
  /** Knowledge base access */
  knowledgeAccess: boolean;
  /** WhatsApp access */
  whatsappAccess: boolean;
  /** Google integrations access */
  googleAccess: boolean;
  /** Max AI messages (total lifetime for trial, monthly for paid) */
  conversationLimit: number;
  /** Support tier */
  supportLevel: 'none' | 'standard' | 'priority';
  /** Duration in milliseconds (0 = no expiry for paid plans) */
  durationMs: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  trial: {
    allowedChannels: ['telegram'],
    agentLimit: 1,
    maxEnabledSkills: 2,
    apiProviders: ['openai', 'gemini'],
    bookingAccess: false,
    knowledgeAccess: false,
    whatsappAccess: false,
    googleAccess: false,
    conversationLimit: 5,
    supportLevel: 'none',
    durationMs: 30 * 60 * 1000, // 30 minutes
  },
  monthly: {
    allowedChannels: ['telegram', 'whatsapp'],
    agentLimit: 1,
    maxEnabledSkills: 10,
    apiProviders: ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'],
    bookingAccess: true,
    knowledgeAccess: true,
    whatsappAccess: true,
    googleAccess: true,
    conversationLimit: 500,
    supportLevel: 'standard',
    durationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  six_month: {
    allowedChannels: ['telegram', 'whatsapp'],
    agentLimit: 1,
    maxEnabledSkills: 100,
    apiProviders: ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'],
    bookingAccess: true,
    knowledgeAccess: true,
    whatsappAccess: true,
    googleAccess: true,
    conversationLimit: 9999,
    supportLevel: 'priority',
    durationMs: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
  },
};

// ─── Product ID → Plan ID mapping (from env vars) ────────────────────────────

export function getProductToPlanMap(): Record<string, PlanId> {
  const map: Record<string, PlanId> = {};
  const monthlyId = process.env.DODO_MONTHLY_PRODUCT_ID;
  const sixMonthId = process.env.DODO_SIX_MONTH_PRODUCT_ID;
  if (monthlyId) map[monthlyId] = 'monthly';
  if (sixMonthId) map[sixMonthId] = 'six_month';
  return map;
}

export function getPlanIdFromProductId(productId: string): PlanId {
  const map = getProductToPlanMap();
  return map[productId] ?? 'monthly';
}

// ─── Dodo planId string → PlanId normalization ────────────────────────────────
// The webhook and checkout use '6months'/'monthly'; normalize to canonical keys.

export function normalizePlanId(raw: string | undefined | null): PlanId {
  if (!raw) return 'monthly';
  if (raw === '6months' || raw === 'six_month') return 'six_month';
  if (raw === 'monthly') return 'monthly';
  if (raw === 'trial') return 'trial';
  return 'monthly';
}

// ─── Plan metadata ────────────────────────────────────────────────────────────

export interface PlanMeta {
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  trial: { name: 'Free Trial', price: 0, currency: '₹', billingCycle: 'trial' },
  monthly: { name: 'Monthly Plan', price: 999, currency: '₹', billingCycle: 'monthly' },
  six_month: { name: '6-Month Pack', price: 2499, currency: '₹', billingCycle: '6months' },
};
