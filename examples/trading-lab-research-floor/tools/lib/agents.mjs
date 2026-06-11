import { Img } from './img.mjs';
import { PAL, ROLE_STYLES } from './palette.mjs';

/**
 * Original 32×40 pixel agents, two idle frames (subtle head bob).
 *
 * Two poses share one head:
 * - 'seated': the agent sits in an office chair (the chair is part of the
 *   sprite, so a workstation always lines up: desk tile above, agent below).
 * - 'standing': used by the Boss behind the command console.
 */

export const AGENT_WIDTH = 32;
export const AGENT_HEIGHT = 40;
export const AGENT_FRAMES = 2;

const O = PAL.outline;

function drawHead(img, style, t) {
  const S = style.skin;
  const W = style.skinShade;
  const H = style.hair;

  // silhouette
  img.rect(8, t - 1, 16, 15, O);
  // hair cap
  img.rect(9, t, 14, 4, H);
  img.px(9, t, O);
  img.px(22, t, O);
  // face
  img.rect(9, t + 4, 14, 9, S);
  img.hline(10, 21, t + 12, W);
  if (style.hairStyle === 'long') {
    img.rect(9, t + 4, 2, 9, H);
    img.rect(21, t + 4, 2, 9, H);
    img.px(10, t + 13, H);
    img.px(21, t + 13, H);
  } else {
    img.rect(9, t + 4, 1, 2, H);
    img.rect(22, t + 4, 1, 2, H);
  }
  // bangs
  img.px(12, t + 4, H);
  img.px(16, t + 4, H);
  img.px(19, t + 4, H);
  // eyes + mouth
  img.rect(12, t + 6, 2, 2, PAL.eye);
  img.rect(18, t + 6, 2, 2, PAL.eye);
  img.hline(15, 16, t + 10, W);

  // accessories that live on the head
  switch (style.accessory) {
    case 'glasses': {
      const frame = '#e8ecf4';
      img.hline(11, 14, t + 5, frame);
      img.hline(17, 20, t + 5, frame);
      img.px(11, t + 6, frame);
      img.px(14, t + 6, frame);
      img.px(17, t + 6, frame);
      img.px(20, t + 6, frame);
      img.hline(15, 16, t + 6, frame);
      break;
    }
    case 'headset': {
      const dark = '#1d212b';
      img.hline(9, 22, t, dark);
      img.rect(7, t + 5, 2, 5, dark);
      img.rect(23, t + 5, 2, 5, dark);
      img.px(8, t + 10, dark);
      img.px(9, t + 11, dark);
      img.px(10, t + 11, PAL.green);
      break;
    }
    case 'cap': {
      img.rect(9, t, 14, 4, style.accent);
      img.hline(8, 23, t + 4, style.topShade);
      img.px(9, t, O);
      img.px(22, t, O);
      break;
    }
    default:
      break;
  }
}

function drawTorso(img, style, y) {
  // y = torso top row
  img.rect(7, y - 1, 18, 14, O);
  img.rect(8, y, 16, 12, style.top);
  img.rect(8, y + 9, 16, 3, style.topShade);
  // collar + chest accent
  img.hline(13, 18, y, style.topShade);
  img.hline(12, 19, y + 3, style.accent);
}

function drawSeated(img, style, bob) {
  const C = PAL.chair;
  const K = PAL.chairDark;
  const L = PAL.chairLeg;

  // chair backrest behind the torso
  img.rect(5, 14, 22, 18, K);
  img.rect(6, 15, 20, 16, C);
  img.hline(7, 24, 15, PAL.chairHi);

  // body
  drawTorso(img, style, 16);
  drawHead(img, style, 3 + bob);

  // arms resting forward
  img.rect(4, 21, 4, 9, O);
  img.rect(5, 22, 2, 6, style.top);
  img.rect(5, 28, 2, 2, style.skin);
  img.rect(24, 21, 4, 9, O);
  img.rect(25, 22, 2, 6, style.top);
  img.rect(25, 28, 2, 2, style.skin);

  // lap + shoes
  img.rect(7, 27, 18, 7, O);
  img.rect(8, 28, 16, 5, PAL.pants);
  img.hline(8, 23, 32, PAL.pantsShade);
  img.rect(9, 33, 4, 3, PAL.shoes);
  img.rect(19, 33, 4, 3, PAL.shoes);

  // seat edge + column + star base
  img.rect(7, 31, 18, 2, K);
  img.rect(14, 34, 4, 3, L);
  img.line(14, 36, 7, 38, L);
  img.line(17, 36, 24, 38, L);
  img.vline(15, 36, 38, L);
  img.vline(16, 36, 38, L);
  img.rect(6, 38, 3, 2, L);
  img.rect(23, 38, 3, 2, L);
  img.rect(14, 38, 4, 2, L);
}

function drawStanding(img, style, bob) {
  // body
  drawTorso(img, style, 16);
  drawHead(img, style, 3 + bob);

  // arms down the sides
  img.rect(4, 16, 4, 12, O);
  img.rect(5, 17, 2, 8, style.top);
  img.rect(5, 25, 2, 2, style.skin);
  img.rect(24, 16, 4, 12, O);
  img.rect(25, 17, 2, 8, style.top);
  img.rect(25, 25, 2, 2, style.skin);

  // suit lapels + tie
  if (style.accessory === 'tie') {
    img.vline(12, 17, 22, style.topShade);
    img.vline(19, 17, 22, style.topShade);
    img.rect(15, 17, 2, 2, style.accent);
    img.vline(15, 19, 24, style.accent);
    img.px(16, 20, PAL.goldDim);
  }

  // legs + shoes
  img.rect(8, 27, 16, 10, O);
  img.rect(9, 28, 6, 8, PAL.pants);
  img.rect(17, 28, 6, 8, PAL.pants);
  img.hline(9, 14, 34, PAL.pantsShade);
  img.hline(17, 22, 34, PAL.pantsShade);
  img.rect(8, 36, 7, 4, PAL.shoes);
  img.rect(17, 36, 7, 4, PAL.shoes);
  img.hline(8, 14, 36, '#3a414e');
  img.hline(17, 23, 36, '#3a414e');
}

/** @returns {Img} one 32×40 frame */
export function drawAgentFrame(role, bob) {
  const style = ROLE_STYLES[role];
  if (!style) throw new Error(`No agent style for role "${role}"`);
  const img = new Img(AGENT_WIDTH, AGENT_HEIGHT);
  if (style.pose === 'standing') drawStanding(img, style, bob);
  else drawSeated(img, style, bob);
  return img;
}

/** @returns {Img[]} two idle frames */
export function drawAgentFrames(role) {
  return [drawAgentFrame(role, 0), drawAgentFrame(role, 1)];
}

export const AGENT_ROLES = Object.keys(ROLE_STYLES);
