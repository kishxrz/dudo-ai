import { getAdminDb } from './firebase-admin';

export async function canUseWhatsapp(workspaceId: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    // If Firebase isn't configured, allow in local development mock mode
    console.log('[Billing] Firebase Admin not initialized, bypassing check.');
    return true;
  }

  try {
    const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
    let subSnap = await subRef.get();

    if (!subSnap.exists) {
      // Initialize default trial subscription
      const startDate = new Date();
      const expiryDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const defaultSub = {
        planId: 'trial',
        planName: 'Free Trial',
        price: 0,
        currency: '₹',
        billingCycle: 'trial',
        status: 'trial',
        startDate: startDate,
        expiryDate: expiryDate,
        nextBillingDate: expiryDate,
        autoRenew: false,
        conversationLimit: 5,
        campaignLimit: 0
      };
      await subRef.set(defaultSub);
      await adminDb.doc(`workspaces/${workspaceId}/billing/usage`).set({
        conversationsThisMonth: 0,
        campaignsSentThisMonth: 0,
        updatedAt: new Date()
      });
      console.log(`[Billing] Initialized default trial subscription for workspace: ${workspaceId}`);
      return false; // Trial only allows telegram
    }

    const sub = subSnap.data();
    if (!sub) {
      return false;
    }

    // Check expiry
    const expiryDate = sub.expiryDate?.toDate ? sub.expiryDate.toDate() : sub.expiryDate ? new Date(sub.expiryDate) : null;
    if (expiryDate && expiryDate.getTime() < Date.now()) {
      if (sub.status !== 'expired') {
        await subRef.set({ status: 'expired' }, { merge: true });
        console.log(`[Billing] Subscription expired for workspace: ${workspaceId}`);
      }
      return false;
    }

    if (sub.status === 'expired') {
      return false;
    }

    const planId = sub.planId || 'trial';
    const PLAN_CONFIGS: Record<string, string[]> = {
      trial: ['telegram'],
      monthly: ['telegram', 'whatsapp'],
      '6months': ['telegram', 'whatsapp']
    };

    const allowedChannels = PLAN_CONFIGS[planId] || PLAN_CONFIGS.trial;
    const allowed = allowedChannels.includes('whatsapp');
    console.log(`[Billing] Workspace ${workspaceId} plan: ${planId}, WhatsApp allowed: ${allowed}`);
    return allowed;
  } catch (error) {
    console.error(`[Billing] Error checking WhatsApp entitlement for workspace ${workspaceId}:`, error);
    return false;
  }
}
