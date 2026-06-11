import { Img, makeRng, seedFromString } from './img.mjs';
import { nightify, PAL } from './palette.mjs';

/**
 * Environment + furniture tiles (32×32). The array order is the tileset
 * order: local tile id = index, gid = index + 1 (firstgid = 1).
 * `generate-map.mjs` imports the same module, so map and image never drift.
 *
 * All art is drawn once in the Day Office palette; the night tileset is
 * derived via `nightify()` (see palette.mjs). Tiles that need real night art
 * (windows) are `themed` and draw per theme.
 */

export const TILE_SIZE = 32;
export const TILESET_COLUMNS = 8;
export const THEMES = ['day', 'night'];

/** Copy a TILE_SIZE×TILE_SIZE region of `src` into tile `img`. */
function copyRegion(img, src, sx, sy) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const si = ((sy + y) * src.width + (sx + x)) * 4;
      const di = (y * img.width + x) * 4;
      img.data[di] = src.data[si];
      img.data[di + 1] = src.data[si + 1];
      img.data[di + 2] = src.data[si + 2];
      img.data[di + 3] = src.data[si + 3];
    }
  }
}

// ---------------------------------------------------------------------------
// floors
// ---------------------------------------------------------------------------

function plankFloor(img, seed, base) {
  const rng = makeRng(seed);
  img.rect(0, 0, 32, 32, base);
  // grain noise
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const r = rng();
      if (r < 0.035) img.px(x, y, PAL.plankHi);
      else if (r > 0.965) img.px(x, y, PAL.plank);
    }
  }
  // horizontal plank seams every 8px + staggered butt joints
  for (let band = 0; band < 4; band++) {
    const y = band * 8 + 7;
    img.hline(0, 31, y, PAL.floorSeam);
    const joint = (band * 13 + Math.floor(rng() * 8) * 4) % 32;
    img.vline(joint, band * 8, y - 1, PAL.plank);
  }
}

function rugTile(img, edges, colors) {
  img.rect(0, 0, 32, 32, colors.base);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if ((x * 7 + y * 5) % 13 < 2) img.px(x, y, colors.dot);
    }
  }
  if (edges.top) {
    img.hline(0, 31, 0, colors.edge);
    img.hline(0, 31, 1, colors.border);
    img.hline(0, 31, 2, colors.border);
  }
  if (edges.bottom) {
    img.hline(0, 31, 31, colors.edge);
    img.hline(0, 31, 30, colors.border);
    img.hline(0, 31, 29, colors.border);
  }
  if (edges.left) {
    img.vline(0, 0, 31, colors.edge);
    img.vline(1, 0, 31, colors.border);
    img.vline(2, 0, 31, colors.border);
  }
  if (edges.right) {
    img.vline(31, 0, 31, colors.edge);
    img.vline(30, 0, 31, colors.border);
    img.vline(29, 0, 31, colors.border);
  }
  if (colors.corner && edges.top && edges.left) img.rect(4, 4, 2, 2, colors.corner);
  if (colors.corner && edges.top && edges.right) img.rect(26, 4, 2, 2, colors.corner);
  if (colors.corner && edges.bottom && edges.left) img.rect(4, 26, 2, 2, colors.corner);
  if (colors.corner && edges.bottom && edges.right) img.rect(26, 26, 2, 2, colors.corner);
}

const RUG_COLORS = {
  base: PAL.rug,
  dot: PAL.rugDot,
  border: PAL.rugBorder,
  edge: PAL.rugEdge,
};
const BOSS_RUG_COLORS = {
  base: PAL.brug,
  dot: PAL.brugDot,
  border: PAL.brugBorder,
  edge: PAL.brugEdge,
  corner: PAL.brugGold,
};

const RUG_EDGES = {
  tl: { top: true, left: true },
  t: { top: true },
  tr: { top: true, right: true },
  l: { left: true },
  c: {},
  r: { right: true },
  bl: { bottom: true, left: true },
  b: { bottom: true },
  br: { bottom: true, right: true },
};

// ---------------------------------------------------------------------------
// walls
// ---------------------------------------------------------------------------

function wallCap(img) {
  img.rect(0, 0, 32, 32, PAL.wallTop);
  img.hline(0, 31, 0, PAL.wallTopHi);
  img.hline(0, 31, 1, PAL.wallTopHi);
  img.hline(0, 31, 30, PAL.wallTopLo);
  img.hline(0, 31, 31, PAL.wallTopLo);
  img.vline(15, 2, 29, PAL.wallTopLo);
}

