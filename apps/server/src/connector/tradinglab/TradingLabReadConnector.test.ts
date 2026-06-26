import { describe, it, expect, vi } from 'vitest';
import { TradingLabHttpClient } from './TradingLabHttpClient';
import { TradingLabReadConnector } from './TradingLabReadConnector';
import { LabReadSourceTracker } from './labReadSource';

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
const cfg = { readUrl: 'http://lab:3100', readToken: 't', requestTimeoutMs: 1000 };
const conn = (fetchImpl: typeof fetch) => new TradingLabReadConnector(new TradingLabHttpClient({ ...cfg, fetchImpl }), () => 'T');

describe('TradingLabReadConnector', () => {
  it('maps /v1/agents (cursor envelope) → AgentStatusMap with office ids', async () => {
    const c = conn(vi.fn(async () => json({ data: [
      { agentId: 'analyst', status: 'working', currentTaskId: null, lastEvent: null },
      { agentId: 'system', status: 'idle', currentTaskId: null, lastEvent: null },
    ], cursor: null })) as unknown as typeof fetch);
    expect(await c.getAgentStatuses()).toEqual({ analyst: 'thinking', boss: 'idle' });
  });

  it('maps /v1/hypotheses (page envelope) → Hypothesis[]', async () => {
    const c = conn(vi.fn(async () => json({ data: [
      { id: 'h1', profileId: 'p', thesis: 'T', targetBehavior: 'B', status: 'rejected', confidence: 0.2, expectedEffect: { metric: 'm', direction: 'decrease' }, createdAt: 'x', updatedAt: 'y' },
    ], page: { nextCursor: null, limit: 20 } })) as unknown as typeof fetch);
    expect(await c.getHypotheses()).toEqual([{ id: 'h1', title: 'T', summary: 'B', stage: 'rejected' }]);
  });

  it('maps /v1/backtests → BacktestSummary[] preserving nulls', async () => {
    const c = conn(vi.fn(async () => json({ data: [
      { id: 'b1', hypothesisId: 'h1', status: 'completed', metrics: { netPnlUsd: null, netPnlPct: null, totalTrades: null, winRate: null, profitFactor: null, maxDrawdownPct: null, expectancyUsd: null, sharpe: null, topTradeContributionPct: null }, submittedAt: 'x', finishedAt: null, createdAt: 'x', updatedAt: 'y' },
    ], page: { nextCursor: null, limit: 20 } })) as unknown as typeof fetch);
    expect((await c.getBacktests())[0]).toMatchObject({ id: 'b1', pnlPct: null, winRatePct: null, strategy: null });
  });

  it('getAgentActivity("boss") calls /v1/agents/system and maps the result back to boss', async () => {
    const fetchImpl = vi.fn(async () => json({
      agentId: 'system', status: 'working',
      currentTask: { id: 't1', type: 'research.run_cycle', status: 'working' },
      trace: [{ id: 'e1', ts: 'x', type: 'research.run_cycle.started', taskId: 't1', level: 'info', summary: 'Started' }],
    }));
    const c = conn(fetchImpl as unknown as typeof fetch);
    const activity = await c.getAgentActivity('boss');
    expect(String((fetchImpl.mock.calls[0] as unknown as [string])[0])).toBe('http://lab:3100/v1/agents/system');
    expect(activity.agentId).toBe('boss');
  });

  it('getAgentActivity for a no-source agent does NOT call lab and returns an honest idle gap', async () => {
    const fetchImpl = vi.fn(async () => json({}));
    for (const id of ['evaluator', 'perf-monitor']) {
      const c = new TradingLabReadConnector(new TradingLabHttpClient({ ...cfg, fetchImpl }), () => 'T');
      const a = await c.getAgentActivity(id);
      expect(a).toEqual({ agentId: id, status: 'idle', currentTask: null, logs: [{ ts: 'T', level: 'info', text: 'No trading-lab source connected yet' }] });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('TradingLabReadConnector — graceful degradation (no throw on upstream lab failure)', () => {
  const status = (s: number, body = '{}') => new Response(body, { status: s });
  const withTracker = (fetchImpl: typeof fetch) => {
    const tracker = new LabReadSourceTracker();
    const c = new TradingLabReadConnector(new TradingLabHttpClient({ ...cfg, fetchImpl }), () => 'T', tracker);
    return { c, tracker };
  };

  it('connection refused → [] + idle projection + tracker error/upstream_unreachable (no throw)', async () => {
    const { c, tracker } = withTracker(vi.fn(async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch);
    expect(await c.getHypotheses()).toEqual([]);
    expect(await c.getBacktests()).toEqual([]);
    expect(await c.getAgentStatuses()).toEqual({});
    expect(tracker.snapshot()).toMatchObject({ state: 'error', reasonCode: 'upstream_unreachable' });
  });

  it('lab 401 → empty projection + tracker degraded/auth_failed', async () => {
    const { c, tracker } = withTracker(vi.fn(async () => status(401)) as unknown as typeof fetch);
    expect(await c.getHypotheses()).toEqual([]);
    expect(tracker.snapshot()).toMatchObject({ state: 'degraded', reasonCode: 'auth_failed' });
  });

  it('lab 5xx → tracker error/upstream_5xx', async () => {
    const { c, tracker } = withTracker(vi.fn(async () => status(500, 'boom')) as unknown as typeof fetch);
    expect(await c.getBacktests()).toEqual([]);
    expect(tracker.snapshot()).toMatchObject({ state: 'error', reasonCode: 'upstream_5xx' });
  });

  it('lab timeout (AbortError) → tracker error/upstream_timeout', async () => {
    const { c, tracker } = withTracker(vi.fn(async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }) as unknown as typeof fetch);
    expect(await c.getHypotheses()).toEqual([]);
    expect(tracker.snapshot()).toMatchObject({ state: 'error', reasonCode: 'upstream_timeout' });
  });

  it('malformed lab response → tracker error/upstream_bad_response', async () => {
    const { c, tracker } = withTracker(vi.fn(async () => new Response('<<not json>>', { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch);
    expect(await c.getHypotheses()).toEqual([]);
    expect(tracker.snapshot()).toMatchObject({ state: 'error', reasonCode: 'upstream_bad_response' });
  });

  it('a recovered read resets the tracker to live', async () => {
    let fail = true;
    const okEnvelope = new Response(JSON.stringify({ data: [], page: { nextCursor: null, limit: 20 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    const fetchImpl = vi.fn(async () => (fail ? status(500) : okEnvelope));
    const { c, tracker } = withTracker(fetchImpl as unknown as typeof fetch);
    await c.getHypotheses();
    expect(tracker.snapshot().state).toBe('error');
    fail = false;
    await c.getHypotheses();
    expect(tracker.snapshot()).toEqual({ state: 'live', reasonCode: null, message: 'reachable' });
  });

  it('strict getAgentActivity still throws a typed upstream error (mapped by app onError, not swallowed)', async () => {
    const { c } = withTracker(vi.fn(async () => status(401)) as unknown as typeof fetch);
    await expect(c.getAgentActivity('boss')).rejects.toMatchObject({ office: { code: 'upstream_unauthorized', reason: 'auth_failed' } });
  });
});
