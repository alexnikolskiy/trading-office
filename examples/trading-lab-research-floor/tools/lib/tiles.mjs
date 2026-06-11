import { Img, makeRng, seedFromString } from './img.mjs';
import { PAL } from './palette.mjs';

/**
 * Environment + furniture tiles (16×16). The array order is the tileset
 * order: local tile id = index, gid = index + 1 (firstgid = 1).
 * `generate-map.mjs` imports the same module, so map and image never drift.
 */

export const TILE_SIZE = 16;
export const TILESET_COLUMNS = 8;

function noiseFloor(img, base, seed) {
  const rng = makeRng(seed);
  img.rect(0, 0, 16, 16, base);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rng();
      if (r < 0.05) img.px(x, y, '#2b3141');
      else if (r > 0.96) img.px(x, y, '#212531');
    }
  }
  // faint tile seam
  img.hline(0, 15, 15, PAL.floorSeam);
  img.vline(15, 0, 15, PAL.floorSeam);
}

function wallFaceBase(img) {
  img.rect(0, 0, 16, 16, PAL.wallFace);
  img.hline(0, 15, 0, PAL.wallFaceHi);
  img.vline(7, 1, 12, PAL.wallSeam);
  img.vline(15, 1, 12, PAL.wallSeam);
  img.hline(0, 15, 13, PAL.wallSeam);
  img.hline(0, 15, 14, PAL.wallBase);
  img.hline(0, 15, 15, PAL.wallBaseLo);
}

function deskHalf(img, side) {
  const x0 = side === 'left' ? 1 : 0;
  const x1 = side === 'left' ? 15 : 14;
  // surface
  img.rect(x0, 3, x1 - x0 + 1, 8, PAL.woodTop);
  img.hline(x0, x1, 3, PAL.woodHi);
  img.hline(x0, x1, 5, PAL.woodGrain);
  img.hline(x0, x1, 8, PAL.woodGrain);
  // front face + bottom edge
  img.rect(x0, 11, x1 - x0 + 1, 3, PAL.woodFace);
  img.hline(x0, x1, 13, PAL.woodDark);
  // outer edge + leg
  if (side === 'left') {
    img.vline(1, 3, 13, PAL.woodDark);
    img.rect(2, 14, 2, 2, PAL.woodLeg);
  } else {
    img.vline(14, 3, 13, PAL.woodDark);
    img.rect(12, 14, 2, 2, PAL.woodLeg);
  }
}

function monitorBase(img) {
  // small desk monitor used by the item_* tiles
  img.rect(3, 2, 10, 9, PAL.bezel);
  img.rect(4, 3, 8, 6, PAL.screen);
  img.rect(7, 11, 2, 1, PAL.steelPanel);
  img.rect(5, 12, 6, 1, PAL.steelPanel);
}