function wallFaceUpper(img) {
  img.rect(0, 0, 32, 32, PAL.wallFace);
  img.hline(0, 31, 0, PAL.wallFaceHi);
  img.hline(0, 31, 1, PAL.wallFaceHi);
  // faint panel seams
  img.vline(31, 2, 31, PAL.wallSeam);
}

function wallFaceLower(img) {
  img.rect(0, 0, 32, 12, PAL.wallFace);
  img.vline(31, 0, 11, PAL.wallSeam);
  // wainscot band
  img.hline(0, 31, 12, PAL.wainscotLine);
  img.rect(0, 13, 32, 14, PAL.wainscot);
  img.vline(7, 14, 25, PAL.wainscotLine);
  img.vline(23, 14, 25, PAL.wainscotLine);
  img.hline(0, 31, 26, PAL.wainscotLine);
  // baseboard
  img.rect(0, 27, 32, 4, PAL.baseboard);
  img.hline(0, 31, 31, PAL.baseboardLo);
}

// ---------------------------------------------------------------------------
// big multi-tile art (windows, door, bookshelf, vending)
// ---------------------------------------------------------------------------

let _winDay = null;
let _winNight = null;

function windowBig() {
  if (_winDay) return _winDay;
  const img = new Img(64, 64);
  // wall behind (upper face rows + lower face rows)
  for (const ox of [0, 32]) {
    const u = new Img(32, 32);
    wallFaceUpper(u);
    img.blit(u, ox, 0);
    const l = new Img(32, 32);
    wallFaceLower(l);
    img.blit(l, ox, 32);
  }
  // frame
  img.rect(4, 2, 56, 42, PAL.frame);
  img.outline(4, 2, 56, 42, PAL.frameDark);
  img.hline(5, 58, 3, PAL.frameHi);
  // glass
  img.rect(8, 6, 48, 34, PAL.sky);
  img.rect(8, 6, 48, 10, PAL.skyHi);
  // sun glow top-left
  img.rect(10, 8, 8, 5, PAL.sun);
  img.rect(12, 7, 4, 7, PAL.sun);
  // clouds
  img.rect(24, 12, 12, 3, PAL.cloud);
  img.rect(28, 10, 6, 3, PAL.cloud);
  img.rect(40, 22, 10, 3, PAL.cloud);
  img.rect(14, 26, 9, 3, PAL.cloud);
  // mullions
  img.rect(30, 6, 3, 34, PAL.frame);
  img.rect(8, 21, 48, 2, PAL.frame);
  // sill
  img.rect(2, 44, 60, 4, PAL.sill);
  img.hline(2, 61, 44, PAL.frameHi);
  img.hline(2, 61, 47, PAL.frameDark);
  _winDay = img;
  return img;
}

function windowNightBig() {
  if (_winNight) return _winNight;
  const img = nightify(windowBig());
  // re-draw the glass with real night art
  const glass = (x, y, w, h) => {
    img.rect(x, y, w, h, PAL.nightSky);
    img.rect(x, y, w, 6, PAL.nightSkyHi);
  };
  glass(8, 6, 22, 15);
  glass(33, 6, 23, 15);
  glass(8, 23, 22, 17);
  glass(33, 23, 23, 17);
  // moon + stars
  img.rect(44, 9, 5, 5, PAL.moon);
  img.px(44, 9, PAL.nightSkyHi);
  img.px(48, 13, PAL.nightSkyHi);
  for (const [x, y, dim] of [
    [13, 10, false],
    [21, 8, true],
    [27, 14, false],
    [37, 12, true],
    [53, 17, false],
    [11, 26, true],
    [25, 25, false],
    [50, 27, true],
  ]) {
    img.px(x, y, dim ? PAL.starDim : PAL.star);
  }
  // city skyline at the bottom of the glass
  for (const [x, w, h] of [
    [9, 5, 6],
    [16, 4, 9],
    [22, 6, 5],
    [34, 5, 8],
    [41, 4, 5],
    [47, 7, 7],
  ]) {
    img.rect(x, 40 - h, w, h, PAL.city);
    img.px(x + 1, 40 - h + 2, PAL.cityLit);
    if (w > 4) img.px(x + 3, 40 - h + 4, PAL.cityLit);
  }
  _winNight = img;
  return img;
}

