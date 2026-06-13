import type { RouteSelection } from './floorSelection';

export interface FloorAgentInfo {
  id: string;
  role: string;
}

export type PanelKind =
  | { kind: 'boss-command' }
  | { kind: 'agent-activity'; agentId: string }
  | { kind: 'object'; panelTarget: string }
  | { kind: 'exit' }
  | { kind: 'none' }
  | { kind: 'unknown'; key: string };

const KNOWN_OBJECT_PANELS = new Set([
  'hypothesis-pipeline',
  'backtest-summary',
  'bot-health',
  'knowledge-base',
  'infra-status',
]);

export function resolvePanel(
  sel: RouteSelection,
  agents: FloorAgentInfo[],
): PanelKind {
  if (sel.agentId) {
    const agent = agents.find((a) => a.id === sel.agentId);
    if (!agent) return { kind: 'unknown', key: `agent:${sel.agentId}` };
    if (agent.role === 'boss') return { kind: 'boss-command' };
    return { kind: 'agent-activity', agentId: agent.id };
  }
  if (sel.panelTarget) {
    if (sel.panelTarget === 'exit') return { kind: 'exit' };
    if (KNOWN_OBJECT_PANELS.has(sel.panelTarget)) {
      return { kind: 'object', panelTarget: sel.panelTarget };
    }
    return { kind: 'unknown', key: `panel:${sel.panelTarget}` };
  }
  return { kind: 'none' };
}

/** The entity the scene should select/focus for a given panel (null = clear). */
export function selectedEntityId(
  kind: PanelKind,
  panelTargetToObjectId: Record<string, string>,
): string | null {
  switch (kind.kind) {
    case 'boss-command':
      return 'boss';
    case 'agent-activity':
      return kind.agentId;
    case 'object':
      return panelTargetToObjectId[kind.panelTarget] ?? null;
    default:
      return null;
  }
}

/** Panel kinds that occupy the right dock (exit/none never open the dock). */
export function opensDock(kind: PanelKind): boolean {
  return (
    kind.kind === 'boss-command' ||
    kind.kind === 'agent-activity' ||
    kind.kind === 'object' ||
    kind.kind === 'unknown'
  );
}
