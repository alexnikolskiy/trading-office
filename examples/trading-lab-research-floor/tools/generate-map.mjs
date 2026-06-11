#!/usr/bin/env node
/**
 * Generates the Trading Lab Research Floor as a valid Tiled JSON map (.tmj).
 * The file opens in the Tiled editor; this script only exists so the example
 * layout is reproducible and reviewable in code.
 *
 * Usage: node tools/generate-map.mjs   (run generate-assets.mjs first)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILE_DEFS, TILE_SIZE, TILESET_COLUMNS, tileGid } from './lib/tiles.mjs';

const W = 40;
const H = 24;

const exampleRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function grid() {
  return Array.from({ length: H }, () => new Array(W).fill(0));
}

function set(layer, x, y, tile) {
  layer[y][x] = tileGid(tile);
}

function fill(layer, x, y, w, h, tile) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) set(layer, xx, yy, tile);
  }
}

function flatten(layer) {
  return layer.flat();
}

let nextObjectId = 1;

function spawnPoint(name, x, y, props) {
  return {
    id: nextObjectId++,
    name,
    type: 'agent_spawn',
    point: true,
    x,
    y,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    properties: Object.entries(props).map(([key, value]) => ({
      name: key,
      type: typeof value === 'boolean' ? 'bool' : 'string',
      value,
    })),
  };
}

function interactiveRect(name, x, y, width, height, props) {
  return {
    id: nextObjectId++,
    name,
    type: 'interactive_object',
    x,
    y,
    width,
    height,
    rotation: 0,
    visible: true,
    properties: Object.entries(props).map(([key, value]) => ({
      name: key,
      type: typeof value === 'boolean' ? 'bool' : 'string',
      value,
    })),
  };
}

function floorLabel(name, text, x, y, width) {
  return {
    id: nextObjectId++,
    name,
    type: 'label',
    x,
    y,
    width,
    height: 14,
    rotation: 0,
    visible: true,
    text: {
      text,
      color: '#54648c',
      fontfamily: 'monospace',
      pixelsize: 8,
      halign: 'center',
      valign: 'center',
    },
  };
}

// ---------------------------------------------------------------------------
// tile layers
// ---------------------------------------------------------------------------

const floor = grid();
const walls = grid();
const furniture = grid();
const decor = grid();

// floor: graphite checkerboard inside the walls
for (let y = 2; y <= 22; y++) {
  for (let x = 1; x <= 38; x++) {
    set(floor, x, y, (x + y) % 2 === 0 ? 'floor_a' : 'floor_b');
  }
}
// shadow under the top wall
for (let x = 1; x <= 38; x++) set(floor, x, 2, 'floor_shadow');

// carpets per work zone
const carpets = [
  [4, 6, 4, 3], // analyst
  [13, 6, 4, 3], // researcher
  [23, 6, 4, 3], // evaluator
  [4, 11, 4, 3], // critic
  [29, 11, 4, 3], // performance monitor
  [4, 16, 4, 3], // builder
  [15, 9, 8, 5], // central data table
];
for (const [x, y, w, h] of carpets) fill(floor, x, y, w, h, 'carpet');
// violet command rug for the Boss
fill(floor, 15, 18, 10, 4, 'rug_violet');

// walls: top cap row + face row, side/bottom caps
for (let x = 0; x < W; x++) set(walls, x, 0, 'wall_top');
for (let y = 0; y <= 22; y++) {
  set(walls, 0, y, 'wall_top');
  set(walls, 39, y, 'wall_top');
}
for (let x = 0; x < W; x++) set(walls, x, 23, 'wall_top');
// door / elevator hint at the bottom wall
set(walls, 19, 23, 'door');
set(walls, 20, 23, 'door');

const windows = new Set([9, 10, 16, 17, 28, 29, 34, 35]);
const accents = new Set([3, 21, 37]);
const panels = new Set([12, 26]);
const vents = new Set([19, 32]);
for (let x = 1; x <= 38; x++) {
  let tile = 'wall_face';
  if (windows.has(x)) tile = 'window_night';
  else if (accents.has(x)) tile = 'wall_face_accent';
  else if (panels.has(x)) tile = 'wall_face_panel';
  else if (vents.has(x)) tile = 'wall_face_vent';
  set(walls, x, 1, tile);
}

// desks (left + right half)
const desks = [
  [5, 7], // analyst
  [14, 7], // researcher
  [24, 7], // evaluator
  [5, 12], // critic
  [30, 12], // performance monitor
  [5, 17], // builder
];
for (const [x, y] of desks) {
  set(furniture, x, y, 'desk_l');
  set(furniture, x + 1, y, 'desk_r');
}

// extra furniture
set(furniture, 16, 10, 'chair');
set(furniture, 21, 10, 'chair');
set(furniture, 2, 3, 'plant');
set(furniture, 37, 3, 'plant');
set(furniture, 2, 21, 'plant');
set(furniture, 37, 21, 'plant');
set(furniture, 37, 6, 'coffee_machine');
set(furniture, 2, 9, 'bookshelf');
set(furniture, 2, 15, 'bookshelf');

// desk items (decor renders above furniture)
set(decor, 5, 7, 'item_chart_cyan');
set(decor, 6, 7, 'item_mug');
set(decor, 14, 7, 'item_papers');
set(decor, 15, 7, 'item_mug');
set(decor, 24, 7, 'item_chart_blue');
set(decor, 25, 7, 'item_mug');
set(decor, 5, 12, 'item_checklist');
set(decor, 6, 12, 'item_papers');
set(decor, 30, 12, 'item_status_green');
set(decor, 31, 12, 'item_mug');
set(decor, 5, 17, 'item_code_green');
set(decor, 6, 17, 'item_terminal');

// ---------------------------------------------------------------------------
// object layers
// ---------------------------------------------------------------------------

const spawns = [
  spawnPoint('boss', 304, 306, {
    role: 'boss',
    displayName: 'Boss / Orchestrator',
    label: 'Boss',
  }),
  spawnPoint('analyst', 96, 118, {
    role: 'strategy_analyst',
    displayName: 'Strategy Analyst',
    label: 'Analyst',
  }),
  spawnPoint('researcher', 240, 118, {
    role: 'researcher',
    displayName: 'Researcher',
    label: 'Researcher',
  }),
  spawnPoint('evaluator', 400, 118, {
    role: 'evaluator',
    displayName: 'Evaluator',
    label: 'Evaluator',
  }),
  spawnPoint('critic', 96, 198, {
    role: 'critic',
    displayName: 'Critic / Risk Reviewer',
    label: 'Critic',
  }),
  spawnPoint('perf-monitor', 496, 198, {
    role: 'performance_monitor',
    displayName: 'Performance Monitor',
    label: 'Monitor',
  }),
  spawnPoint('builder', 96, 278, {
    role: 'builder',
    displayName: 'Builder',
    label: 'Builder',
  }),
];

const objects = [
  interactiveRect('hypothesis-board', 80, 7, 48, 24, {
    objectType: 'hypothesis_board',
    label: 'Hypothesis Board',
    panelTarget: 'hypothesis-pipeline',
  }),
  interactiveRect('wall-monitor', 368, 7, 48, 24, {
    objectType: 'wall_monitor',
    label: 'Backtests',
    panelTarget: 'backtest-summary',
  }),
  interactiveRect('bot-status', 534, 170, 24, 32, {
    objectType: 'bot_status_monitor',
    label: 'Bot Status',
    panelTarget: 'bot-health',
  }),
  interactiveRect('archive', 552, 258, 32, 32, {
    objectType: 'archive_shelf',
    label: 'Archive',
    panelTarget: 'knowledge-base',
  }),
  interactiveRect('server-rack', 144, 240, 32, 44, {
    objectType: 'server_rack',
    label: 'Data Node',
    panelTarget: 'infra-status',
  }),
  interactiveRect('boss-console', 268, 300, 72, 38, {
    objectType: 'boss_console',
    label: 'Console',
    panelTarget: 'boss-commands',
  }),
  interactiveRect('holo-table', 280, 150, 48, 32, {
    objectType: 'data_table',
    label: 'Data Table',
    panelTarget: 'shared-context',
  }),
];

const labels = [
  floorLabel('zone-research', 'RESEARCH BAY', 128, 70, 160),
  floorLabel('zone-ops', 'OPS WING', 448, 150, 120),
  floorLabel('zone-command', 'COMMAND DECK', 244, 346, 120),
];

// ---------------------------------------------------------------------------
// assemble the .tmj
// ---------------------------------------------------------------------------

let nextLayerId = 1;

function tileLayer(name, layer) {
  return {
    id: nextLayerId++,
    name,
    type: 'tilelayer',
    width: W,
    height: H,
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    data: flatten(layer),
  };
}

function objectLayer(name, objs) {
  return {
    id: nextLayerId++,
    name,
    type: 'objectgroup',
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    draworder: 'topdown',
    objects: objs,
  };
}

const rows = Math.ceil(TILE_DEFS.length / TILESET_COLUMNS);
const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.0',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE_SIZE,
  tileheight: TILE_SIZE,
  backgroundcolor: '#0b0e1a',
  nextlayerid: 0, // patched below
  nextobjectid: nextObjectId,
  tilesets: [
    {
      firstgid: 1,
      name: 'office-tileset',
      image: '../assets/generated/tiles/office-tileset.png',
      imagewidth: TILESET_COLUMNS * TILE_SIZE,
      imageheight: rows * TILE_SIZE,
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      tilecount: TILE_DEFS.length,
      columns: TILESET_COLUMNS,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [
    tileLayer('floor', floor),
    tileLayer('walls', walls),
    tileLayer('furniture', furniture),
    tileLayer('decor', decor),
    objectLayer('agent_spawn_points', spawns),
    objectLayer('interactive_objects', objects),
    objectLayer('labels', labels),
  ],
};
map.nextlayerid = nextLayerId;

const outFile = join(exampleRoot, 'public', 'maps', 'trading-lab-research-floor.tmj');
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(map, null, 2) + '\n');
console.log(`Wrote ${outFile}`);
console.log(`  ${W}×${H} tiles @ ${TILE_SIZE}px — ${W * TILE_SIZE}×${H * TILE_SIZE}px world`);
console.log(`  ${spawns.length} agent spawn points, ${objects.length} interactive objects`);
