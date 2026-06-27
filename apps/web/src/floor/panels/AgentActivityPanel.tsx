import { useState, useEffect } from 'react';
import { useGateway, useAgentStatuses } from '../../runtime/RuntimeContext';
import { PanelChrome, PanelState } from './PanelChrome';
import { useResource } from './useResource';
import { AgentTracesView } from './AgentTracesView';
import type { TraceLine } from '../../runtime/types';

export function AgentActivityPanel({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const gateway = useGateway();
  const statuses = useAgentStatuses();
  const res = useResource(() => gateway.getAgentActivity(agentId), [agentId]);
  const status = statuses[agentId] ?? res.data?.status ?? 'idle';

  const [liveTraces, setLiveTraces] = useState<TraceLine[]>([]);
  const [tab, setTab] = useState<'logs' | 'traces'>('logs');

  useEffect(() => {
    if (!gateway.subscribeOfficeEvents) return;
    return gateway.subscribeOfficeEvents((e) => {
      if (e.type === 'agent_trace_appended' && e.agentId === agentId) {
        setLiveTraces((prev) => [...prev, e.line].slice(-50));
      }
    });
  }, [gateway, agentId]);

  return (
    <PanelChrome title={`Agent · ${agentId}`} onClose={onClose}>
      <div className="row">
        <span>Status</span>
        <span className="status-pill">{status}</span>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'logs'} onClick={() => setTab('logs')}>Logs</button>
        <button role="tab" aria-selected={tab === 'traces'} onClick={() => setTab('traces')}>Traces</button>
      </div>
      {tab === 'logs' ? (
        <>
          <PanelState resource={res} />
          {res.data && (
            <>
              <p className="row"><span>Task</span><span>{res.data.currentTask ?? '—'}</span></p>
              <div className="trace">
                {res.data.logs.map((l, i) => (
                  <div key={i}>{l.ts} [{l.level}] {l.text}</div>
                ))}
                {liveTraces.map((l, i) => (
                  <div key={`live-${i}`}>{l.ts} [{l.level}] {l.text}</div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <AgentTracesView agentId={agentId} />
      )}
    </PanelChrome>
  );
}
