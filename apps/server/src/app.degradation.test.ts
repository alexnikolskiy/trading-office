import { describe, it, expect, vi } from 'vitest';
import { OFFICE_API } from '@trading-office/office-gateway';
import { loadConfig } from './config';
import { OfficeEventBus } from './events/OfficeEventBus';
import { createOfficeApp } from './app';
import { TradingLabHttpClient } from './connector/tradinglab/TradingLabHttpClient';
import { TradingLabReadConnector } from './connector/tradinglab/TradingLabReadConnector';
import { LabReadSourceTracker } from './connector/tradinglab/labReadSource';
import { InfraAggregator } from './connector/InfraAggregator';
import { CompositeOfficeReadConnector } from './connector/CompositeOfficeReadConnector';

// End-to-end HTTP contract: an upstream trading-lab failure must degrade the
// dashboard (200 + empty + visible source state), never crash it (HTTP 500).
const TOKEN = 'super-secret-read-token';
const cfg = { readUrl: 'http://lab:3100', readToken: TOKEN, requestTimeoutMs: 1000 };

function appWith(fetchImpl: typeof fetch) {
  const tracker = new LabReadSourceTracker();
  const client = new TradingLabHttpClient({ ...cfg, fetchImpl });
  const read = new TradingLabReadConnector(client, () => 'T', tracker);
  // Auth-aware HEALTH probe stays green so the test isolates DATA degradation.
  const health = {
    getReadyz: async () => ({ status: 'ok' as const, checks: { db: true } }),
    getAuthz: async () => ({ status: 'ok' as const }),
  };
  const infra = new InfraAggregator(health, () => 'live', () => '2026-06-15T00:00:00.000Z', undefined, () => tracker.snapshot());
  const connector = new CompositeOfficeReadConnector({ read, infra, startBridge: () => () => {} });
  const { app } = createOfficeApp({ connector, bus: new OfficeEventBus(), config: loadConfig({}) });
  return { app, tracker };
}

const refused = () => vi.fn(async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
const responding = (status: number, body = '{}') =>
  vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
const malformed = () =>
  vi.fn(async () => new Response('<<not json>>', { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
const timingOut = () =>
  vi.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }) as unknown as typeof fetch;

const labReadDetail = async (app: ReturnType<typeof appWith>['app']) => {
  const infra = await (await app.request(OFFICE_API.infra)).json();
  return infra.sources.find((s: { domain: string }) => s.domain === 'trading-lab-read');
};

describe('office dashboard — trading-lab upstream degradation', () => {
  it('lab unreachable → aggregate endpoints return 200 + empty/default, never 500', async () => {
    const { app } = appWith(refused());
    for (const path of [OFFICE_API.hypotheses, OFFICE_API.backtests]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    }
    const res = await app.request(OFFICE_API.agentStatuses);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ evaluator: 'idle', 'perf-monitor': 'idle' });
  });

  it('lab connection refused → trading-lab-read source error/upstream_unreachable (200 infra)', async () => {
    const { app } = appWith(refused());
    await app.request(OFFICE_API.hypotheses); // trip the data source
    const src = await labReadDetail(app);
    expect(src).toMatchObject({ state: 'error', detail: 'upstream_unreachable' });
  });

  it('lab 401/403 → 200 aggregate + source degraded/auth_failed (not 500)', async () => {
    const { app } = appWith(responding(401));
    expect((await app.request(OFFICE_API.hypotheses)).status).toBe(200);
    expect(await labReadDetail(app)).toMatchObject({ state: 'degraded', detail: 'auth_failed' });
  });

  it('lab timeout → source error/upstream_timeout (not 500)', async () => {
    const { app } = appWith(timingOut());
    await app.request(OFFICE_API.backtests);
    expect(await labReadDetail(app)).toMatchObject({ state: 'error', detail: 'upstream_timeout' });
  });

  it('lab 5xx → source error/upstream_5xx (not 500)', async () => {
    const { app } = appWith(responding(503, 'boom'));
    await app.request(OFFICE_API.backtests);
    expect(await labReadDetail(app)).toMatchObject({ state: 'error', detail: 'upstream_5xx' });
  });

  it('malformed lab response → source error/upstream_bad_response (not 500)', async () => {
    const { app } = appWith(malformed());
    expect((await app.request(OFFICE_API.hypotheses)).status).toBe(200);
    expect(await labReadDetail(app)).toMatchObject({ state: 'error', detail: 'upstream_bad_response' });
  });

  it('strict detail endpoint (agent activity) → typed non-500 status on lab failure', async () => {
    const { app } = appWith(responding(401));
    const res = await app.request(OFFICE_API.agentActivity('boss'));
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
    expect((await res.json()).error.code).toBe('auth_failed');

    const down = appWith(refused());
    const res2 = await down.app.request(OFFICE_API.agentActivity('boss'));
    expect(res2.status).toBe(502);
    expect(res2.status).not.toBe(500);
  });

  it('never leaks the read token into any response or source state', async () => {
    const { app } = appWith(responding(401));
    for (const path of [OFFICE_API.hypotheses, OFFICE_API.agentStatuses, OFFICE_API.infra, OFFICE_API.agentActivity('boss')]) {
      const text = await (await app.request(path)).text();
      expect(text).not.toContain(TOKEN);
    }
  });
});
