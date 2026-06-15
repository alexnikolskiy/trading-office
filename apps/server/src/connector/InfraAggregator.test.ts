import { describe, it, expect } from 'vitest';
import { InfraAggregator } from './InfraAggregator';

const NOW = () => '2026-06-14T00:00:00.000Z';
const byDomain = (infra: Awaited<ReturnType<InfraAggregator['getInfraStatus']>>) =>
  Object.fromEntries((infra.sources ?? []).map((s) => [s.domain, s.state]));

const unauthorized = () => Object.assign(new Error('trading-lab read returned 401'), {
  office: { code: 'upstream_unauthorized' as const, message: 'trading-lab read returned 401' },
});

describe('InfraAggregator', () => {
  it('read-api live when readyz ok AND authenticated probe ok; knowledge/bot-health gaps', async () => {
    const client = {
      getReadyz: async () => ({ status: 'ok' as const, checks: { db: true } }),
      getAuthz: async () => ({ status: 'ok' as const }),
    };
    const infra = await new InfraAggregator(client, () => 'live', NOW).getInfraStatus();
    const d = byDomain(infra);
    expect(d['trading-lab-read-api']).toBe('live');
    expect(d['trading-lab-stream']).toBe('live');
    expect(d['knowledge']).toBe('gap');
    expect(d['bot-health']).toBe('gap');
    expect(infra.queues).toEqual([]);
    expect(infra.lastSync).toBe('2026-06-14T00:00:00.000Z');
  });

  it('read-api NOT live when readyz ok but authenticated probe is 401 → degraded/auth_failed', async () => {
    const client = {
      getReadyz: async () => ({ status: 'ok' as const, checks: { db: true } }),
      getAuthz: async () => { throw unauthorized(); },
    };
    const infra = await new InfraAggregator(client, () => 'live', NOW).getInfraStatus();
    const src = infra.sources!.find((s) => s.domain === 'trading-lab-read-api')!;
    expect(src.state).toBe('degraded');
    expect(src.state).not.toBe('live');
    expect(src.detail).toBe('auth_failed');
    const svc = infra.services.find((s) => s.name === 'trading-lab-read-api')!;
    expect(svc.up).toBe(false);
    expect(svc.detail).toBe('auth_failed');
  });

  it('does not leak the read token into the snapshot even when the upstream error carries it', async () => {
    const TOKEN = 'super-secret-read-token';
    const client = {
      getReadyz: async () => ({ status: 'ok' as const, checks: { db: true } }),
      getAuthz: async () => {
        throw Object.assign(new Error(`401 for Bearer ${TOKEN}`), {
          office: { code: 'upstream_unauthorized' as const, message: `rejected Bearer ${TOKEN}` },
        });
      },
    };
    const infra = await new InfraAggregator(client, () => 'live', NOW).getInfraStatus();
    expect(JSON.stringify(infra)).not.toContain(TOKEN);
  });

  it('read-api degraded when readyz reports not-ready (process/db), authz not consulted', async () => {
    let authzCalled = false;
    const client = {
      getReadyz: async () => ({ status: 'degraded' as const, checks: { db: false } }),
      getAuthz: async () => { authzCalled = true; return { status: 'ok' as const }; },
    };
    const infra = await new InfraAggregator(client, () => 'live', NOW).getInfraStatus();
    expect(byDomain(infra)['trading-lab-read-api']).toBe('degraded');
    expect(authzCalled).toBe(false);
  });

  it('read-api error when readyz throws; stream state reflected', async () => {
    const client = {
      getReadyz: async () => { throw new Error('down'); },
      getAuthz: async () => ({ status: 'ok' as const }),
    };
    const infra = await new InfraAggregator(client, () => 'error', NOW).getInfraStatus();
    const d = byDomain(infra);
    expect(d['trading-lab-read-api']).toBe('error');
    expect(d['trading-lab-stream']).toBe('error');
  });
});
