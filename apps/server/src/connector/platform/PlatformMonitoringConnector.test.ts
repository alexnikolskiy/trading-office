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

import type { OpsCapabilityDescriptor, RuntimeHealthCollection, MarketServiceHealthSnapshot, ExecutionHealthSnapshot, SourceCoverageSnapshot } from './platformDtos';

function fullClient(over: Partial<Record<'runs'|'runtime'|'market'|'execution'|'coverage'|'discover', unknown | Error>>): PlatformHttpClient {
  const ok = {
    runs: { items: [], nextCursor: null, asOf: 0 },
    runtime: { entries: [{ source: 'long_oi', status: 'ok', indicators: {}, availability: 'available', capturedAtMs: 0 }], asOf: 0 } as RuntimeHealthCollection,
    market: { status: 'ok', diagnostics: {}, streamAgeMs: 1, availability: 'available', asOf: 0 } as MarketServiceHealthSnapshot,
    execution: { status: 'ok', recentCounts: {}, lastEventMs: 1, availability: 'available', asOf: 0 } as ExecutionHealthSnapshot,
    coverage: { entries: [{ source: 'long_oi', kind: 'trades', state: 'present', freshnessAgeMs: 1 }], availability: 'available', asOf: 0 } as SourceCoverageSnapshot,
    discover: { opsContractVersion: '1', capabilities: { readOnly: true, execution: false, credentials: false, ingestion: false, mutation: false }, resources: [] } as OpsCapabilityDescriptor,
  };
  const pick = (k: keyof typeof ok) => { const v = over[k as keyof typeof over]; if (v instanceof Error) return () => Promise.reject(v); return () => Promise.resolve(v ?? ok[k]); };
  return { getRuns: pick('runs'), getRuntimeHealth: pick('runtime'), getMarketHealth: pick('market'), getExecutionHealth: pick('execution'), getCoverage: pick('coverage'), getDiscover: pick('discover') } as unknown as PlatformHttpClient;
}

describe('getPlatformInfra platform-* domains', () => {
  const stateOf = (infra: { sources: { domain: string; state: string }[] }, d: string) => infra.sources.find((s) => s.domain === d)?.state;
  it('all reachable → all live; ops-api live', async () => {
    const infra = await new PlatformMonitoringConnector(fullClient({}), () => 0).getPlatformInfra();
    for (const d of ['platform-ops-api', 'platform-runtime', 'platform-market', 'platform-execution', 'platform-coverage', 'bot-health']) expect(stateOf(infra, d)).toBe('live');
  });
  it('only /ops/discover down, others ok → ops-api degraded; others live (no suppression)', async () => {
    const infra = await new PlatformMonitoringConnector(fullClient({ discover: new Error('x') }), () => 0).getPlatformInfra();
    expect(stateOf(infra, 'platform-ops-api')).toBe('degraded');
    expect(stateOf(infra, 'platform-runtime')).toBe('live');
    expect(stateOf(infra, 'platform-market')).toBe('live');
  });
  it('whole client down → ops-api error; dependents error', async () => {
    const e = new Error('down');
    const infra = await new PlatformMonitoringConnector(fullClient({ runs: e, runtime: e, market: e, execution: e, coverage: e, discover: e }), () => 0).getPlatformInfra();
    expect(stateOf(infra, 'platform-ops-api')).toBe('error');
    expect(stateOf(infra, 'platform-runtime')).toBe('error');
  });
  it('market unavailable → platform-market gap; others unaffected', async () => {
    const infra = await new PlatformMonitoringConnector(fullClient({ market: { status: 'down', diagnostics: {}, streamAgeMs: null, availability: 'unavailable', asOf: 0 } }), () => 0).getPlatformInfra();
    expect(stateOf(infra, 'platform-market')).toBe('gap');
    expect(stateOf(infra, 'platform-runtime')).toBe('live');
  });
});
