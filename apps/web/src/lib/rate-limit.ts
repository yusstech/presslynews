import 'server-only';

/**
 * A fixed-window rate limiter held in process memory.
 *
 * In memory rather than in Redis on purpose. Render runs a long-lived Node
 * process, not a serverless function, so a module-level Map survives between
 * requests and does the job. Upstash is provisioned but nothing reads it, and
 * reintroducing a network round-trip — plus a service that can be down — to
 * throttle one administrator's login is the shape of infrastructure the
 * single-app collapse removed.
 *
 * **The limits are per instance.** Scale to N instances and an attacker gets N
 * times the budget. That is an acceptable trade at one instance and one
 * account; it stops credential stuffing, which is what unauthenticated login is
 * actually exposed to. If this ever fronts a real editorial team on more than
 * one instance, move the counter to Redis — the call sites will not change.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Bound the map so a flood of distinct keys cannot grow it without limit. */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfter: number;
}

/**
 * Count one attempt against `key`. Returns whether it is allowed.
 *
 * Sweeping expired entries on write keeps this to one data structure with no
 * timer holding the process open.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      // Still full of live windows: refuse rather than grow. Under an attack
      // large enough to reach here, failing closed is the right direction.
      if (windows.size >= MAX_KEYS) return { ok: false, retryAfter: Math.ceil(windowMs / 1000) };
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Clears a key's window — call after a success so a legitimate user who
 *  mistyped twice is not still counted against the limit. */
export function resetRateLimit(key: string): void {
  windows.delete(key);
}

/**
 * Best-effort client address.
 *
 * Render terminates TLS at its edge and forwards the caller in
 * `x-forwarded-for`; the first entry is the client. This is spoofable by
 * anything that can reach the app directly, which is why it is one of two keys
 * and not the only one — the email is rate-limited separately, so spreading an
 * attack across addresses still runs into the per-account limit.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
