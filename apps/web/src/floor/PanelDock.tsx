import { type ReactElement } from 'react';
import { type PanelKind } from './panelRegistry';
import { AgentActivityPanel } from './panels/AgentActivityPanel';
import { BossCommandPanel } from './panels/BossCommandPanel';
import { HypothesisPanel } from './panels/HypothesisPanel';
import { BacktestPanel } from './panels/BacktestPanel';
import { BotHealthPanel } from './panels/BotHealthPanel';
import { KnowledgePanel } from './panels/KnowledgePanel';
import { InfraStatusPanel } from './panels/InfraStatusPanel';
import { UnknownPanel } from './panels/UnknownPanel';

const OBJECT_PANELS: Record<string, (onClose: () => void) => ReactElement> = {
  'hypothesis-pipeline': (onClose) => <HypothesisPanel onClose={onClose} />,
  'backtest-summary': (onClose) => <BacktestPanel onClose={onClose} />,
  'bot-health': (onClose) => <BotHealthPanel onClose={onClose} />,
  'knowledge-base': (onClose) => <KnowledgePanel onClose={onClose} />,
  'infra-status': (onClose) => <InfraStatusPanel onClose={onClose} />,
};

function renderPanel(panelKind: PanelKind, onClose: () => void) {
  switch (panelKind.kind) {
    case 'boss-command':
      return <BossCommandPanel onClose={onClose} />;
    case 'agent-activity':
      return <AgentActivityPanel agentId={panelKind.agentId} onClose={onClose} />;
    case 'object':
      return (OBJECT_PANELS[panelKind.panelTarget] ?? ((c: () => void) => (
        <UnknownPanel panelKey={panelKind.panelTarget} onClose={c} />
      )))(onClose);
    case 'unknown':
      return <UnknownPanel panelKey={panelKind.key} onClose={onClose} />;
    default:
      return null;
  }
}

/** Stable key so dock content remounts per distinct panel (not on every render). */
function panelContentKey(panelKind: PanelKind): string {
  switch (panelKind.kind) {
    case 'boss-command': return 'boss';
    case 'agent-activity': return `agent:${panelKind.agentId}`;
    case 'object': return `obj:${panelKind.panelTarget}`;
    case 'unknown': return `unknown:${panelKind.key}`;
    default: return 'none';
  }
}

export function PanelDock({
  open,
  panelKind,
  onClose,
}: {
  open: boolean;
  panelKind: PanelKind;
  onClose: () => void;
}) {
  return (
    <aside className="dock" data-open={open} aria-hidden={!open}>
      {open && <div key={panelContentKey(panelKind)} className="dock__content">{renderPanel(panelKind, onClose)}</div>}
    </aside>
  );
}
