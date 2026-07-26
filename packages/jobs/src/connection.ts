import type { ConnectionOptions } from 'bullmq';

/**
 * Builds BullMQ connection options from a REDIS_URL.
 *
 * Returns `null` when no URL is configured, which is the signal callers use to
 * degrade gracefully: the API falls back to doing the work inline rather than
 * failing a request, so a developer without Redis running still gets a working
 * newsroom.
 */
export interface RedisConnectionOptions {
  /**
   * Producer mode. A request thread must never block on a sick Redis, so
   * commands are rejected immediately instead of being buffered until the
   * connection recovers. Workers want the opposite — they should wait and
   * reconnect — so this is off by default.
   */
  failFast?: boolean;
}

export function redisConnection(
  url = process.env.REDIS_URL,
  options: RedisConnectionOptions = {},
): ConnectionOptions | null {
  if (!url) return null;

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    // BullMQ requires this to be null on connections used by workers.
    maxRetriesPerRequest: options.failFast ? 1 : null,
    ...(options.failFast
      ? { enableOfflineQueue: false, connectTimeout: 2000 }
      : {}),
  };
}

/**
 * Retry policy shared by every queue. Publish fan-out work is idempotent
 * (re-indexing or re-rendering a card twice is harmless), so retrying is always
 * safer than dropping the job.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};
