import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stateless operator session token: `base64url(payload).hmacSha256(payload)`.
 * The server stays stateless — no session store — and a tampered or expired
 * token fails verification. The secret never leaves the server.
 */
interface TokenPayload {
  iat: number;
  exp: number;
}

const sign = (data: string, secret: string): string =>
  createHmac('sha256', secret).update(data).digest('base64url');

export function createSessionToken(secret: string, opts: { now: number; ttlMs: number }): string {
  const payload: TokenPayload = { iat: opts.now, exp: opts.now + opts.ttlMs };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(secret: string, token: string, now: number): boolean {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  if (!body || !sig) return false;
  if (!constantTimeEqual(sig, sign(body, secret))) return false;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    return false;
  }
  return typeof payload.exp === 'number' && payload.exp > now;
}

/**
 * Length-independent constant-time string compare: both sides are hashed to a
 * fixed-width digest first, so timingSafeEqual never throws on unequal lengths
 * and the comparison leaks neither length nor content via timing.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}