let _door = null;

function doorBig() {
  if (_door) return _door;
  const img = new Img(64, 64);
  for (const ox of [0, 32]) {
    const u = new Img(32, 32);
    wallFaceUpper(u);
    img.blit(u, ox, 0);
    const l = new Img(32, 32);
    wallFaceLower(l);
    img.blit(l, ox, 32);
  }
  // door frame + opening
  img.rect(10, 4, 44, 60, PAL.doorFrame);
  img.rect(13, 7, 38, 57, PAL.door);
  img.hline(13, 50, 7, PAL.doorHi);
  img.vline(13, 7, 63, PAL.doorHi);
  // two leaves
  img.vline(31, 8, 63, PAL.doorDark);
  img.vline(32, 8, 63, PAL.doorDark);
  // inset panels
  for (const ox of [16, 35]) {
    img.outline(ox, 12, 13, 20, PAL.doorDark);
    img.outline(ox, 38, 13, 20, PAL.doorDark);
    img.hline(ox + 1, ox + 11, 12, PAL.doorDark);
  }
  // handles
  img.rect(27, 34, 3, 6, PAL.handle);
  img.rect(34, 34, 3, 6, PAL.handle);
  // small transom window
  img.rect(18, 1, 28, 3, PAL.doorFrame);
  return (_door = img);
}

let _shelf = null;

function bookshelfBig() {
  if (_shelf) return _shelf;
  const img = new Img(32, 64);
  // body
  img.rect(2, 0, 28, 62, PAL.shelfFrame);
  img.outline(2, 0, 28, 62, PAL.shelfDark);
  img.hline(3, 28, 1, '#a87f55');
  const spines = ['#b85a50', '#5878b8', '#58a070', '#c9a23e', '#8a6acd', '#d08848'];
  // three book shelves
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 4 + shelf * 13;
    img.rect(4, y, 24, 11, PAL.shelfDark);
    img.hline(3, 28, y + 11, PAL.shelfBoard);
    img.hline(3, 28, y + 12, PAL.shelfDark);
    for (let i = 0; i < 6; i++) {
      const color = spines[(i + shelf * 2) % spines.length];
      const h = 8 + ((i * 5 + shelf * 3) % 3);
      img.rect(5 + i * 4, y + 11 - h, 3, h, color);
      img.px(5 + i * 4, y + 11 - h, '#00000033');
    }
    // a leaning book
    if (shelf === 1) img.rect(26, y + 4, 2, 7, spines[(shelf + 3) % spines.length]);
  }
  // lower cabinet
  img.rect(4, 44, 24, 14, PAL.shelfBoard);
  img.outline(4, 44, 24, 14, PAL.shelfDark);
  img.vline(16, 45, 57, PAL.shelfDark);
  img.rect(13, 50, 2, 3, PAL.handle);
  img.rect(18, 50, 2, 3, PAL.handle);
  // feet
  img.rect(4, 62, 4, 2, PAL.shelfDark);
  img.rect(24, 62, 4, 2, PAL.shelfDark);
  return (_shelf = img);
}

let _vending = null;

function vendingBig() {
  if (_vending) return _vending;
  const img = new Img(32, 64);
  img.rect(4, 0, 24, 62, PAL.vending);
  img.outline(4, 0, 24, 62, PAL.vendingDark);
  img.hline(5, 26, 1, PAL.vendingHi);
  img.vline(5, 1, 60, PAL.vendingHi);
  // header
  img.rect(7, 3, 18, 4, PAL.vendingDark);
  img.hline(9, 14, 4, PAL.cyan);
  img.hline(17, 22, 5, PAL.cyan);
  // product window
  img.rect(7, 9, 14, 34, PAL.screenDeep);
  img.outline(7, 9, 14, 34, PAL.vendingDark);
  const snacks = ['#d08848', '#b85a50', '#58a070', '#c9a23e', '#5878b8', '#c46a9a'];
  for (let row = 0; row < 4; row++) {
    const y = 11 + row * 8;
    for (let i = 0; i < 3; i++) {
      img.rect(9 + i * 4, y, 3, 5, snacks[(row + i * 2) % snacks.length]);
    }
    img.hline(8, 19, y + 6, '#3a414e');
  }
  // coin panel
  img.rect(23, 12, 4, 12, PAL.steelPanel);
  img.px(24, 14, PAL.amber);
  img.rect(24, 18, 2, 4, '#10131f');
  // dispense slot
  img.rect(7, 47, 14, 8, PAL.steelPanel);
  img.rect(9, 49, 10, 4, '#10131f');
  // feet
  img.rect(6, 62, 5, 2, PAL.vendingDark);
  img.rect(21, 62, 5, 2, PAL.vendingDark);
  return (_vending = img);
}

