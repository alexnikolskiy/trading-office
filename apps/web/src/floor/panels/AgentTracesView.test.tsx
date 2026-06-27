import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentTracesView } from './AgentTracesView';
import * as RuntimeContext from '../../runtime/RuntimeContext';

const withGateway = (getAgentTraces: () => Promise<unknown>) =>
  vi.spyOn(RuntimeContext, 'useGateway').mockReturnValue({ getAgentTraces } as never);

describe('AgentTracesView', () => {
  it('renders a "tracing disabled" state from the reason code', async () => {
    withGateway(async () => ({ agentId: 'analyst', reasonCode: 'tracing-disabled', traces: [] }));
    render(<AgentTracesView agentId="analyst" />);
    expect(await screen.findByText(/tracing.*disabled/i)).toBeTruthy();
  });

  it('renders a "no traces" state', async () => {
    withGateway(async () => ({ agentId: 'analyst', reasonCode: 'no-traces', traces: [] }));
    render(<AgentTracesView agentId="analyst" />);
    expect(await screen.findByText(/no traces/i)).toBeTruthy();
  });

  it('lists traces and expands the span tree on click', async () => {
    withGateway(async () => ({
      agentId: 'analyst', reasonCode: null,
      traces: [{ traceId: 't1', startTime: '2026-06-27T10:00:00.000Z', status: 'ok', latencyMs: 1200,
        tokens: { total: 15 }, costUsd: null, rootName: 'strategy-analyst',
        spans: [
          { spanId: 'a', parentSpanId: null, name: 'strategy-analyst', kind: 'AGENT', startTime: 'x', latencyMs: 1200, status: 'ok' },
          { spanId: 'b', parentSpanId: 'a', name: 'llm-call', kind: 'LLM', startTime: 'x', latencyMs: 800, status: 'ok' },
        ] }],
    }));
    render(<AgentTracesView agentId="analyst" />);
    const row = await screen.findByText(/strategy-analyst/);
    expect(screen.queryByText('llm-call')).toBeNull();   // collapsed initially
    fireEvent.click(row);
    expect(await screen.findByText('llm-call')).toBeTruthy(); // expanded
  });
});
