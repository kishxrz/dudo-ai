import { getAdminDb } from './firebase-admin';

export type SecuritySeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  eventType: 
    | 'login'
    | 'logout'
    | 'password_reset'
    | 'api_key_change'
    | 'workspace_delete'
    | 'billing_change'
    | 'knowledge_delete'
    | 'agent_delete'
    | 'rate_limit'
    | 'injection_attempt'
    | 'permission_denied'
    | 'token_validation_failure'
    | 'suspicious_request'
    | 'failed_auth'
    | 'file_uploaded';
  workspaceId?: string;
  userId?: string;
  IP?: string;
  userAgent?: string;
  severity: SecuritySeverity;
  success: boolean;
  details?: Record<string, any>;
}

export class SecurityLogger {
  /**
   * Log a security event both to the centralized master audit collection
   * and a workspace-scoped audit subcollection for visibility.
   */
  static async logEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const adminDb = getAdminDb();
    const payload = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Print to server console diagnostics securely
    console.info(`[Security Audit Log] Event: ${payload.eventType} Severity: ${payload.severity} Success: ${payload.success} WS: ${payload.workspaceId || 'global'}`);

    if (!adminDb) {
      console.log('[Mock Security Log Write Bypass]', JSON.stringify(payload));
      return;
    }

    try {
      // 1. Centralized Master Audit Trail for the entire application
      await adminDb.collection('system_security_audit_logs').add(payload);

      // 2. Workspace-specific Audit Trail
      if (payload.workspaceId) {
        await adminDb.collection(`workspaces/${payload.workspaceId}/security_audit_logs`).add(payload);
      }
      
      // 3. Abuse Detection Logic (triggers warnings on frequent failures)
      if (!payload.success) {
        await this.checkAbuseThresholds(payload.workspaceId || 'global', payload.IP || 'unknown', payload.eventType);
      }
    } catch (err: any) {
      console.error('[Security Logger] Logging failure:', err.message || err);
    }
  }

  /**
   * Automatic abuse detection scanning for frequent 401s, 403s, rate limits, or injection attempts.
   */
  private static async checkAbuseThresholds(workspaceId: string, ip: string, eventType: string) {
    const adminDb = getAdminDb();
    if (!adminDb) return;

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Query recent failed attempts from this IP in the master logs
      const snap = await adminDb.collection('system_security_audit_logs')
        .where('IP', '==', ip)
        .where('success', '==', false)
        .where('timestamp', '>=', fiveMinutesAgo)
        .limit(10)
        .get();

      if (snap.size >= 5) {
        // Log a critical security alert
        const alertPayload = {
          eventType: 'suspicious_request',
          workspaceId,
          severity: 'high',
          success: false,
          IP: ip,
          details: {
            reason: `Abuse detected: ${snap.size} failed operations in under 5 minutes.`,
            triggerEvent: eventType
          },
          timestamp: new Date().toISOString()
        };
        console.error(`[CRITICAL SECURITY ALERT] Abuse threshold triggered for IP: ${ip} workspace: ${workspaceId}`);
        await adminDb.collection('system_security_audit_logs').add(alertPayload);
      }
    } catch (e: any) {
      console.warn('[Abuse Detection] Failed to run check:', e.message);
    }
  }
}
