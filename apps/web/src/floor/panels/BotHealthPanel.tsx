import { useGateway } from '../../runtime/RuntimeContext';
import { isDegraded, isError, isGap, isLive, sourceState } from '../infraSources';
import { PanelChrome, PanelState } from './PanelChrome';
import { useResource } from './useResource';

export function BotHealthPanel({ onClose }: { onClose: () => void }) {
  const gateway = useGateway();
  const res = useResource(() => gateway.getBotHealth(), []);
  const infra = useResource(() => gateway.getInfraStatus(), []);
  const state = sourceState(infra.data, 'bot-health');
  const rows = res.data ?? [];

  if (isGap(state)) {
    return <PanelChrome title="Bot status" onClose={onClose}><p className="panel__empty">Bot runtime monitoring is not connected yet</p></PanelChrome>;
  }
  if (isError(state)) {
    return <PanelChrome title="Bot status" onClose={onClose}><p className="panel__empty">Bot runtime monitoring unavailable — platform unreachable</p></PanelChrome>;
  }
  if (rows.length === 0 && isLive(state)) {
    return <PanelChrome title="Bot status" onClose={onClose}><p className="panel__empty">No active bot runs</p></PanelChrome>;
  }
  if (rows.length === 0 && isDegraded(state)) {
    return <PanelChrome title="Bot status" onClose={onClose}><p className="panel__empty">Bot runtime data is stale</p></PanelChrome>;
  }
  return (
    <PanelChrome title="Bot status" onClose={onClose}>
      <PanelState resource={res} />
      {isDegraded(state) && <p className="panel__empty">data may be stale</p>}
      {rows.map((bot) => (
        <div key={bot.id} className="row">
          <span>{bot.name}</span>
          <span className="tag">{bot.state} · up {bot.uptime} · {bot.lastHeartbeat}</span>
        </div>
      ))}
    </PanelChrome>
  );
}
