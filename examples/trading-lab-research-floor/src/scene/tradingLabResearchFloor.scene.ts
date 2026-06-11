import type { OfficeSceneConfig } from '@trading-office/office-visual-kit';

/**
 * Semantic scene config for the Trading Lab Research Floor.
 * Geometry (positions, sizes) lives in the Tiled map; this file binds map
 * objects to roles, sprites, labels and future panel targets.
 */

const AGENT_SPRITES = [
  'boss',
  'strategy_analyst',
  'researcher',
  'critic',
  'builder',
  'evaluator',
  'performance_monitor',
] as const;

const PROP_SPRITES: Array<{ key: string; file: string; frameWidth: number }> = [
  { key: 'prop:wall_monitor', file: 'wall-monitor', frameWidth: 48 },
  { key: 'prop:hypothesis_board', file: 'hypothesis-board', frameWidth: 48 },
  { key: 'prop:bot_status_monitor', file: 'bot-status-monitor', frameWidth: 24 },
  { key: 'prop:archive_shelf', file: 'archive-shelf', frameWidth: 32 },
  { key: 'prop:server_rack', file: 'server-rack', frameWidth: 32 },
  { key: 'prop:boss_console', file: 'boss-console', frameWidth: 72 },
  { key: 'prop:holo_table', file: 'holo-table', frameWidth: 48 },
];

export function createTradingLabResearchFloorScene(): OfficeSceneConfig {
  return {
    id: 'trading-lab-research-floor',
    title: 'Trading Lab — Research Floor',
    map: { url: '/maps/trading-lab-research-floor.tmj' },

    theme: {
      backgroundColor: '#0b0e1a',
      ambientOverlayColor: '#2b2350',
      ambientOverlayAlpha: 0.08,
      hoverColor: '#7ef7ff',
      selectionColor: '#ffd166',
    },

    assets: [
      ...AGENT_SPRITES.map((role) => ({
        key: `agent:${role}`,
        url: `/assets/generated/agents/agent-${role}.png`,
        frameWidth: 16,
        frameCount: 2,
        animationSpeed: 0.02,
      })),
      ...PROP_SPRITES.map(({ key, file, frameWidth }) => ({
        key,
        url: `/assets/generated/props/${file}.png`,
        frameWidth,
        frameCount: 2,
        animationSpeed: 0.012,
      })),
    ],

    agents: [
      {
        id: 'boss',
        role: 'boss',
        displayName: 'Boss / Orchestrator',
        label: 'Boss',
        initialStatus: 'thinking',
      },
      {
        id: 'analyst',
        role: 'strategy_analyst',
        displayName: 'Strategy Analyst',
        label: 'Analyst',
        initialStatus: 'idle',
      },
      {
        id: 'researcher',
        role: 'researcher',
        displayName: 'Researcher',
        label: 'Researcher',
        initialStatus: 'thinking',
      },
      {
        id: 'critic',
        role: 'critic',
        displayName: 'Critic / Risk Reviewer',
        label: 'Critic',
        initialStatus: 'reviewing',
      },
      {
        id: 'builder',
        role: 'builder',
        displayName: 'Builder',
        label: 'Builder',
        initialStatus: 'running',
      },
      {
        id: 'evaluator',
        role: 'evaluator',
        displayName: 'Evaluator',
        label: 'Evaluator',
        initialStatus: 'backtesting',
      },
      {
        id: 'perf-monitor',
        role: 'performance_monitor',
        displayName: 'Performance Monitor',
        label: 'Monitor',
        initialStatus: 'idle',
      },
    ],

    objects: [
      {
        id: 'hypothesis-board',
        type: 'hypothesis_board',
        label: 'Hypothesis Board',
        panelTarget: 'hypothesis-pipeline',
        sprite: 'prop:hypothesis_board',
      },
      {
        id: 'wall-monitor',
        type: 'wall_monitor',
        label: 'Backtests',
        panelTarget: 'backtest-summary',
        sprite: 'prop:wall_monitor',
      },
      {
        id: 'bot-status',
        type: 'bot_status_monitor',
        label: 'Bot Status',
        panelTarget: 'bot-health',
        sprite: 'prop:bot_status_monitor',
      },
      {
        id: 'archive',
        type: 'archive_shelf',
        label: 'Archive',
        panelTarget: 'knowledge-base',
        sprite: 'prop:archive_shelf',
      },
      {
        id: 'server-rack',
        type: 'server_rack',
        label: 'Data Node',
        panelTarget: 'infra-status',
        sprite: 'prop:server_rack',
      },
      {
        id: 'boss-console',
        type: 'boss_console',
        label: 'Console',
        panelTarget: 'boss-commands',
        sprite: 'prop:boss_console',
      },
      {
        id: 'holo-table',
        type: 'data_table',
        label: 'Data Table',
        panelTarget: 'shared-context',
        sprite: 'prop:holo_table',
        showLabel: false,
      },
    ],

    camera: {
      defaultZoom: 'fit',
      fitPadding: 28,
      minZoom: 0.75,
      maxZoom: 6,
    },

    labels: {
      agents: true,
      objects: true,
      floor: true,
    },
  };
}