// ---------------------------------------------------------------------------
// desks & seats
// ---------------------------------------------------------------------------

function deskSurface(img, side) {
  // desk top (rows 0..23), front face (24..29), legs + floor gap below
  img.rect(0, 0, 32, 22, PAL.deskTop);
  img.hline(0, 31, 0, PAL.deskHi);
  img.hline(0, 31, 1, PAL.deskHi);
  img.hline(0, 31, 9, PAL.deskGrain);
  img.hline(0, 31, 16, PAL.deskGrain);
  img.hline(0, 31, 22, PAL.deskDark);
  img.rect(0, 23, 32, 6, PAL.deskFace);
  img.hline(0, 31, 28, PAL.deskDark);
  if (side === 'left') {
    img.vline(0, 0, 28, PAL.deskDark);
    img.rect(1, 29, 3, 3, PAL.deskLeg);
  } else {
    img.vline(31, 0, 28, PAL.deskDark);
    img.rect(28, 29, 3, 3, PAL.deskLeg);
  }
}

function monitorOnDesk(img, drawScreen) {
  // bezel + stand + keyboard + mouse
  img.rect(6, 1, 20, 13, PAL.bezel);
  img.outline(6, 1, 20, 13, PAL.bezelDark);
  img.hline(7, 24, 1, PAL.bezelHi);
  img.rect(8, 3, 16, 9, PAL.screen);
  drawScreen(img);
  img.rect(14, 14, 4, 2, PAL.bezelDark);
  img.rect(11, 16, 10, 1, PAL.bezel);
  // keyboard
  img.rect(8, 18, 15, 4, PAL.keyboard);
  img.outline(8, 18, 15, 4, PAL.keyboardDark);
  for (let x = 10; x <= 20; x += 2) img.px(x, 19, PAL.keyboardKeys);
  for (let x = 11; x <= 21; x += 2) img.px(x, 20, PAL.keyboardKeys);
  // mouse + pad
  img.rect(25, 18, 5, 4, '#b8a888');
  img.rect(26, 18, 3, 3, PAL.keyboard);
  img.px(27, 18, PAL.keyboardDark);
}

function screenChart(img) {
  const pts = [
    [9, 10],
    [11, 8],
    [13, 9],
    [15, 7],
    [17, 7],
    [19, 5],
    [21, 6],
    [23, 4],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    img.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], PAL.cyan);
  }
  img.hline(9, 23, 11, PAL.cyanDark);
  img.px(23, 4, '#d4fff2');
}

function screenCode(img) {
  img.hline(9, 15, 4, PAL.green);
  img.hline(10, 19, 6, PAL.greenDim);
  img.hline(9, 13, 8, PAL.greenDim);
  img.hline(10, 17, 10, PAL.green);
  img.px(21, 10, PAL.green);
}

function deskItemsBase(img) {
  deskSurface(img, 'right');
}

// ---------------------------------------------------------------------------
// tile defs
// ---------------------------------------------------------------------------

