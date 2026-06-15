import { describe, it, expect } from 'vitest';
import { PlatformMonitoringConnector } from './PlatformMonitoringConnector';
import type { PlatformHttpClient } from './PlatformHttpClient';
import type { BotRunRecord, PageEnvelope } from './platformDtos';

const run = (over: Partial<BotRunRecord>): BotRunRecord => ({
  runId: 'r',
  mode: 'live',
  status: 'running',
  strategy: { name: 's', version: '1' },
  startedAtMs: 0,
  finishedAtMs: null,
  lastSeenMs: 0,
  symbols: [],
  ...over,
});
const env = (items: BotRunRecord[]): PageEnvelope<BotRunRecord> => ({ items, nextCursor: null, asOf: 0 });

function fakeClient(runsByMode: Record<string, PageEnvelope<BotRunRecord> | Error>): PlatformHttpClient {
  return {
    getRuns: async (m: 'live' | 'paper') => {
      const v = runsByMode[m];
      if (v instanceof Error) throw v;
      return v;
    },
  } as unknown as PlatformHttpClient;
}

describe('PlatformMonitoringConnector.getBotHealth', () => {
  it('merges live + paper, maps, filters backtest (defense-in-depth)', async () => {
    const c = new PlatformMonitoringConnector(
      fakeClient({
        live: env([run({ runId: 'L', mode: 'live' }), run({ runId: 'B', mode: 'backtest' })]),
        paper: env([run({ runId: 'P', mode: 'paper' })]),
      }),
      () => 1000,
    );
    const rows = await c.getBotHealth();
    expect(rows.map((r) => r.id).sort()).toEqual(['L', 'P']);
  });

  it('either query failing → [] (never throws)', async () => {
    const c = new PlatformMonitoringConnector(
      fakeClient({ live: env([run({})]), paper: new Error('boom') }),
      () => 0,
    );
    await expect(c.getBotHealth()).resolves.toEqual([]);
  });

  it('both 200 empty → [] (valid no-active state)', async () => {
    const c = new PlatformMonitoringConnector(
      fakeClient({ live: env([]), paper: env([]) }),
      () => 0,
    );
    await expect(c.getBotHealth()).resolves.toEqual([]);
  });
});

describe('getPlatformInfra bot-health source-state', () => {
  it('runs reachable → bot-health live', async () => {
    const c = new PlatformMonitoringConnector(
      fakeClient({ live: env([]), paper: env([]) }),
      () => 0,
    );
    const infra = await c.getPlatformInfra();
    expect(infra.sources.find((s) => s.domain === 'bot-health')).toMatchObject({ state: 'live' });
  });

  it('runs unreachable → bot-health error', async () => {
    const c = new PlatformMonitoringConnector(
      fakeClient({ live: new Error('down'), paper: env([]) }),
      () => 0,
    );
    const infra = await c.getPlatformInfra();
    expect(infra.sources.find((s) => s.domain === 'bot-health')).toMatchObject({ state: 'error' });
  });
});
