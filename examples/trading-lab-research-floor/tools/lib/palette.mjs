/**
 * "Retro Pixel AI Research Tower" — night palette. Original, not sampled
 * from any reference image.
 *
 * Mood: cozy night research office + trading command center.
 * Graphite/navy floors, steel walls, cyan/green terminal accents, amber
 * warnings, violet/gold for the Boss/Orchestrator.
 */

export const PAL = {
  // floors
  floorA: '#272c39',
  floorB: '#242936',
  floorSeam: '#222633',
  floorShadow1: '#181c26',
  floorShadow2: '#1d212d',
  carpet: '#1f2740',
  carpetDot: '#253154',
  carpetSeam: '#1b2236',
  rug: '#292244',
  rugDot: '#332a56',
  rugSeam: '#241e3c',
  rugGold: '#6e5a32',

  // walls
  wallTop: '#10131c',
  wallTopHi: '#1a2030',
  wallTopLo: '#0b0d14',
  wallFace: '#313b50',
  wallFaceHi: '#45526c',
  wallSeam: '#283142',
  wallPanel: '#2b3447',
  wallBase: '#1d2433',
  wallBaseLo: '#181d2a',
  vent: '#1a212e',

  // night window
  frame: '#232b3c',
  night: '#0c1226',
  star: '#c7d3f2',
  starDim: '#6d7aa8',
  moon: '#dfe6f8',

  // terminal accents
  cyan: '#59f7d4',
  cyanDim: '#2c6b5e',
  cyanDark: '#1f4a42',
  green: '#69e85e',
  greenDim: '#2f8a5e',
  blue: '#4f9cff',
  blueHi: '#7ab8ff',
  amber: '#ffb454',
  amberDim: '#8a5a28',
  red: '#ff5d5d',
  redDim: '#a04848',
  violet: '#a06bff',
  violetDim: '#5a4a8a',
  gold: '#ffd166',
  goldDim: '#c9a23e',

  // furniture
  woodTop: '#8a6a4a',
  woodHi: '#9c7a56',
  woodGrain: '#7b5d40',
  woodFace: '#6a4c34',
  woodDark: '#57402c',
  woodLeg: '#3a2c20',
  shelfFrame: '#4a3526',
  shelfDark: '#2e2218',
  chair: '#353d4e',
  chairSeat: '#2b3240',
  chairLeg: '#1e242f',
  steel: '#3a4252',
  steelPanel: '#2a3142',

  // screens & paper
  bezel: '#1a1f2b',
  bezelDark: '#11141d',
  screen: '#07121a',
  screenDeep: '#081020',
  screenBar: '#2c3a55',
  screenBarDim: '#22304a',
  paper: '#d8dce8',
  paperShade: '#c4cbe0',
  paperLine: '#8a93a8',
  mug: '#b85450',
  steam: '#aeb9d8',

  // characters
  outline: '#131722',
  eye: '#1d2230',
  pants: '#2a3142',
  pantsShade: '#232a38',
  shoes: '#161b26',

  // plants
  pot: '#6a4c34',
  potRim: '#7b5d40',
  leafDark: '#2f6b3f',
  leaf: '#3f8a52',
  leafHi: '#57aa68',

  // rack / console bodies
  rackBody: '#14181f',
  rackPanel: '#1b212c',
  rackDark: '#0b0d14',
  consoleTop: '#2a2342',
  consoleTopHi: '#3a3258',
  consoleFace: '#221c38',
  consoleLeg: '#181430',
  holoTable: '#1b2334',
  holoRim: '#2c3a55',
  holoLeg: '#141a26',
};

/** Per-role colors for agent sprites. */
export const ROLE_STYLES = {
  boss: {
    skin: '#e8b48c',
    skinShade: '#d39e76',
    hair: '#241f2e',
    top: '#4a3370',
    topShade: '#3b2a5c',
    accent: '#ffd166',
    accessory: 'tie',
    hairStyle: 'short',
  },
  strategy_analyst: {
    skin: '#c98c5e',
    skinShade: '#b67c50',
    hair: '#1c2638',
    top: '#2a7f8a',
    topShade: '#226a74',
    accent: '#59f7d4',
    accessory: null,
    hairStyle: 'long',
  },
  researcher: {
    skin: '#f0c8a0',
    skinShade: '#dcb389',
    hair: '#7a4a2e',
    top: '#3f7d4f',
    topShade: '#346a42',
    accent: '#c4cbe0',
    accessory: 'glasses',
    hairStyle: 'short',
  },
  critic: {
    skin: '#e8b48c',
    skinShade: '#d39e76',
    hair: '#6e3636',
    top: '#c47a32',
    topShade: '#a86528',
    accent: '#ff5d5d',
    accessory: null,
    hairStyle: 'short',
  },
  builder: {
    skin: '#c98c5e',
    skinShade: '#b67c50',
    hair: '#3a2a1c',
    top: '#3e5a9c',
    topShade: '#324a82',
    accent: '#d8843a',
    accessory: 'cap',
    hairStyle: 'short',
  },
  evaluator: {
    skin: '#f0c8a0',
    skinShade: '#dcb389',
    hair: '#c9a23e',
    top: '#3e6ab0',
    topShade: '#335892',
    accent: '#7ab8ff',
    accessory: null,
    hairStyle: 'short',
  },
  performance_monitor: {
    skin: '#e8b48c',
    skinShade: '#d39e76',
    hair: '#2e4434',
    top: '#5aa05a',
    topShade: '#4a874a',
    accent: '#69e85e',
    accessory: 'headset',
    hairStyle: 'short',
  },
  knowledge_curator: {
    skin: '#d8a878',
    skinShade: '#c69566',
    hair: '#8a7ab0',
    top: '#7a6ab0',
    topShade: '#665894',
    accent: '#ffd166',
    accessory: null,
    hairStyle: 'long',
  },
};
