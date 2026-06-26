import type { AgentStatusMap } from '@trading-office/office-gateway';
import type { OfficeSceneConfig } from '@trading-office/office-visual-kit';
import {
  createTradingLabResearchFloorScene,
  type FloorThemeName,
} from '@trading-office/trading-lab-floor';

export const FLOOR_BASE_PATH = '/floor/trading-lab';

export function buildFloorConfig(theme: FloorThemeName): OfficeSceneConfig {
  return createTradingLabResearchFloorScene(theme);
}

/**
 * Seat an agent at its desk only when it has a live correspondence in the
 * status map (i.e. a real trading-lab source). The desks themselves live in the
 * tilemap and stay rendered — this just drops the agent *sprites* for roster
 * entries that have no backing source (e.g. evaluator / perf-monitor when lab
 * does not report them), leaving honest empty desks. Data-driven: presence is
 * decided by what the gateway actually reports, never a hard-coded allowlist.
 */
export function filterPresentAgents(
  config: OfficeSceneConfig,
  statuses: AgentStatusMap,
): OfficeSceneConfig {
  return { ...config, agents: config.agents.filter((a) => a.id in statuses) };
}

/**
 * A stable key over the *set* of agents present in the status map (membership,
 * not status value). Lets the floor recompute the filtered scene only when an
 * agent appears/disappears — not on every status tick — so the Pixi scene is
 * not rebuilt on routine status changes.
 */
export function agentPresenceKey(statuses: AgentStatusMap): string {
  return Object.keys(statuses).sort().join('|');
}

/** Map panelTarget → object entity id, derived from the floor config objects. */
export function panelTargetToObjectId(config: OfficeSceneConfig): Record<string, string> {
  const map: Record<string, string> = {};
  for (const obj of config.objects) {
    if (obj.panelTarget) map[obj.panelTarget] = obj.id;
  }
  return map;
}
