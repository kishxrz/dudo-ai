/**
 * DEPRECATED: WhatsApp client singleton logic has been migrated
 * to the standalone Railway whatsapp-service microservice.
 * This file is stubbed out to prevent Chromium boot-up inside Vercel.
 */

export function getClient(): any {
  throw new Error('whatsapp-client singleton is deprecated. Use the Railway microservice proxy instead.');
}

export function getQR(): null {
  return null;
}

export function getStatus(): string {
  return 'disconnected';
}

export async function initClient(): Promise<void> {
  throw new Error('whatsapp-client initialization is deprecated. Use the Railway microservice proxy instead.');
}

export async function destroyClient(): Promise<void> {
  // No-op
}
