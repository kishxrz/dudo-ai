interface RateLimitWindow {
  timestamps: number[];
}

// In-memory sliding window cache
const rateCache = new Map<string, RateLimitWindow>();

// Prune expired entries regularly to prevent memory leaks
if (typeof global !== 'undefined') {
  const globalObj = global as any;
  if (!globalObj.__rateLimitPruner) {
    globalObj.__rateLimitPruner = setInterval(() => {
      const now = Date.now();
      for (const [key, window] of rateCache.entries()) {
        // Find window duration from key suffix
        const parts = key.split(':');
        const windowMs = parseInt(parts[parts.length - 1], 10) || 60000;
        const validTimestamps = window.timestamps.filter(ts => ts > now - windowMs);
        if (validTimestamps.length === 0) {
          rateCache.delete(key);
        } else {
          window.timestamps = validTimestamps;
        }
      }
    }, 60000);
    if (globalObj.__rateLimitPruner.unref) {
      globalObj.__rateLimitPruner.unref();
    }
  }
}

export class RateLimiter {
  /**
   * Check if a request exceeds limits.
   * @param identifier IP address, User ID, or Workspace ID
   * @param limit Maximum allowed requests in the window
   * @param windowMs Window duration in milliseconds (default 1 minute)
   */
  static isRateLimited(identifier: string, limit: number, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = `${identifier}:${windowMs}`;
    
    let record = rateCache.get(key);
    if (!record) {
      record = { timestamps: [] };
      rateCache.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter(ts => ts > now - windowMs);

    if (record.timestamps.length >= limit) {
      return true; // Limited!
    }

    record.timestamps.push(now);
    return false; // Allowed
  }

  /**
   * Extracts clean client IP address from request headers.
   */
  static getClientIp(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      const parts = xff.split(',');
      return parts[0].trim();
    }
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp;
    
    return '127.0.0.1';
  }
}
