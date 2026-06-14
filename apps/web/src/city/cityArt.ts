/**
 * cityArt.ts — pure, deterministic pixel-art primitives for the city scene.
 *
 * No DOM, no third-party assets: a seeded RNG, richly-shaded day/night
 * palettes, a 5×7 bitmap marquee font, and varied building/cloud generators.
 * The React components turn this data into crisp SVG <rect>s.
 *
 * The scene is authored in a 480×270 integer "pixel" space and scaled up to
 * fill the viewport (shape-rendering: crispEdges), so one unit reads as a
 * chunky pixel block while still leaving room for real detail.
 */

export type Mood = 'day' | 'night';

/* --------------------------------------------------------------------- RNG */

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const ri = (r: () => number, lo: number, hi: number): number =>
  lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

/* ----------------------------------------------------------------- palette */

export interface Material {
  hi: string;
  face: string;
  shade: string;
}

export interface CityPalette {
  // sky
  skyTop: string;
  skyHi: string;
  skyMid: string;
  skyLow: string;
  skyHaze: string;
  orb: string;
  orbCore: string;
  orbRay: string;
  cloud: string;
  cloudHi: string;
  cloudShade: string;
  star: string;
  bird: string;
  // distant skyline tiers (atmospheric; far3 = farthest/lightest)
  far1: string;
  far2: string;
  far3: string;
  // mid/front building materials (varied)
  buildings: readonly Material[];
  winLit: string;
  winCool: string;
  winWarm: string;
  winDark: string;
  // hero tower
  pier: string;
  pierHi: string;
  pierShade: string;
  glass: string;
  glassHi: string;
  glassLow: string;
  mullion: string;
  crown: string;
  crownHi: string;
  beacon: string;
  lobby: string;
  lobbyGlow: string;
  awning: string;
  // sign
  signFrame: string;
  signOn: string;
  signGlow: string;
  // signage on other buildings
  neon: readonly string[];
  // ground
  ground: string;
  sidewalk: string;
  sidewalkHi: string;
  curb: string;
  road: string;
  roadLine: string;
  crosswalk: string;
  tree: string;
  treeHi: string;
  treeShade: string;
  trunk: string;
  bush: string;
  lampPost: string;
  lampGlow: string;
  hydrant: string;
  bench: string;
  car: readonly string[];
  ped: readonly string[];
  // shared ui
  accent: string;
  ink: string;
}

export const PALETTES: Record<Mood, CityPalette> = {
  day: {
    skyTop: '#3aa0e0', skyHi: '#5bb6e8', skyMid: '#8fd0ef', skyLow: '#bfe6f6', skyHaze: '#dcf0fa',
    orb: '#fff4c0', orbCore: '#ffffff', orbRay: '#ffe89a',
    cloud: '#ffffff', cloudHi: '#ffffff', cloudShade: '#cfe4f2',
    star: '#ffffff', bird: '#3a4658',
    far3: '#bcd4e7', far2: '#a4c3db', far1: '#8cafca',
    buildings: [
      { hi: '#dbe4ec', face: '#c4d2df', shade: '#a3b6c8' },
      { hi: '#e7ddc6', face: '#d3c6a7', shade: '#b1a07e' },
      { hi: '#d3dde7', face: '#b9c6d6', shade: '#94a6bb' },
      { hi: '#ead3c2', face: '#d6b6a0', shade: '#b48d77' },
      { hi: '#d0e1d8', face: '#b2cabd', shade: '#8caa9b' },
      { hi: '#dfd6e6', face: '#c7bad6', shade: '#a394ba' },
    ],
    winLit: '#ffd98a', winCool: '#bfe4f4', winWarm: '#ffc04a', winDark: '#8ea6bb',
    pier: '#eef3f7', pierHi: '#ffffff', pierShade: '#cbd5df',
    glass: '#5e9ec4', glassHi: '#93c6e4', glassLow: '#3f6f93', mullion: '#dbe7ef',
    crown: '#e2eaf1', crownHi: '#ffffff', beacon: '#ff5a5a',
    lobby: '#ffe9b0', lobbyGlow: '#ffd166', awning: '#2bb39a',
    signFrame: '#16203a', signOn: '#59f7d4', signGlow: '#9bfce6',
    neon: ['#ff7a9c', '#ffd166', '#59f7d4', '#7aa9ff', '#ff9f5a'],
    ground: '#6f7888', sidewalk: '#c2cad4', sidewalkHi: '#d6dde4', curb: '#99a3b1',
    road: '#565d6e', roadLine: '#e8d27a', crosswalk: '#e8edf2',
    tree: '#43a35c', treeHi: '#5cc077', treeShade: '#2f7a48', trunk: '#6b4a2f',
    bush: '#4ea862', lampPost: '#3a4453', lampGlow: '#ffe9a8',
    hydrant: '#d9534f', bench: '#7a5331',
    car: ['#d9534f', '#3a78c2', '#e0a93f', '#5aa469'],
    ped: ['#5b8def', '#e0843f', '#c65b8f', '#3fae9a'],
    accent: '#59f7d4', ink: '#16202e',
  },
  night: {
    skyTop: '#060d20', skyHi: '#0c1733', skyMid: '#19294c', skyLow: '#2b4066', skyHaze: '#3a5072',
    orb: '#eef2fc', orbCore: '#ffffff', orbRay: '#aab8e0',
    cloud: '#2a3a55', cloudHi: '#36486c', cloudShade: '#1d2942',
    star: '#dbe8ff', bird: '#2a3650',
    far3: '#22324f', far2: '#1a2742', far1: '#142036',
    buildings: [
      { hi: '#2f3d5d', face: '#243150', shade: '#19243f' },
      { hi: '#39455f', face: '#2c374e', shade: '#1f2a3e' },
      { hi: '#2c3c5c', face: '#212f4c', shade: '#162339' },
      { hi: '#3a3652', face: '#2c2a45', shade: '#1f1d34' },
      { hi: '#24403a', face: '#1d322e', shade: '#142420' },
      { hi: '#3a3148', face: '#2c2539', shade: '#1e1827' },
    ],
    winLit: '#ffd27f', winCool: '#7fd8ff', winWarm: '#ffb84d', winDark: '#1b2640',
    pier: '#39466a', pierHi: '#4d5c82', pierShade: '#28324f',
    glass: '#1f3a5c', glassHi: '#315a84', glassLow: '#16304d', mullion: '#34466a',
    crown: '#2e3a5c', crownHi: '#46567d', beacon: '#ff5a5a',
    lobby: '#ffe6a8', lobbyGlow: '#ffcf6b', awning: '#1f7d6e',
    signFrame: '#0a1226', signOn: '#59f7d4', signGlow: '#39c9b4',
    neon: ['#ff5a8c', '#ffd166', '#59f7d4', '#6f9bff', '#ff8f43'],
    ground: '#141c30', sidewalk: '#2a3450', sidewalkHi: '#36436a', curb: '#222c46',
    road: '#11192c', roadLine: '#c9a94f', crosswalk: '#2f3a55',
    tree: '#2c6a42', treeHi: '#357f50', treeShade: '#1f4d30', trunk: '#3f2c1c',
    bush: '#2c6a42', lampPost: '#2a3450', lampGlow: '#ffe9a8',
    hydrant: '#b5453f', bench: '#3f2c1c',
    car: ['#b5453f', '#2f5a92', '#b9863a', '#3f7d5e'],
    ped: ['#4b6fc0', '#c06a30', '#a04b72', '#2f8a7a'],
    accent: '#59f7d4', ink: '#cfe0ff',
  },
};

