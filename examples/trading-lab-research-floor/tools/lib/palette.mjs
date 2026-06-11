/**
 * "Retro Pixel AI Research Tower" palette. Original, not sampled from any
 * reference image.
 *
 * The base art is drawn ONCE in the warm Day Office palette below. The night
 * tileset is derived from it: `nightify()` pushes every pixel toward a dark
 * blue cast, except EMISSIVE colors (screens, LEDs, lamp light), which keep
 * glowing. Tiles that need a true redraw at night (windows) opt in via a
 * `themed` draw function in tiles.mjs.
 */

import { hexToRgba } from './img.mjs';

export const PAL = {
  // --- terminal / screen accents (emissive at night) -----------------------
  cyan: '#59f7d4',
  cyanDim: '#2c8a76',
  cyanDark: '#1f5a4e',
  green: '#69e85e',
  greenDim: '#3a9a55',
  blue: '#4f9cff',
  blueHi: '#8ec4ff',
  amber: '#ffb454',
  amberDim: '#a6702f',
  red: '#ff5d5d',
  redDim: '#a04848',
  violet: '#a06bff',
  violetDim: '#6a55a0',
  gold: '#ffd166',
  goldDim: '#c9a23e',

  // --- screens & paper -----------------------------------------------------
  bezel: '#2b303c',
  bezelDark: '#1d212b',
  bezelHi: '#3c4250',
  screen: '#0d1726',
  screenDeep: '#091020',
  screenBar: '#33445f',
  screenBarDim: '#263650',
  keyboard: '#d8d4c6',
  keyboardKeys: '#b4b0a2',
  keyboardDark: '#8e8a7e',
  paper: '#efeadb',
  paperShade: '#dcd5c2',
  paperLine: '#a89e88',
  mug: '#c25f5b',
  mugHi: '#d4736f',
  steam: '#c9d2dc',

  // --- day floors ------------------------------------------------------------
  floorA: '#cfa671',
  floorB: '#c69d68',
  plank: '#b48c5a',
  plankHi: '#dab380',
  floorSeam: '#a8814f',
  floorShadow1: '#94713f',
  floorShadow2: '#b08a58',
  matBase: '#7d8a96',
  matLine: '#6b7884',
  matHi: '#8e9aa6',

  // --- office rugs -----------------------------------------------------------
  rug: '#b2b8b4',
  rugDot: '#bdc3bf',
  rugBorder: '#9aa19c',
  rugEdge: '#878f8a',
  brug: '#a99bc9',
  brugDot: '#b8abd5',
  brugBorder: '#8d7fb2',
  brugEdge: '#7c6fa2',
  brugGold: '#caa54b',

  // --- day walls -------------------------------------------------------------
  wallTop: '#5e6876',
  wallTopHi: '#717c8c',
  wallTopLo: '#4c5562',
  wallFace: '#e3d9c0',
  wallFaceHi: '#efe6d0',
  wallSeam: '#cfc3a6',
  wainscot: '#c4b394',
  wainscotLine: '#ab9a7c',
  baseboard: '#857257',
  baseboardLo: '#6b5b45',
  vent: '#9aa4b0',
  ventDark: '#7e8894',

  // --- windows ---------------------------------------------------------------
  frame: '#8a6f4a',
  frameHi: '#a98a5e',
  frameDark: '#6e5638',
  sill: '#b59468',
  sky: '#a5d8f0',
  skyHi: '#c8eaf9',
  cloud: '#ffffff',
  sun: '#ffe9a8',
  // night window redraw
  nightSky: '#101630',
  nightSkyHi: '#1a2342',
  star: '#cfd9f5',
  starDim: '#76819f',
  moon: '#e8edf8',
  city: '#2c3856',
  cityLit: '#d9b35c',

  // --- door ------------------------------------------------------------------
  door: '#9b6a42',
  doorHi: '#b58253',
  doorDark: '#7e5331',
  doorFrame: '#75573a',
  handle: '#caa54b',

  // --- desks / wood furniture --------------------------------------------------
  deskTop: '#b98a59',
  deskHi: '#caa06b',
  deskGrain: '#a87a4b',
  deskFace: '#936b41',
  deskDark: '#7c5835',
  deskLeg: '#5e4226',
  shelfFrame: '#96704a',
  shelfDark: '#6f5236',
  shelfBoard: '#7e5e3e',

  // --- chairs ------------------------------------------------------------------
  chair: '#4d5a74',
  chairDark: '#3c4860',
  chairHi: '#5e6c88',
  chairLeg: '#2f3848',

  // --- amenities -----------------------------------------------------------------
  pot: '#b06a48',
  potRim: '#c27d55',
  leaf: '#4e9e58',
  leafDark: '#3a7e44',
  leafHi: '#67bd6e',
  bin: '#7c8794',
  binDark: '#67727e',
  binHi: '#8e98a4',
  cooler: '#dde4ea',
  coolerShade: '#c2ccd6',
  coolerDark: '#9fa9b4',
  bottle: '#9fd4ef',
  bottleHi: '#c8eaf9',
  vending: '#4d7ec9',
  vendingDark: '#3c66a8',
  vendingHi: '#6c96d8',
  steel: '#9aa4b2',
  steelDark: '#6e7884',
  steelPanel: '#3a414e',
  clockFace: '#f3efe4',
  clockRim: '#5b6470',
  cork: '#c9a06a',
  corkDark: '#b08a58',

  // --- characters -----------------------------------------------------------------
  outline: '#26222b',
  eye: '#2a2533',
  pants: '#3e4658',
  pantsShade: '#333a4a',
  shoes: '#23282f',

  // --- racks / consoles -------------------------------------------------------------
  rackBody: '#272c36',
  rackPanel: '#323845',
  rackDark: '#1a1e26',
  consoleTop: '#564a82',
  consoleTopHi: '#695c98',
  consoleFace: '#463c6e',
  consoleLeg: '#332b54',
  holoTable: '#3e4a62',
  holoRim: '#56657f',
  holoLeg: '#2b3447',
};

