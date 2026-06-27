import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken, constantTimeEqual } from './sessionToken';

const SECRET = 'super-secret-key';

describe('session token', () => {
  it('verifies a token it just issued (within its ttl)', () => {
    const token = createSessionToken(SECRET, { now: 1_000, ttlMs: 60_000 });
    expect(verifySessionToken(SECRET, token, 1_000)).toBe(true);
    expect(verifySessionToken(SECRET, token, 60_000)).toBe(true); // still inside ttl
  });

  it('rejects an expired token', () => {
    const token = createSessionToken(SECRET, { now: 1_000, ttlMs: 60_000 });
    expect(verifySessionToken(SECRET, token, 61_001)).toBe(false);
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken(SECRET, { now: 1_000, ttlMs: 60_000 });
    expect(verifySessionToken('other-secret', token, 1_000)).toBe(false);
  });

  it('rejects a tampered payload (signature no longer matches)', () => {
    const token = createSessionToken(SECRET, { now: 1_000, ttlMs: 60_000 });
    const [, sig] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ iat: 0, exp: 9_999_999_999 })).toString('base64url')}.${sig}`;
    expect(verifySessionToken(SECRET, forged, 1_000)).toBe(false);
  });

  it('rejects malformed / empty tokens without throwing', () => {
    for (const bad of ['', 'nope', 'a.b.c', 'only-one-part', '.', 'x.']) {
      expect(verifySessionToken(SECRET, bad, 1_000)).toBe(false);
    }
  });
});

describe('constantTimeEqual', () => {
  it('is true for equal strings and false for different ones (any length)', () => {
    expect(constantTimeEqual('hunter2', 'hunter2')).toBe(true);
    expect(constantTimeEqual('hunter2', 'hunter3')).toBe(false);
    expect(constantTimeEqual('short', 'a-much-longer-string')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});
