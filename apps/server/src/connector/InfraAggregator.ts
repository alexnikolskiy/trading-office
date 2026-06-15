import type { InfraStatus, InfraSource, InfraSourceState } from '@trading-office/office-gateway';
import type { TradingLabHttpClient } from './tradinglab/TradingLabHttpClient';
import type { PlatformInfra } from './platform/PlatformMonitoringConnector';

type ReadyzClient = Pick<TradingLabHttpClient, 'getReadyz' | 'getAuthz'>;
type StreamState = Extract<InfraSourceState, 'live' | 'degraded' | 'error'>;

/** True only for the office "upstream returned 401/403" error code — never logs the token. */
function isUnauthorized(err: unknown): boolean {
  return (err as { office?: { code?: string } } | null)?.office?.code === 'upstream_unauthorized';
}

export class InfraAggregator {
  constructor(
    private readonly client: ReadyzClient,
    private readonly streamState: () => StreamState,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly platformInfra?: () => Promise<PlatformInfra>,
  ) {}

  async getInfraStatus(): Promise<InfraStatus> {
    const services: InfraStatus['services'] = [{ name: 'office-server', up: true, detail: 'ok' }];
    let readApi: InfraSourceState = 'live';
    let readDetail = 'reachable';
    try {
      // Step 1: open process/DB readiness probe (no token).
      const ready = await this.client.getReadyz();
      if (ready.status !== 'ok') {
        services.push({ name: 'trading-lab-read-api', up: false, detail: `readyz: ${ready.status}` });
        readApi = 'degraded';
        readDetail = `readyz: ${ready.status}`;
      } else {
        // Step 2: /readyz says the process is up, but that says nothing about credentials.
        // Probe the auth-gated /v1/authz with the SAME token office uses for real reads —
        // otherwise a wrong read token would show "live" while every /v1/* read 401s.
        try {
          await this.client.getAuthz();
          services.push({ name: 'trading-lab-read-api', up: true, detail: 'ok' });
          readApi = 'live';
          readDetail = 'reachable';
        } catch (e) {
          if (isUnauthorized(e)) {
            services.push({ name: 'trading-lab-read-api', up: false, detail: 'auth_failed' });
            readApi = 'degraded';
            readDetail = 'auth_failed';
          } else {
            services.push({ name: 'trading-lab-read-api', up: false, detail: 'unreachable' });
            readApi = 'error';
            readDetail = 'unreachable';
          }
        }
      }
    } catch {
      services.push({ name: 'trading-lab-read-api', up: false, detail: 'unreachable' });
      readApi = 'error';
      readDetail = 'unreachable';
    }
    const stream = this.streamState();
    const sources: InfraSource[] = [
      { domain: 'office-server', state: 'live', detail: 'office server' },
      { domain: 'trading-lab-read-api', state: readApi, detail: readDetail },
      { domain: 'trading-lab-stream', state: stream, detail: `stream ${stream}` },
    ];
    sources.push({ domain: 'knowledge', state: 'gap', detail: 'Knowledge source is not connected yet' });
    if (this.platformInfra) {
      const p = await this.platformInfra().catch((): PlatformInfra => ({ services: [], sources: [{ domain: 'bot-health', state: 'error', detail: 'platform infra unavailable' }] }));
      services.push(...p.services);
      sources.push(...p.sources);
    } else {
      sources.push({ domain: 'bot-health', state: 'gap', detail: 'Bot runtime monitoring is not connected yet' });
    }
    return { services, queues: [], lastSync: this.now(), sources };
  }
}