export const TILE_DEFS = [
  {
    name: 'floor_a',
    draw(img) {
      plankFloor(img, seedFromString('floor_a'), PAL.floorA);
    },
  },
  {
    name: 'floor_b',
    draw(img) {
      plankFloor(img, seedFromString('floor_b'), PAL.floorB);
    },
  },
  {
    name: 'floor_shadow',
    draw(img) {
      plankFloor(img, seedFromString('floor_shadow'), PAL.floorB);
      img.rect(0, 0, 32, 4, '#54401f88');
      img.rect(0, 4, 32, 3, '#54401f44');
    },
  },
  {
    name: 'doormat',
    draw(img) {
      plankFloor(img, seedFromString('doormat'), PAL.floorB);
      img.rect(2, 4, 28, 24, PAL.matBase);
      img.outline(2, 4, 28, 24, PAL.matLine);
      img.outline(4, 6, 24, 20, PAL.matHi);
      for (let i = 0; i < 6; i++) img.hline(7, 24, 9 + i * 3, PAL.matLine);
    },
  },
  ...Object.entries(RUG_EDGES).map(([key, edges]) => ({
    name: `rug_${key}`,
    draw(img) {
      rugTile(img, edges, RUG_COLORS);
    },
  })),
  ...Object.entries(RUG_EDGES).map(([key, edges]) => ({
    name: `brug_${key}`,
    draw(img) {
      rugTile(img, edges, BOSS_RUG_COLORS);
    },
  })),
  {
    name: 'wall_top',
    draw(img) {
      wallCap(img);
    },
  },
  {
    name: 'wall_face_u',
    draw(img) {
      wallFaceUpper(img);
    },
  },
  {
    name: 'wall_face_l',
    draw(img) {
      wallFaceLower(img);
    },
  },
  {
    name: 'wall_vent',
    draw(img) {
      wallFaceUpper(img);
      img.rect(8, 10, 16, 12, PAL.vent);
      img.outline(8, 10, 16, 12, PAL.ventDark);
      for (const y of [13, 16, 19]) img.hline(10, 21, y, PAL.ventDark);
    },
  },
  {
    name: 'wall_clock',
    draw(img) {
      wallFaceUpper(img);
      // simple round wall clock
      img.rect(11, 7, 10, 10, PAL.clockRim);
      img.px(11, 7, PAL.wallFace);
      img.px(20, 7, PAL.wallFace);
      img.px(11, 16, PAL.wallFace);
      img.px(20, 16, PAL.wallFace);
      img.rect(12, 8, 8, 8, PAL.clockFace);
      img.vline(15, 9, 12, '#3a414e');
      img.hline(16, 18 - 1, 12, '#3a414e');
      img.px(16, 12, '#b8554f');
    },
  },
  {
    name: 'poster',
    draw(img) {
      wallFaceUpper(img);
      img.rect(8, 5, 16, 21, PAL.paper);
      img.outline(8, 5, 16, 21, '#8a7a5e');
      img.hline(10, 21, 8, PAL.paperLine);
      // little equity-curve print
      img.line(10, 20, 14, 16, PAL.cyanDim);
      img.line(14, 16, 17, 18, PAL.cyanDim);
      img.line(17, 18, 21, 12, PAL.cyanDim);
      img.hline(10, 21, 22, PAL.paperLine);
    },
  },
  {
    name: 'notice_board',
    draw(img) {
      wallFaceUpper(img);
      img.rect(5, 6, 22, 18, PAL.cork);
      img.outline(5, 6, 22, 18, PAL.shelfDark);
      img.outline(6, 7, 20, 16, PAL.corkDark);
      // pinned notes
      img.rect(8, 9, 6, 6, PAL.paper);
      img.rect(16, 10, 6, 5, '#e7d089');
      img.rect(10, 17, 6, 5, '#bcd8a8');
      img.rect(19, 17, 5, 5, PAL.paperShade);
      img.px(10, 9, PAL.red);
      img.px(18, 10, '#5878b8');
      img.px(12, 17, '#b8554f');
    },
  },
  // 2×2 window (themed: day sky / night sky)
  ...['tl', 'tr', 'bl', 'br'].map((corner, i) => ({
    name: `window_${corner}`,
    themed: true,
    draw(img, theme) {
      const big = theme === 'night' ? windowNightBig() : windowBig();
      copyRegion(img, big, (i % 2) * 32, Math.floor(i / 2) * 32);
    },
  })),
  // 2×2 double door
  ...['tl', 'tr', 'bl', 'br'].map((corner, i) => ({
    name: `door_${corner}`,
    draw(img) {
      copyRegion(img, doorBig(), (i % 2) * 32, Math.floor(i / 2) * 32);
    },
  })),
  {
    name: 'desk_mon_chart',
    draw(img) {
      deskSurface(img, 'left');
      monitorOnDesk(img, screenChart);
    },
  },
  {
    name: 'desk_mon_code',
    draw(img) {
      deskSurface(img, 'left');
      monitorOnDesk(img, screenCode);
    },
  },
  {
    name: 'desk_items_lamp',
    draw(img) {
      deskItemsBase(img);
      // papers
      img.rect(3, 12, 9, 7, PAL.paperShade);
      img.rect(5, 11, 9, 7, PAL.paper);
      img.hline(6, 12, 13, PAL.paperLine);
      img.hline(6, 12, 15, PAL.paperLine);
      // mug
      img.rect(16, 15, 4, 5, PAL.mug);
      img.hline(16, 19, 15, PAL.mugHi);
      img.vline(21, 16, 18, PAL.mug);
      img.px(17, 12, PAL.steam);
      img.px(18, 10, PAL.steam);
      // desk lamp (arm + warm glowing shade)
      img.rect(23, 16, 6, 2, PAL.steelPanel);
      img.line(26, 15, 23, 7, PAL.steelDark);
      img.rect(20, 4, 8, 3, PAL.steelPanel);
      img.hline(20, 27, 7, PAL.gold);
      img.px(21, 8, PAL.sun);
      img.px(24, 8, PAL.sun);
    },
  },
  {
    name: 'desk_items_docs',
    draw(img) {
      deskItemsBase(img);
      // document stack
      img.rect(4, 8, 11, 9, PAL.paperShade);
      img.rect(6, 7, 11, 9, PAL.paper);
      img.hline(7, 14, 9, PAL.paperLine);
      img.hline(7, 14, 11, PAL.paperLine);
      img.hline(7, 12, 13, PAL.paperLine);
      // sticky notes
      img.rect(20, 8, 5, 5, '#e7d089');
      img.rect(24, 14, 5, 5, '#bcd8a8');
      // pen
      img.line(6, 20, 12, 18, '#3a414e');
      // tiny succulent
      img.rect(26, 4, 4, 3, PAL.pot);
      img.px(27, 2, PAL.leaf);
      img.px(28, 3, PAL.leafHi);
      img.px(26, 3, PAL.leafDark);
    },
  },
  {
    name: 'chair_office',
    draw(img) {
      // empty office chair, front view
      img.rect(9, 2, 14, 13, PAL.chair);
      img.outline(9, 2, 14, 13, PAL.chairDark);
      img.hline(10, 21, 3, PAL.chairHi);
      img.rect(8, 15, 16, 6, PAL.chairDark);
      img.hline(9, 22, 15, PAL.chairHi);
      // armrests
      img.rect(5, 10, 3, 8, PAL.chairDark);
      img.rect(24, 10, 3, 8, PAL.chairDark);
      // column + star base
      img.rect(14, 21, 4, 5, PAL.chairLeg);
      img.line(15, 26, 7, 29, PAL.chairLeg);
      img.line(16, 26, 24, 29, PAL.chairLeg);
      img.vline(15, 26, 29, PAL.chairLeg);
      img.vline(16, 26, 29, PAL.chairLeg);
      img.rect(6, 29, 3, 2, PAL.chairLeg);
      img.rect(23, 29, 3, 2, PAL.chairLeg);
      img.rect(14, 29, 4, 2, PAL.chairLeg);
    },
  },
  {
    name: 'bookshelf_top',
    draw(img) {
      copyRegion(img, bookshelfBig(), 0, 0);
    },
  },
  {
    name: 'bookshelf_bottom',
    draw(img) {
      copyRegion(img, bookshelfBig(), 0, 32);
    },
  },
  {
    name: 'plant_big',
    draw(img) {
      // pot
      img.rect(10, 22, 12, 8, PAL.pot);
      img.hline(9, 22, 22, PAL.potRim);
      img.hline(9, 22, 23, PAL.potRim);
      img.rect(12, 30, 8, 2, PAL.shelfDark);
      // foliage
      img.rect(9, 6, 14, 16, PAL.leafDark);
      img.rect(7, 9, 18, 10, PAL.leafDark);
      img.rect(11, 3, 10, 8, PAL.leaf);
      img.rect(8, 10, 6, 6, PAL.leaf);
      img.rect(18, 11, 6, 6, PAL.leaf);
      img.px(13, 2, PAL.leafHi);
      img.px(17, 4, PAL.leafHi);
      img.px(9, 11, PAL.leafHi);
      img.px(22, 12, PAL.leafHi);
      img.px(15, 8, PAL.leafHi);
      img.vline(15, 16, 22, PAL.shelfDark);
      img.vline(16, 16, 22, PAL.shelfDark);
    },
  },
  {
    name: 'plant_small',
    draw(img) {
      img.rect(12, 21, 8, 6, PAL.pot);
      img.hline(11, 20, 21, PAL.potRim);
      img.rect(13, 27, 6, 1, PAL.shelfDark);
      img.rect(12, 12, 8, 9, PAL.leafDark);
      img.rect(14, 10, 5, 6, PAL.leaf);
      img.px(15, 9, PAL.leafHi);
      img.px(13, 13, PAL.leafHi);
      img.px(19, 14, PAL.leaf);
    },
  },
  {
    name: 'trash_bin',
    draw(img) {
      img.rect(10, 14, 12, 15, PAL.bin);
      img.outline(10, 14, 12, 15, PAL.binDark);
      img.vline(13, 15, 27, PAL.binDark);
      img.vline(18, 15, 27, PAL.binDark);
      img.vline(11, 15, 27, PAL.binHi);
      img.rect(9, 12, 14, 3, PAL.binDark);
      img.hline(10, 21, 12, PAL.binHi);
      img.rect(11, 11, 10, 1, '#23282f');
    },
  },
  {
    name: 'water_cooler',
    draw(img) {
      // bottle
      img.rect(11, 3, 10, 8, PAL.bottle);
      img.outline(11, 3, 10, 8, '#6da8c8');
      img.px(13, 4, PAL.bottleHi);
      img.px(14, 5, PAL.bottleHi);
      // body
      img.rect(9, 11, 14, 18, PAL.cooler);
      img.outline(9, 11, 14, 18, PAL.coolerDark);
      img.vline(21, 12, 28, PAL.coolerShade);
      img.rect(12, 15, 8, 3, PAL.coolerShade);
      img.px(13, 16, '#5878b8');
      img.px(18, 16, PAL.redDim);
      img.rect(13, 19, 6, 3, '#3a414e');
      img.rect(10, 29, 4, 2, PAL.coolerDark);
      img.rect(18, 29, 4, 2, PAL.coolerDark);
    },
  },
  {
    name: 'vending_top',
    draw(img) {
      copyRegion(img, vendingBig(), 0, 0);
    },
  },
  {
    name: 'vending_bottom',
    draw(img) {
      copyRegion(img, vendingBig(), 0, 32);
    },
  },
  {
    name: 'cabinet_coffee',
    draw(img) {
      // low cabinet
      img.rect(2, 16, 28, 14, PAL.shelfFrame);
      img.outline(2, 16, 28, 14, PAL.shelfDark);
      img.hline(3, 28, 17, '#a87f55');
      img.vline(16, 18, 28, PAL.shelfDark);
      img.rect(12, 22, 2, 3, PAL.handle);
      img.rect(18, 22, 2, 3, PAL.handle);
      // coffee machine on top
      img.rect(6, 3, 12, 13, PAL.steel);
      img.outline(6, 3, 12, 13, PAL.steelDark);
      img.rect(8, 5, 8, 3, PAL.steelPanel);
      img.px(15, 6, PAL.green);
      img.rect(8, 10, 5, 4, PAL.amberDim);
      img.px(9, 11, PAL.amber);
      img.px(10, 1, PAL.steam);
      img.px(11, 0, PAL.steam);
      // cups
      img.rect(21, 11, 4, 4, PAL.paper);
      img.rect(25, 12, 3, 3, PAL.paperShade);
    },
  },
];

export const TILE_NAMES = TILE_DEFS.map((def) => def.name);

export function tileGid(name) {
  const index = TILE_NAMES.indexOf(name);
  if (index === -1) throw new Error(`Unknown tile "${name}"`);
  return index + 1;
}

/** @param {'day'|'night'} theme */
export function renderTileset(theme = 'day') {
  const rows = Math.ceil(TILE_DEFS.length / TILESET_COLUMNS);
  const sheet = new Img(TILESET_COLUMNS * TILE_SIZE, rows * TILE_SIZE);
  TILE_DEFS.forEach((def, i) => {
    let tile = new Img(TILE_SIZE, TILE_SIZE);
    if (def.themed) {
      def.draw(tile, theme);
    } else {
      def.draw(tile);
      if (theme === 'night') tile = nightify(tile);
    }
    sheet.blit(
      tile,
      (i % TILESET_COLUMNS) * TILE_SIZE,
      Math.floor(i / TILESET_COLUMNS) * TILE_SIZE,
    );
  });
  return sheet;
}