/** Colors that keep glowing in the derived night tileset. */
export const EMISSIVE = [
  PAL.cyan,
  PAL.green,
  PAL.blue,
  PAL.blueHi,
  PAL.amber,
  PAL.red,
  PAL.violet,
  PAL.gold,
  PAL.sun,
];

const emissiveSet = new Set(
  EMISSIVE.map((hex) => hexToRgba(hex).slice(0, 3).join(',')),
);

/**
 * Derive the Night Control Room variant of an image: dark blue multiply with
 * a floor of ambient light, skipping emissive (screen/LED/lamp) pixels.
 */
export function nightify(img) {
  const out = img.clone();
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (emissiveSet.has(`${d[i]},${d[i + 1]},${d[i + 2]}`)) continue;
    d[i] = Math.round(d[i] * 0.34 + 10);
    d[i + 1] = Math.round(d[i + 1] * 0.38 + 13);
    d[i + 2] = Math.round(d[i + 2] * 0.52 + 30);
  }
  return out;
}

/** Per-role colors for agent sprites. `pose` picks the body template. */
export const ROLE_STYLES = {
  boss: {
    skin: '#e8b48c',
    skinShade: '#d39e76',
    hair: '#2b2536',
    top: '#5a3f86',
    topShade: '#4a3370',
    accent: '#ffd166',
    accessory: 'tie',
    hairStyle: 'short',
    pose: 'standing',
  },
  strategy_analyst: {
    skin: '#c98c5e',
    skinShade: '#b67c50',
    hair: '#1c2638',
    top: '#2f96a3',
    topShade: '#26818c',
    accent: '#59f7d4',
    accessory: null,
    hairStyle: 'long',
    pose: 'seated',
  },
  researcher: {
    skin: '#f0c8a0',
    skinShade: '#dcb389',
    hair: '#7a4a2e',
    top: '#4a945d',
    topShade: '#3d7e4e',
    accent: '#d8efc8',
    accessory: 'glasses',
    hairStyle: 'short',
    pose: 'seated',
  },
  critic: {
    skin: '#e8b48c',
    skinShade: '#d39e76',
    hair: '#6e3636',
    top: '#cd803a',
    topShade: '#b26c2e',
    accent: '#ff5d5d',
    accessory: null,
    hairStyle: 'short',
    pose: 'seated',
  },
  builder: {
    skin: '#c98c5e',
    skinShade: '#b67c50',
    hair: '#3a2a1c',
    top: '#3e6cb4',
    topShade: '#345a98',
    accent: '#e09040',
    accessory: 'cap',
    hairStyle: 'short',
    pose: 'seated',
  },
  evaluator: {
    skin: '#f0c8a0',
    skinShade: '#dcb389',
    hair: '#c9a23e',
    top: '#5d61b2',
    topShade: '#4e5298',
    accent: '#8ec4ff',
    accessory: null,
    hairStyle: 'long',
    pose: 'seated',
  },
  performance_monitor: {
    skin: '#e8b48c',
    skinShade: '#d39e76',
    hair: '#2e4434',
    top: '#56a268',
    topShade: '#478a57',
    accent: '#69e85e',
    accessory: 'headset',
    hairStyle: 'short',
    pose: 'seated',
  },
  knowledge_curator: {
    skin: '#d8a878',
    skinShade: '#c69566',
    hair: '#8a7ab0',
    top: '#8a76c4',
    topShade: '#7563ab',
    accent: '#ffd166',
    accessory: null,
    hairStyle: 'long',
    pose: 'seated',
  },
};
