#!/usr/bin/env node
/**
 * Generates the Trading Lab Research Floor as valid Tiled JSON maps (.tmj) —
 * one per theme (Day Office / Night Control Room). Both share the same
 * geometry; only the tileset image and background color differ. The files
 * open in the Tiled editor; this script only exists so the example layout is
 * reproducible and reviewable in code.
 *
 * Visual Iteration 2 layout (20×17 tiles, 640×544 world — compact on
 * purpose so the default "fit" camera lands well above 1× zoom):
 *
 * - top wall: vent, window, hypothesis board, poster, bookshelf, door,
 *   bookshelf, wall monitor, clock, window, notice board;
 * - left wing: Analyst / Researcher / Critic, each at a 2×2 desk facing the
 *   wall (agent below the desk, looking at the screen); a full empty row
 *   between workstations keeps desk nameplates clear of the next desk;
 * - right wing: Builder / Evaluator / Performance Monitor, mirrored;
 * - center: the Boss command desk on its rug, facing the door;
 * - bottom wall, center-left: break area (vending, coffee, cooler, trash);
 * - bottom wall, center-right: infra corner (bot status, archive, rack);
 * - plants fill the seams. No decorative floor text.
 *
 * Usage: node tools/generate-map.mjs   (run generate-assets.mjs first)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, TILE_DEFS, TILE_SIZE, TILESET_COLUMNS, tileGid } from './lib/tiles.mjs';

const W = 20;
const H = 17;

const THEME_COLORS = {
  day: { background: '#6f7886' },
  night: { background: '#0b0e1a' },
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

/** Paint a bordered 9-slice rug (`prefix` = 'brug'). */
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

