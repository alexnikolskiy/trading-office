import { useState, type ReactElement } from 'react';
import { useGateway } from '../../runtime/RuntimeContext';
import { useResource } from './useResource';
import { PanelState } from './PanelChrome';
import type { Trace, TraceSpan } from '@trading-office/office-gateway';

const REASON_TEXT: Record<string, string> = {
  'tracing-disabled': 'Tracing is disabled for this environment.',
  'phoenix-unreachable': 'Phoenix is currently unreachable.',
  'no-traces': 'No traces for this agent yet.',
};

function SpanTree({ spans }: { spans: TraceSpan[] }) {
  const childrenOf = (id: string | null) => spans.filter((s) => s.parentSpanId === id);
  const renderSpans = (parentId: string | null, depth: number): ReactElement[] =>
    childrenOf(parentId).flatMap((s) => [
      <div key={s.spanId} className="trace__span" style={{ paddingLeft: depth * 12 }}>
        <span className={`trace__kind trace__kind--${s.kind.toLowerCase()}`}>{s.kind}</span> {s.name}
        <span className="trace__lat">{s.latencyMs}ms</span>
        {s.status === 'error' && <span className="trace__err">!</span>}
      </div>,
      ...renderSpans(s.spanId, depth + 1),
    ]);
  return <div className="trace__tree">{renderSpans(null, 0)}</div>;
}

function TraceRow({ trace }: { trace: Trace }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="trace__item">
      <button className="trace__row" onClick={() => setOpen((v) => !v)}>
        <span>{open ? '▾' : '▸'} {trace.rootName}</span>
        <span className={`status-pill status-pill--${trace.status}`}>{trace.status}</span>
        <span>{trace.latencyMs}ms</span>
        {trace.tokens?.total != null && <span>{trace.tokens.total} tok</span>}
        {trace.costUsd != null && <span>${trace.costUsd.toFixed(4)}</span>}
      </button>
      {open && <SpanTree spans={trace.spans} />}
    </div>
  );
}

export function AgentTracesView({ agentId }: { agentId: string }) {
  const gateway = useGateway();
  const res = useResource(() => gateway.getAgentTraces(agentId), [agentId]);
  return (
    <div className="trace">
      <PanelState resource={res} />
      {res.data && res.data.reasonCode && (
        <p className="panel__state">{REASON_TEXT[res.data.reasonCode] ?? 'No traces.'}</p>
      )}
      {res.data && !res.data.reasonCode && res.data.traces.map((t) => <TraceRow key={t.traceId} trace={t} />)}
    </div>
  );
}
