import type { InfraSourceState } from '@trading-office/office-gateway';

/**
 * Stable, typed taxonomy for trading-lab read-API upstream failures. Mirrors the
 * platform connector's "degrade, don't crash" posture: an upstream lab failure
 * becomes a typed source state the operator can see, never a generic HTTP 500.
 *
 * Codes are part of the operator-facing contract — keep them stable.
 */
export type LabReadReasonCode =
  | 'auth_failed' // lab read returned 401/403 (token rejected)
  | 'upstream_unreachable' // network error / ECONNREFUSED / ENOTFOUND
  | 'upstream_timeout' // request aborted by the client timeout
  | 'upstream_5xx' // lab read returned a 5xx
  | 'upstream_bad_response' // non-JSON / unexpected shape
  | 'upstream_error'; // unknown / unclassified failure

/** The lab read data source as surfaced to the operator (infra `trading-lab-read`). */
export interface LabReadSourceState {
  /** degraded → reachable but unusable (e.g. wrong token); error → unreachable/broken. */
  state: Extract<InfraSourceState, 'live' | 'degraded' | 'error'>;
  /** null only when state is `live`. */
  reasonCode: LabReadReasonCode | null;
  /** Safe, static, token-free human message. Never echoes raw error/URL/token. */
  message: string;
}

/**
 * Safe, static messages keyed by reason code. Intentionally NOT derived from the
 * raw error: a thrown error's message can carry the upstream URL; we never want a
 * token, stack trace, or URL secret to reach a response or log.
 */
const REASON_MESSAGE: Record<LabReadReasonCode, string> = {
  auth_failed: 'trading-lab read rejected the configured credentials',
  upstream_unreachable: 'trading-lab read is unreachable',
  upstream_timeout: 'trading-lab read timed out',
  upstream_5xx: 'trading-lab read returned a server error',
  upstream_bad_response: 'trading-lab read returned a malformed response',
  upstream_error: 'trading-lab read failed',
};

export const labReasonMessage = (code: LabReadReasonCode): string => REASON_MESSAGE[code];

interface OfficeErrorShape {
  office?: { code?: string; reason?: LabReadReasonCode };
}

/**
 * Normalize any thrown value into a stable {@link LabReadReasonCode}. Prefers the
 * granular `office.reason` attached by {@link TradingLabHttpClient}; falls back to
 * the coarse `office.code` (kept stable for the auth-aware health probe), then to
 * `upstream_error` for anything unrecognized. Reads no token, throws never.
 */
export function classifyLabUpstreamError(err: unknown): LabReadReasonCode {
  const office = (err as OfficeErrorShape | null)?.office;
  if (office?.reason) return office.reason;
  switch (office?.code) {
    case 'upstream_unauthorized':
      return 'auth_failed';
    case 'upstream_unavailable':
      return 'upstream_unreachable';
    default:
      return 'upstream_error';
  }
}

/**
 * In-memory holder for the most recent lab read outcome. Written by the read
 * connector on every aggregate read, read by the InfraAggregator to surface the
 * `trading-lab-read` source. Optimistically `live` until a read is attempted.
 */
export class LabReadSourceTracker {
  private current: LabReadSourceState = { state: 'live', reasonCode: null, message: 'reachable' };

  snapshot(): LabReadSourceState {
    return this.current;
  }

  recordSuccess(): void {
    this.current = { state: 'live', reasonCode: null, message: 'reachable' };
  }

  recordFailure(err: unknown): LabReadSourceState {
    const reasonCode = classifyLabUpstreamError(err);
    // auth_failed → reachable-but-rejected → degraded (matches the auth-aware
    // health probe); every other upstream failure → error.
    const state: LabReadSourceState['state'] = reasonCode === 'auth_failed' ? 'degraded' : 'error';
    this.current = { state, reasonCode, message: labReasonMessage(reasonCode) };
    return this.current;
  }
}