/** Place a 2×2 block whose tiles are named `<base>_tl/tr/bl/br`. */
function block2x2(layer, x, y, base) {
  set(layer, x, y, `${base}_tl`);
  set(layer, x + 1, y, `${base}_tr`);
  set(layer, x, y + 1, `${base}_bl`);
  set(layer, x + 1, y + 1, `${base}_br`);
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
for (let y = 3; y <= 15; y++) {
  for (let x = 1; x <= 18; x++) {
    set(floor, x, y, (x + y) % 2 === 0 ? 'floor_a' : 'floor_b');
  }
}
// shadow under the top wall + doormat in front of the door
for (let x = 1; x <= 18; x++) set(floor, x, 3, 'floor_shadow');
set(floor, 9, 3, 'doormat_l');
set(floor, 10, 3, 'doormat_r');

// command rug under the Boss desk (the only rug — zoning, no text)
rugZone(floor, 7, 7, 6, 5, 'brug');

// walls: full perimeter cap, two face rows along the top wall
for (let x = 0; x < W; x++) {
  set(walls, x, 0, 'wall_top');
  set(walls, x, H - 1, 'wall_top');
}
for (let y = 0; y < H; y++) {
  set(walls, 0, y, 'wall_top');
  set(walls, W - 1, y, 'wall_top');
}
for (let x = 1; x <= 18; x++) {
  set(walls, x, 1, 'wall_face_u');
  set(walls, x, 2, 'wall_face_l');
}
// 2×2 windows + 2×2 double door
block2x2(walls, 2, 1, 'window');
block2x2(walls, 16, 1, 'window');
block2x2(walls, 9, 1, 'door');
// wall dressing (cols 4-6 and 12-14 stay plain: wall props hang there)
set(walls, 1, 1, 'wall_vent');
set(walls, 7, 1, 'poster');
set(walls, 15, 1, 'wall_clock');
set(walls, 18, 1, 'notice_board');

// bookshelves flanking the door (1×2 tiles)
for (const bx of [8, 11]) {
  set(furniture, bx, 2, 'bookshelf_top');
  set(furniture, bx, 3, 'bookshelf_bottom');
}

// workstations: 2×2 desk block (monitor up top, keyboard at the agent edge),
// agent seated below facing the screen, one clear row before the next desk
const DESKS = [
  // [x, topY, variant]
  [2, 3, 'desk_a'],
  [2, 7, 'desk_b'],
  [2, 11, 'desk_a'],
  [16, 3, 'desk_b'],
  [16, 7, 'desk_a'],
  [16, 11, 'desk_b'],
];
for (const [x, y, base] of DESKS) {
  block2x2(furniture, x, y, base);
}

// break area against the bottom wall, center-left
set(furniture, 5, 14, 'vending_top');
set(furniture, 5, 15, 'vending_bottom');
set(furniture, 6, 15, 'cabinet_coffee');
set(furniture, 7, 15, 'water_cooler');
set(furniture, 8, 15, 'trash_bin');

// plants in the seams + a bin by the infra corner
set(furniture, 1, 3, 'plant_big');
set(furniture, 18, 3, 'plant_big');
set(furniture, 6, 3, 'plant_small');
set(furniture, 13, 3, 'plant_small');
set(furniture, 1, 15, 'plant_big');
set(furniture, 18, 15, 'plant_big');
set(furniture, 9, 15, 'plant_small');

// decor layer kept (empty) for the canonical layer contract; desk items are
// baked into the desk tiles.
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

  // Agents sit at the bottom-center of their desk block; the Boss tucks
  // into the command desk. Feet anchor = spawn point.
  const spawns = [
    spawnPoint('boss', 320, 344, {
      role: 'boss',
      displayName: 'Boss / Orchestrator',
      label: 'Boss',
    }),
    spawnPoint('analyst', 96, 190, {
      role: 'strategy_analyst',
      displayName: 'Strategy Analyst',
      label: 'Analyst',
    }),
    spawnPoint('researcher', 96, 318, {
      role: 'researcher',
      displayName: 'Researcher',
      label: 'Researcher',
    }),
    spawnPoint('critic', 96, 446, {
      role: 'critic',
      displayName: 'Critic / Risk Reviewer',
      label: 'Critic',
    }),
    spawnPoint('builder', 544, 190, {
      role: 'builder',
      displayName: 'Builder',
      label: 'Builder',
    }),
    spawnPoint('evaluator', 544, 318, {
      role: 'evaluator',
      displayName: 'Evaluator',
      label: 'Evaluator',
    }),
    spawnPoint('perf-monitor', 544, 446, {
      role: 'performance_monitor',
      displayName: 'Performance Monitor',
      label: 'Monitor',
    }),
  ];

  const objects = [
    interactiveRect('hypothesis-board', 128, 34, 96, 48, {
      objectType: 'hypothesis_board',
      label: 'Hypothesis Board',
      panelTarget: 'hypothesis-pipeline',
    }),
    interactiveRect('wall-monitor', 384, 34, 96, 48, {
      objectType: 'wall_monitor',
      label: 'Backtests',
      panelTarget: 'backtest-summary',
    }),
    interactiveRect('bot-status', 328, 446, 48, 64, {
      objectType: 'bot_status_monitor',
      label: 'Bot Status',
      panelTarget: 'bot-health',
    }),
    interactiveRect('archive', 384, 446, 64, 64, {
      objectType: 'archive_shelf',
      label: 'Archive',
      panelTarget: 'knowledge-base',
    }),
    interactiveRect('server-rack', 456, 422, 56, 88, {
      objectType: 'server_rack',
      label: 'Data Node',
      panelTarget: 'infra-status',
    }),
    interactiveRect('boss-console', 256, 260, 128, 40, {
      objectType: 'boss_console',
      label: 'Console',
      panelTarget: 'boss-commands',
    }),
  ];

  return { spawns, objects, nextId: () => nextObjectId };
}

// ---------------------------------------------------------------------------
// assemble one .tmj per theme
// ---------------------------------------------------------------------------

function buildMap(theme) {
  const colors = THEME_COLORS[theme];
  const { spawns, objects, nextId } = buildObjects();

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
    nextobjectid: nextId(),
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
      // No decorative floor text in Iteration 2 — zones read through layout
      // and furniture. The layer stays for the canonical layer contract.
      objectLayer('labels', []),
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