export const TILE_DEFS = [
  {
    name: 'floor_a',
    draw(img) {
      noiseFloor(img, PAL.floorA, seedFromString('floor_a'));
    },
  },
  {
    name: 'floor_b',
    draw(img) {
      noiseFloor(img, PAL.floorB, seedFromString('floor_b'));
    },
  },
  {
    name: 'floor_shadow',
    draw(img) {
      noiseFloor(img, PAL.floorB, seedFromString('floor_shadow'));
      img.rect(0, 0, 16, 2, PAL.floorShadow1);
      img.rect(0, 2, 16, 2, PAL.floorShadow2);
      img.rect(0, 4, 16, 1, '#20242f');
    },
  },
  {
    name: 'carpet',
    draw(img) {
      img.rect(0, 0, 16, 16, PAL.carpet);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if ((x * 7 + y * 3) % 11 < 2) img.px(x, y, PAL.carpetDot);
        }
      }
      img.hline(0, 15, 15, PAL.carpetSeam);
      img.vline(15, 0, 15, PAL.carpetSeam);
    },
  },
  {
    name: 'rug_violet',
    draw(img) {
      img.rect(0, 0, 16, 16, PAL.rug);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if ((x + y) % 4 === 0 && (x * 5 + y) % 7 < 2) img.px(x, y, PAL.rugDot);
        }
      }
      img.px(1, 1, PAL.rugGold);
      img.px(14, 1, PAL.rugGold);
      img.px(1, 14, PAL.rugGold);
      img.px(14, 14, PAL.rugGold);
      img.hline(0, 15, 15, PAL.rugSeam);
      img.vline(15, 0, 15, PAL.rugSeam);
    },
  },
  {
    name: 'wall_top',
    draw(img) {
      img.rect(0, 0, 16, 16, PAL.wallTop);
      img.hline(0, 15, 0, PAL.wallTopHi);
      img.hline(0, 15, 15, PAL.wallTopLo);
    },
  },
  {
    name: 'wall_face',
    draw(img) {
      wallFaceBase(img);
    },
  },
  {
    name: 'wall_face_panel',
    draw(img) {
      wallFaceBase(img);
      img.outline(3, 3, 10, 8, PAL.wallSeam);
      img.rect(4, 4, 8, 6, PAL.wallPanel);
      img.px(5, 5, PAL.wallFaceHi);
      img.px(10, 8, PAL.wallFaceHi);
    },
  },
  {
    name: 'wall_face_accent',
    draw(img) {
      wallFaceBase(img);
      img.hline(2, 13, 4, PAL.cyanDark);
      img.hline(2, 13, 5, PAL.cyan);
      img.hline(2, 13, 6, PAL.cyanDim);
      img.hline(2, 13, 7, PAL.cyanDark);
    },
  },
  {
    name: 'wall_face_vent',
    draw(img) {
      wallFaceBase(img);
      for (const y of [4, 6, 8, 10]) {
        img.hline(4, 11, y, PAL.vent);
      }
      img.outline(3, 3, 10, 9, PAL.wallSeam);
    },
  },
  {
    name: 'window_night',
    draw(img) {
      wallFaceBase(img);
      img.outline(2, 1, 12, 11, PAL.frame);
      img.rect(3, 2, 10, 9, PAL.night);
      img.px(5, 4, PAL.star);
      img.px(9, 3, PAL.starDim);
      img.px(11, 7, PAL.star);
      img.px(4, 8, PAL.starDim);
      img.px(7, 6, PAL.starDim);
      img.rect(10, 3, 2, 2, PAL.moon);
      img.px(10, 4, PAL.night);
      img.hline(2, 13, 12, PAL.wallFaceHi);
    },
  },
  {
    name: 'door',
    draw(img) {
      img.rect(0, 0, 16, 16, PAL.wallTop);
      img.rect(2, 2, 12, 14, '#0d1019');
      img.outline(2, 2, 12, 14, '#1f2736');
      img.hline(4, 11, 3, PAL.cyanDim);
      img.vline(7, 4, 15, '#161b26');
      img.px(5, 9, PAL.cyanDim);
      img.px(10, 9, PAL.cyanDim);
    },
  },
  {
    name: 'desk_l',
    draw(img) {
      deskHalf(img, 'left');
    },
  },
  {
    name: 'desk_r',
    draw(img) {
      deskHalf(img, 'right');
    },
  },
  {
    name: 'chair',
    draw(img) {
      img.rect(5, 2, 6, 6, PAL.chair);
      img.hline(5, 10, 2, '#404a5e');
      img.rect(4, 8, 8, 4, PAL.chairSeat);
      img.outline(4, 8, 8, 4, '#242b38');
      img.rect(5, 12, 2, 3, PAL.chairLeg);
      img.rect(9, 12, 2, 3, PAL.chairLeg);
    },
  },
  {
    name: 'plant',
    draw(img) {
      img.rect(5, 11, 6, 4, PAL.pot);
      img.hline(5, 10, 11, PAL.potRim);
      img.rect(6, 15, 4, 1, PAL.woodLeg);
      // leaf cluster
      img.rect(5, 4, 6, 7, PAL.leafDark);
      img.rect(4, 6, 8, 4, PAL.leafDark);
      img.rect(6, 3, 4, 3, PAL.leaf);
      img.px(5, 5, PAL.leaf);
      img.px(10, 5, PAL.leaf);
      img.px(7, 2, PAL.leafHi);
      img.px(9, 4, PAL.leafHi);
      img.px(5, 8, PAL.leafHi);
      img.px(11, 7, PAL.leaf);
    },
  },
  {
    name: 'coffee_machine',
    draw(img) {
      img.rect(3, 2, 10, 13, PAL.steel);
      img.outline(3, 2, 10, 13, '#2c3340');
      img.rect(5, 3, 6, 3, PAL.steelPanel);
      img.px(10, 4, PAL.cyan);
      img.rect(5, 8, 3, 4, PAL.amberDim);
      img.px(6, 9, PAL.amber);
      img.rect(9, 10, 2, 2, PAL.paper);
      img.px(9, 7, PAL.steam);
      img.px(10, 6, PAL.steam);
      img.rect(4, 15, 8, 1, '#20242f');
    },
  },
  {
    name: 'bookshelf',
    draw(img) {
      img.rect(2, 1, 12, 14, PAL.shelfFrame);
      img.outline(2, 1, 12, 14, PAL.shelfDark);
      const spineColors = ['#a04848', '#4878a0', '#48a070', '#c9a23e', '#7a5acd'];
      for (const shelfY of [2, 7, 12]) {
        img.hline(3, 12, shelfY + 4, PAL.shelfDark);
        for (let i = 0; i < 5; i++) {
          const color = spineColors[(i + shelfY) % spineColors.length];
          img.rect(3 + i * 2, shelfY, 2, 4, color);
          img.px(3 + i * 2, shelfY, '#00000033');
        }
      }
    },
  },
  {
    name: 'item_chart_cyan',
    draw(img) {
      monitorBase(img);
      const pts = [
        [4, 8],
        [5, 7],
        [6, 8],
        [7, 6],
        [8, 6],
        [9, 5],
        [10, 4],
        [11, 4],
      ];
      for (const [x, y] of pts) img.px(x, y, PAL.cyan);
      img.hline(4, 11, 8, PAL.cyanDark);
    },
  },
  {
    name: 'item_chart_blue',
    draw(img) {
      monitorBase(img);
      const heights = [2, 3, 1, 4, 2, 5, 3, 4];
      heights.forEach((h, i) => {
        img.vline(4 + i, 9 - h, 8, PAL.blue);
        img.px(4 + i, 9 - h, PAL.blueHi);
      });
    },
  },
  {
    name: 'item_code_green',
    draw(img) {
      monitorBase(img);
      img.hline(4, 8, 4, PAL.green);
      img.hline(5, 10, 5, PAL.greenDim);
      img.hline(4, 7, 6, PAL.greenDim);
      img.hline(5, 9, 7, PAL.green);
      img.px(4, 8, PAL.green);
    },
  },
  {
    name: 'item_checklist',
    draw(img) {
      monitorBase(img);
      img.hline(5, 10, 4, PAL.amber);
      img.px(4, 4, PAL.green);
      img.hline(5, 10, 6, PAL.amberDim);
      img.px(4, 6, PAL.red);
      img.hline(5, 9, 8, PAL.amberDim);
      img.px(4, 8, PAL.amber);
    },
  },
  {
    name: 'item_status_green',
    draw(img) {
      monitorBase(img);
      img.px(4, 4, PAL.green);
      img.hline(6, 11, 4, PAL.screenBarDim);
      img.px(4, 6, PAL.green);
      img.hline(6, 10, 6, PAL.screenBarDim);
      img.px(4, 8, PAL.amber);
      img.hline(6, 11, 8, PAL.screenBarDim);
    },
  },
  {
    name: 'item_papers',
    draw(img) {
      img.rect(4, 5, 6, 7, PAL.paperShade);
      img.rect(6, 4, 6, 7, PAL.paper);
      img.hline(7, 10, 6, PAL.paperLine);
      img.hline(7, 10, 8, PAL.paperLine);
      img.hline(7, 9, 10, PAL.paperLine);
      img.line(11, 12, 13, 10, PAL.goldDim);
      img.px(13, 10, PAL.gold);
    },
  },
  {
    name: 'item_mug',
    draw(img) {
      img.rect(5, 8, 4, 5, PAL.mug);
      img.hline(5, 8, 8, '#cb6a66');
      img.vline(10, 9, 11, PAL.mug);
      img.px(6, 5, PAL.steam);
      img.px(7, 4, PAL.steam);
      img.rect(10, 11, 4, 3, PAL.paper);
      img.hline(11, 13, 12, PAL.paperLine);
    },
  },
  {
    name: 'item_terminal',
    draw(img) {
      monitorBase(img);
      img.hline(4, 6, 4, PAL.cyan);
      img.px(7, 4, PAL.cyanDim);
      img.hline(4, 5, 6, PAL.cyanDim);
      img.px(6, 8, PAL.cyan);
    },
  },
];

export const TILE_NAMES = TILE_DEFS.map((def) => def.name);

export function tileGid(name) {
  const index = TILE_NAMES.indexOf(name);
  if (index === -1) throw new Error(`Unknown tile "${name}"`);
  return index + 1;
}

export function renderTileset() {
  const rows = Math.ceil(TILE_DEFS.length / TILESET_COLUMNS);
  const sheet = new Img(TILESET_COLUMNS * TILE_SIZE, rows * TILE_SIZE);
  TILE_DEFS.forEach((def, i) => {
    const tile = new Img(TILE_SIZE, TILE_SIZE);
    def.draw(tile);
    sheet.blit(tile, (i % TILESET_COLUMNS) * TILE_SIZE, Math.floor(i / TILESET_COLUMNS) * TILE_SIZE);
  });
  return sheet;
}
