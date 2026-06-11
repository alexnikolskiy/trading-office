import { Img } from './img.mjs';
import { PAL, ROLE_STYLES } from './palette.mjs';

/**
 * Original 16×24 pixel agents, two idle frames (subtle head bob).
 * One shared body template, per-role palette + hair style + accessory.
 */

export const AGENT_WIDTH = 16;
export const AGENT_HEIGHT = 24;
export const AGENT_FRAMES = 2;

const HEAD_SHORT = [
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHSSSSSSHO...',
  '...OSESSSSESO...',
  '...OSSSSSSSSO...',
  '...OWSSSSSSWO...',
  '....OSSSSSSO....',
  '.....OSSSSO.....',
];

const HEAD_LONG = [
  '.....OOOOOO.....',
  '....OHHHHHHO....',
  '...OHHHHHHHHO...',
  '...OHHHHHHHHO...',
  '...OHSSSSSSHO...',
  '...OHESSSSEHO...',
  '...OHSSSSSSHO...',
  '...OHSSSSSSHO...',
  '....OHSSSSHO....',
  '.....OSSSSO.....',
];

const BODY = [
  '....OTTTTTTO....',
  '..OOTTTTTTTTOO..',
  '.OTTTTTTTTTTTTO.',
  '.OTDTTTAATTTDTO.',
  '.OTDTTTAATTTDTO.',
  '.OSSOTTTTTTOSSO.',
  '..OOOTTTTTTOOO..',
  '....ODDDDDDO....',
  '....OPPPPPPO....',
  '....OPPOOPPO....',
  '....OPPOOPPO....',
  '....OQQOOQQO....',
  '...OBBBOOBBBO...',
  '....OOO..OOO....',
];

const CAP_ROWS = [
  '.....OOOOOO.....',
  '....OCCCCCCO....',
  '...OCCCCCCCCO...',
  '..OCCCCCCCCCCO..',
];

function paletteFor(style) {
  return {
    O: PAL.outline,
    H: style.hair,
    S: style.skin,
    W: style.skinShade,
    E: PAL.eye,
    T: style.top,
    D: style.topShade,
    A: style.accent,
    P: PAL.pants,
    Q: PAL.pantsShade,
    B: PAL.shoes,
    C: style.accent,
  };
}

function drawAccessory(img, style, headY) {
  switch (style.accessory) {
    case 'glasses': {
      const frame = '#aeb9d8';
      const y = headY + 5;
      img.px(4, y, frame);
      img.px(6, y, frame);
      img.px(7, y, '#8a93a8');
      img.px(8, y, '#8a93a8');
      img.px(9, y, frame);
      img.px(11, y, frame);
      break;
    }
    case 'headset': {
      const dark = '#1a1f2b';
      img.hline(5, 10, headY + 1, dark);
      img.px(3, headY + 5, dark);
      img.px(3, headY + 6, dark);
      img.px(12, headY + 5, dark);
      img.px(12, headY + 6, dark);
      img.px(12, headY + 7, '#2c3a55');
      img.px(13, headY + 8, PAL.green);
      break;
    }
    case 'tie': {
      img.px(7, 15, style.accent);
      img.px(8, 15, style.accent);
      img.px(7, 16, '#c9a23e');
      break;
    }
    default:
      break;
  }
}

/** @returns {Img} one 16×24 frame */
export function drawAgentFrame(role, headOffset) {
  const style = ROLE_STYLES[role];
  if (!style) throw new Error(`No agent style for role "${role}"`);
  const palette = paletteFor(style);

  const img = new Img(AGENT_WIDTH, AGENT_HEIGHT);
  img.ascii(BODY, palette, 0, 10);

  const head = style.hairStyle === 'long' ? [...HEAD_LONG] : [...HEAD_SHORT];
  if (style.accessory === 'cap') {
    head.splice(0, 4, ...CAP_ROWS);
  }
  img.ascii(head, palette, 0, headOffset);
  drawAccessory(img, style, headOffset);
  return img;
}

/** @returns {Img[]} two idle frames */
export function drawAgentFrames(role) {
  return [drawAgentFrame(role, 0), drawAgentFrame(role, 1)];
}

export const AGENT_ROLES = Object.keys(ROLE_STYLES);
