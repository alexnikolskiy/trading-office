#!/usr/bin/env node
/**
 * Generates the Trading Lab Research Floor as valid Tiled JSON maps (.tmj) —
 * one per theme (Day Office / Night Control Room). Both share the same
 * geometry; only the tileset image and label/background colors differ. The
 * files open in the Tiled editor; this script only exists so the example
 * layout is reproducible and reviewable in code.
 *
 * Usage: node tools/generate-map.mjs   (run generate-assets.mjs first)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, TILE_DEFS, TILE_SIZE, TILESET_COLUMNS, tileGid } from './lib/tiles.mjs';

const W = 30;
const H = 21;

const THEME_COLORS = {
  day: { background: '#6f7886', floorLabel: '#7a6850' },
  night: { background: '#0b0e1a', floorLabel: '#54648c' },
};

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

/** Paint a bordered 9-slice rug (`prefix` = 'rug' or 'brug'). */
function rugZone(layer, x, y, w, h, prefix) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const v = yy === y ? 't' : yy === y + h - 1 ? 'b' : '';
      const u = xx === x ? 'l' : xx === x + w - 1 ? 'r' : '';
      const key = `${v}${u}` || 'c';
      set(layer, xx, yy, `${prefix}_${key}`);
    }
  }
}

function flatten(layer) {
  return layer.flat();
}

// ---------------------------------------------------------------------------
// tile layers (shared geometry)
// ---------------------------------------------------------------------------

const floor = grid();
const walls = grid();
const furniture = grid();
const decor = grid();

// floor: warm plank checkerboard inside the walls
for (let y = 3; y <= 19; y++) {
  for (let x = 1; x <= 28; x++) {
    set(floor, x, y, (x + y) % 2 === 0 ? 'floor_a' : 'floor_b');
  }
}
// shadow under the top wall + doormat in front of the door
for (let x = 1; x <= 28; x++) set(floor, x, 3, 'floor_shadow');
set(floor, 14, 3, 'doormat');
set(floor, 15, 3, 'doormat');

// a small office rug under every workstation + boss rug under the command desk
for (const y of [4, 9, 14]) {
  rugZone(floor, 3, y, 4, 4, 'rug');
  rugZone(floor, 23, y, 4, 4, 'rug');
}
rugZone(floor, 11, 12, 8, 6, 'brug');

// walls: full perimeter cap, two face rows along the top wall
for (let x = 0; x < W; x++) {
  set(walls, x, 0, 'wall_top');
  set(walls, x, 20, 'wall_top');
}
for (let y = 0; y <= 20; y++) {
  set(walls, 0, y, 'wall_top');
  set(walls, 29, y, 'wall_top');
}
for (let x = 1; x <= 28; x++) {
  set(walls, x, 1, 'wall_face_u');
  set(walls, x, 2, 'wall_face_l');
}
// 2×2 windows
for (const wx of [3, 7, 21, 25]) {
  set(walls, wx, 1, 'window_tl');
  set(walls, wx + 1, 1, 'window_tr');
  set(walls, wx, 2, 'window_bl');
  set(walls, wx + 1, 2, 'window_br');
}
// 2×2 double door
set(walls, 14, 1, 'door_tl');
set(walls, 15, 1, 'door_tr');
set(walls, 14, 2, 'door_bl');
set(walls, 15, 2, 'door_br');
// wall dressing
set(walls, 2, 1, 'wall_vent');
set(walls, 27, 1, 'wall_vent');
set(walls, 12, 1, 'wall_clock');
set(walls, 13, 1, 'poster');
set(walls, 16, 1, 'notice_board');

// bookshelves leaning against the top wall (1×2 tiles)
for (const bx of [5, 6, 23, 24]) {
  set(furniture, bx, 2, 'bookshelf_top');
  set(furniture, bx, 3, 'bookshelf_bottom');
}

// workstations: desk (monitor + items) on the rug, agent seated below
const DESKS = [
  // [monX, y, monitorTile, itemsTile]
  [4, 5, 'desk_mon_chart', 'desk_items_lamp'],
  [4, 10, 'desk_mon_code', 'desk_items_docs'],
  [4, 15, 'desk_mon_chart', 'desk_items_docs'],
  [24, 5, 'desk_mon_code', 'desk_items_lamp'],
  [24, 10, 'desk_mon_chart', 'desk_items_docs'],
  [24, 15, 'desk_mon_code', 'desk_items_lamp'],
];
for (const [x, y, mon, items] of DESKS) {
  set(furniture, x, y, mon);
  set(furniture, x + 1, y, items);
}

// shared center: spare chairs by the holo table
set(furniture, 12, 8, 'chair_office');
set(furniture, 17, 8, 'chair_office');

