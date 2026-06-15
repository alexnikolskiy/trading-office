import type { InfraStatus, InfraSourceDomain, InfraSourceState } from '@trading-office/office-gateway';

export function sourceState(infra: InfraStatus | null | undefined, domain: InfraSourceDomain): InfraSourceState | undefined {
  return infra?.sources?.find((s) => s.domain === domain)?.state;
}
export const isGap = (state: InfraSourceState | undefined): boolean => state === 'gap';
// 'fixture' is intentionally treated as live — fixture mode serves real-looking
// rows and must NOT surface the gap/error/stale messages.
export const isLive = (state: InfraSourceState | undefined): boolean => state === 'live' || state === 'fixture';
export const isDegraded = (state: InfraSourceState | undefined): boolean => state === 'degraded';
export const isError = (state: InfraSourceState | undefined): boolean => state === 'error';
