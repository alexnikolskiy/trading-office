import { describe, it, expect } from 'vitest';
import type { AgentStatusMap } from '@trading-office/office-gateway';
import type { OfficeSceneConfig } from '@trading-office/office-visual-kit';
import { agentPresenceKey, filterPresentAgents } from './floorConfig';

const cfg = (agentIds: string[]): OfficeSceneConfig =>
  ({
    id: 's',
    title: 't',
    map: { url: 'm.tmj' },
    assets: [],
    objects: [{ id: 'desk-extra' }],
    agents: agentIds.map((id) => ({ id, role: id })),
  }) as unknown as OfficeSceneConfig;

describe('filterPresentAgents', () => {
  it('keeps only agents that have a live correspondence (key present in the status map)', () => {
    const config = cfg(['boss', 'analyst', 'evaluator', 'perf-monitor']);
    const statuses: AgentStatusMap = { boss: 'thinking', analyst: 'idle' };
    expect(filterPresentAgents(config, statuses).agents.map((a) => a.id)).toEqual(['boss', 'analyst']);
  });

  it('drops every agent when the status map is empty (honest empty desks, never a throw)', () => {
    expect(filterPresentAgents(cfg(['boss', 'analyst']), {}).agents).toEqual([]);
  });

  it('leaves the rest of the scene (objects/map/assets) untouched', () => {
    const config = cfg(['boss']);
    const out = filterPresentAgents(config, { boss: 'thinking' });
    expect(out.objects).toBe(config.objects);
    expect(out.map).toBe(config.map);
  });
});

describe('agentPresenceKey', () => {
  it('is stable across status-value changes but changes when the agent set changes', () => {
    expect(agentPresenceKey({ boss: 'thinking', analyst: 'idle' })).toBe(
      agentPresenceKey({ analyst: 'running', boss: 'success' }),
    );
    expect(agentPresenceKey({ boss: 'thinking' })).not.toBe(
      agentPresenceKey({ boss: 'thinking', analyst: 'idle' }),
    );
  });
});
