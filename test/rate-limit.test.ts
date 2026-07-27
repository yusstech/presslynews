import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';

/**
 * The limiter holds its windows in a module-level Map, so each test uses its
 * own key rather than reaching for a reset that production never calls.
 */
let n = 0;
const key = () => `test-key-${n++}`;

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('allows attempts up to the limit', () => {
    const k = key();
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60_000).ok).toBe(true);
  });

  it('refuses the attempt after the limit', () => {
    const k = key();
    for (let i = 0; i < 5; i++) rateLimit(k, 5, 60_000);
    expect(rateLimit(k, 5, 60_000).ok).toBe(false);
  });

  it('reports how long until the window resets', () => {
    const k = key();
    for (let i = 0; i < 6; i++) rateLimit(k, 5, 60_000);
    vi.advanceTimersByTime(20_000);
    const result = rateLimit(k, 5, 60_000);
    expect(result.ok).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(40);
  });

  it('never reports a retryAfter of zero while blocking', () => {
    // A Retry-After of 0 tells a client to retry immediately, which is the one
    // thing a blocked client must not do.
    const k = key();
    for (let i = 0; i < 6; i++) rateLimit(k, 5, 60_000);
    vi.advanceTimersByTime(59_900);
    expect(rateLimit(k, 5, 60_000).retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('lets attempts through again once the window passes', () => {
    const k = key();
    for (let i = 0; i < 6; i++) rateLimit(k, 5, 60_000);
    expect(rateLimit(k, 5, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit(k, 5, 60_000).ok).toBe(true);
  });

  it('counts each key independently', () => {
    const a = key();
    const b = key();
    for (let i = 0; i < 6; i++) rateLimit(a, 5, 60_000);
    expect(rateLimit(a, 5, 60_000).ok).toBe(false);
    // One address being throttled must not lock out everyone else.
    expect(rateLimit(b, 5, 60_000).ok).toBe(true);
  });

  it('forgets a key after resetRateLimit', () => {
    const k = key();
    for (let i = 0; i < 5; i++) rateLimit(k, 5, 60_000);
    // A successful sign-in should not leave earlier mistypes counted.
    resetRateLimit(k);
    expect(rateLimit(k, 5, 60_000).ok).toBe(true);
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => new Request('https://x.test', { headers });

  it('takes the first entry of x-forwarded-for — the client, not the proxies', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' }))).toBe(
      '203.0.113.9',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(clientIp(req({ 'x-forwarded-for': '  203.0.113.9  , 10.0.0.1' }))).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('returns a constant when there is no address header', () => {
    // Everyone shares one bucket rather than each request getting a fresh one,
    // which would make the limiter a no-op.
    expect(clientIp(req({}))).toBe('unknown');
  });
});