// amenities: coffee corner bottom-left, plants, bins
set(furniture, 2, 17, 'vending_top');
set(furniture, 2, 18, 'vending_bottom');
set(furniture, 3, 18, 'cabinet_coffee');
set(furniture, 4, 18, 'water_cooler');
set(furniture, 5, 18, 'trash_bin');
set(furniture, 8, 17, 'trash_bin');
set(furniture, 21, 17, 'trash_bin');
set(furniture, 1, 4, 'plant_big');
set(furniture, 28, 4, 'plant_big');
set(furniture, 1, 19, 'plant_big');
set(furniture, 10, 17, 'plant_big');
set(furniture, 19, 17, 'plant_big');
set(furniture, 12, 4, 'plant_small');
set(furniture, 17, 4, 'plant_small');

// decor layer kept (empty) for the canonical layer contract; desk items are
// baked into the desk tiles at 32px.
void decor;

// ---------------------------------------------------------------------------
// object layers (shared geometry)
// ---------------------------------------------------------------------------

function buildObjects() {
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

  function floorLabel(name, text, x, y, width, color) {
    return {
      id: nextObjectId++,
      name,
      type: 'label',
      x,
      y,
      width,
      height: 16,
      rotation: 0,
      visible: true,
      text: {
        text,
        color,
        fontfamily: 'monospace',
        pixelsize: 11,
        halign: 'center',
        valign: 'center',
      },
    };
  }

  const spawns = [
    spawnPoint('boss', 480, 462, {
      role: 'boss',
      displayName: 'Boss / Orchestrator',
      label: 'Boss',
    }),
    spawnPoint('analyst', 160, 218, {
      role: 'strategy_analyst',
      displayName: 'Strategy Analyst',
      label: 'Analyst',
    }),
    spawnPoint('researcher', 160, 378, {
      role: 'researcher',
      displayName: 'Researcher',
      label: 'Researcher',
    }),
    spawnPoint('critic', 160, 538, {
      role: 'critic',
      displayName: 'Critic / Risk Reviewer',
      label: 'Critic',
    }),
    spawnPoint('builder', 800, 218, {
      role: 'builder',
      displayName: 'Builder',
      label: 'Builder',
    }),
    spawnPoint('evaluator', 800, 378, {
      role: 'evaluator',
      displayName: 'Evaluator',
      label: 'Evaluator',
    }),
    spawnPoint('perf-monitor', 800, 538, {
      role: 'performance_monitor',
      displayName: 'Performance Monitor',
      label: 'Monitor',
    }),
  ];

  const objects = [
    interactiveRect('hypothesis-board', 288, 24, 96, 48, {
      objectType: 'hypothesis_board',
      label: 'Hypothesis Board',
      panelTarget: 'hypothesis-pipeline',
    }),
    interactiveRect('wall-monitor', 544, 24, 96, 48, {
      objectType: 'wall_monitor',
      label: 'Backtests',
      panelTarget: 'backtest-summary',
    }),
    interactiveRect('bot-status', 696, 552, 48, 64, {
      objectType: 'bot_status_monitor',
      label: 'Bot Status',
      panelTarget: 'bot-health',
    }),
    interactiveRect('archive', 776, 552, 64, 64, {
      objectType: 'archive_shelf',
      label: 'Archive',
      panelTarget: 'knowledge-base',
    }),
    interactiveRect('server-rack', 856, 540, 64, 88, {
      objectType: 'server_rack',
      label: 'Data Node',
      panelTarget: 'infra-status',
    }),
    interactiveRect('boss-console', 408, 448, 144, 72, {
      objectType: 'boss_console',
      label: 'Console',
      panelTarget: 'boss-commands',
    }),
    interactiveRect('holo-table', 432, 248, 96, 64, {
      objectType: 'data_table',
      label: 'Data Table',
      panelTarget: 'shared-context',
    }),
  ];

  return { spawns, objects, floorLabel, nextId: () => nextObjectId };
}

// ---------------------------------------------------------------------------
// assemble one .tmj per theme
// ---------------------------------------------------------------------------

function buildMap(theme) {
  const colors = THEME_COLORS[theme];
  const { spawns, objects, floorLabel, nextId } = buildObjects();

  const labels = [
    floorLabel('zone-research', 'RESEARCH BAY', 64, 138, 224, colors.floorLabel),
    floorLabel('zone-ops', 'OPS WING', 672, 138, 224, colors.floorLabel),
    floorLabel('zone-command', 'COMMAND DECK', 408, 532, 144, colors.floorLabel),
  ];

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
    backgroundcolor: colors.background,
    nextlayerid: 0, // patched below
    nextobjectid: nextId() + labels.length,
    tilesets: [
      {
        firstgid: 1,
        name: `office-tileset-${theme}`,
        image: `../assets/generated/tiles/office-tileset-${theme}.png`,
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
  return map;
}

for (const theme of THEMES) {
  const map = buildMap(theme);
  const outFile = join(
    exampleRoot,
    'public',
    'maps',
    `trading-lab-research-floor-${theme}.tmj`,
  );
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(map, null, 2) + '\n');
  console.log(`Wrote ${outFile}`);
}
console.log(
  `  ${W}×${H} tiles @ ${TILE_SIZE}px — ${W * TILE_SIZE}×${H * TILE_SIZE}px world`,
);