/* ----------------------------------------------------------- bitmap font */

const FONT: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#.#.#', '#..##', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
};

export interface PixelText {
  width: number;
  height: number;
  pixels: ReadonlyArray<readonly [number, number]>;
}

export function pixelText(text: string): PixelText {
  const pixels: Array<[number, number]> = [];
  const GAP = 1;
  let x = 0;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') {
      x += 4;
      continue;
    }
    const glyph = FONT[ch];
    if (!glyph) {
      x += 5 + GAP;
      continue;
    }
    glyph.forEach((rowStr, row) => {
      for (let col = 0; col < rowStr.length; col++) {
        if (rowStr[col] === '#') pixels.push([x + col, row]);
      }
    });
    x += 5 + GAP;
  }
  return { width: Math.max(0, x - GAP), height: 7, pixels };
}

/* -------------------------------------------------------- skyline + clouds */

export type Roof = 'flat' | 'parapet' | 'step' | 'penthouse' | 'water' | 'antenna' | 'billboard';

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  mat: number; // index into palette.buildings
  roof: Roof;
  seed: number; // per-building rng seed for windows/details
  lit: boolean;
  sign: number; // -1 none, else neon index
}

export interface SkylineOptions {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
  lit: boolean;
  detail: boolean; // roofs + signs
  gap: number;
}

const ROOFS: Roof[] = ['flat', 'parapet', 'step', 'penthouse', 'water', 'antenna', 'billboard'];

export function buildSkyline(seed: number, areaW: number, baseY: number, matCount: number, opts: SkylineOptions): Building[] {
  const r = makeRng(seed);
  const out: Building[] = [];
  let x = -ri(r, 0, opts.minW);
  while (x < areaW + opts.maxW) {
    const w = ri(r, opts.minW, opts.maxW);
    const h = ri(r, opts.minH, opts.maxH);
    const roof: Roof = opts.detail ? pick(r, ROOFS) : 'flat';
    const sign = opts.detail && r() > 0.74 ? ri(r, 0, 4) : -1;
    out.push({ x, y: baseY - h, w, h, mat: ri(r, 0, matCount - 1), roof, seed: ri(r, 1, 99999), lit: opts.lit, sign });
    x += w + ri(r, opts.gap, opts.gap + 5);
  }
  return out;
}

export type CloudKind = 'puff' | 'long' | 'small';

export interface Cloud {
  x: number;
  y: number;
  u: number; // unit size
  kind: CloudKind;
  speed: number;
}

export function buildClouds(seed: number, areaW: number, count: number): Cloud[] {
  const r = makeRng(seed);
  const kinds: CloudKind[] = ['puff', 'long', 'small'];
  const out: Cloud[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: ri(r, 0, areaW),
      y: ri(r, 10, 78),
      u: ri(r, 2, 4),
      kind: pick(r, kinds),
      speed: 14 + r() * 16,
    });
  }
  return out;
}

export interface Star {
  x: number;
  y: number;
  big: boolean;
  phase: number;
}

export function buildStars(seed: number, areaW: number, maxY: number, count: number): Star[] {
  const r = makeRng(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ x: ri(r, 0, areaW), y: ri(r, 0, maxY), big: r() > 0.86, phase: ri(r, 0, 6) });
  }
  return out;
}
