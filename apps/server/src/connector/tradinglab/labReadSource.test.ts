import { describe, it, expect } from 'vitest';
import { classifyLabUpstreamError, labReasonMessage, LabReadSourceTracker } from './labReadSource';

const officeErr = (code: string, reason?: string) =>
  Object.assign(new Error('x'), { office: { code, message: 'x', ...(reason ? { reason } : {}) } });

describe('classifyLabUpstreamError', () => {
  it('prefers the granular office.reason', () => {
    expect(classifyLabUpstreamError(officeErr('upstream_unavailable', 'upstream_timeout'))).toBe('upstream_timeout');
    expect(classifyLabUpstreamError(officeErr('upstream_unavailable', 'upstream_5xx'))).toBe('upstream_5xx');
    expect(classifyLabUpstreamError(officeErr('upstream_unavailable', 'upstream_bad_response'))).toBe('upstream_bad_response');
    expect(classifyLabUpstreamError(officeErr('upstream_unauthorized', 'auth_failed'))).toBe('auth_failed');
  });

  it('falls back to the coarse office.code when reason is absent', () => {
    expect(classifyLabUpstreamError(officeErr('upstream_unauthorized'))).toBe('auth_failed');
    expect(classifyLabUpstreamError(officeErr('upstream_unavailable'))).toBe('upstream_unreachable');
    expect(classifyLabUpstreamError(officeErr('upstream_bad_request'))).toBe('upstream_error');
  });

  it('falls back to upstream_error for anything unrecognized', () => {
    expect(classifyLabUpstreamError(new Error('boom'))).toBe('upstream_error');
    expect(classifyLabUpstreamError(null)).toBe('upstream_error');
    expect(classifyLabUpstreamError('nope')).toBe('upstream_error');
  });
});

describe('LabReadSourceTracker', () => {
  it('starts optimistically live', () => {
    expect(new LabReadSourceTracker().snapshot()).toEqual({ state: 'live', reasonCode: null, message: 'reachable' });
  });

  it('auth_failed → degraded; every other upstream failure → error', () => {
    const t = new LabReadSourceTracker();
    t.recordFailure(officeErr('upstream_unauthorized', 'auth_failed'));
    expect(t.snapshot()).toMatchObject({ state: 'degraded', reasonCode: 'auth_failed' });
    t.recordFailure(officeErr('upstream_unavailable', 'upstream_5xx'));
    expect(t.snapshot()).toMatchObject({ state: 'error', reasonCode: 'upstream_5xx', message: labReasonMessage('upstream_5xx') });
  });

  it('recordSuccess resets to live', () => {
    const t = new LabReadSourceTracker();
    t.recordFailure(officeErr('upstream_unavailable', 'upstream_timeout'));
    t.recordSuccess();
    expect(t.snapshot()).toEqual({ state: 'live', reasonCode: null, message: 'reachable' });
  });

  it('uses a static, token-free message even when the raw error carries the token', () => {
    const TOKEN = 'super-secret-read-token';
    const t = new LabReadSourceTracker();
    t.recordFailure(
      Object.assign(new Error(`401 Bearer ${TOKEN}`), {
        office: { code: 'upstream_unauthorized', message: `rejected Bearer ${TOKEN}`, reason: 'auth_failed' },
      }),
    );
    expect(JSON.stringify(t.snapshot())).not.toContain(TOKEN);
    expect(t.snapshot().message).toBe(labReasonMessage('auth_failed'));
  });
});
