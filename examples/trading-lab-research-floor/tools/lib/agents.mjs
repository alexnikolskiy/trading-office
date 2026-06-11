import { Img, upscale } from './img.mjs';
import { PAL, ROLE_STYLES } from './palette.mjs';

/**
 * Original back-facing seated agents (LPC-inspired silhouettes, fully
 * original pixels). Drawn on a logical 16-px grid and upscaled ×2 — final
 * frames are 32×44 (Boss: 32×48 in the tall executive chair).
 *
 * The agent is seen from behind / slightly above, facing its desk: the
 * viewer sees hair, shoulders and the office chair backrest. The chair is
 * part of the sprite, so a workstation always lines up: desk tiles above,
 * agent tucked in below, never "standing on the desk".
 *
 * Roles read through hair style + color, shirt color on the shoulders and
 * head-level accessories (cap, headset, bun, ponytail) — no front-face
 * details needed. Two idle frames: a subtle 1-px head bob.
 */

export const AGENT_FRAMES = 2;

const O = PAL.outline;

/** Big chunky head from behind: hair block with a 1-px outline. */
function drawHead(img, style, bob) {
  const y = 1 + bob;
  // outlined hair block (10 wide — LPC-ish big head)
  img.rect(3, y, 10, 7, O);
  img.rect(4, y + 1, 8, 5, style.hair);
  img.hline(4, 11, y + 1, style.hair);
  img.hline(5, 10, y, style.hair);
  // shading toward the nape
  img.hline(4, 11, y + 5, style.hairShade);
  // ear tips
  img.px(3, y + 3, style.skin);
  img.px(12, y + 3, style.skin);

  switch (style.hairStyle) {
    case 'short':
      // nape of the neck visible under short hair
      img.rect(6, y + 6, 4, 1, style.skin);
      break;
    case 'long':
      // hair flows over the shoulders (drawn before the backrest)
      img.rect(3, y + 7, 2, 4, style.hair);
      img.rect(11, y + 7, 2, 4, style.hair);
      img.px(3, y + 10, style.hairShade);
      img.px(12, y + 10, style.hairShade);
      break;
    case 'ponytail':
      img.rect(6, y + 6, 4, 1, style.skin);
      img.rect(7, y + 5, 2, 7, style.hairShade);
      img.hline(7, 8, y + 5, style.accent); // hair tie
      break;
    case 'bun':
      img.rect(6, y - 1, 4, 2, style.hairShade);
      img.outline(6, y - 1, 4, 2, O);
      break;
    default:
      break;
  }

  switch (style.accessory) {
    case 'cap': {
      img.rect(4, y, 8, 3, style.accent);
      img.hline(5, 10, y - 0, style.accent);
      img.hline(4, 11, y + 2, style.topShade);
      // adjuster hole at the back of the cap
      img.rect(7, y + 1, 2, 1, style.hairShade);
      break;
    }
    case 'headset': {
      const dark = '#1d212b';
      img.hline(4, 11, y, dark);
      img.rect(2, y + 3, 2, 3, dark);
      img.rect(12, y + 3, 2, 3, dark);
      img.px(13, y + 5, PAL.green);
      break;
    }
    default:
      break;
  }
}

/**
 * Shoulders seen from behind. Arms stay hidden behind the chair backrest —
 * a clean silhouette reads better than floating arm pixels.
 */
function drawTorso(img, style, bob) {
  img.rect(3, 7 + bob, 10, 6, O);
  img.rect(4, 8 + bob, 8, 4, style.top);
  img.hline(4, 11, 11 + bob, style.topShade);
}

/** Standard office task chair: backrest covers the lower torso. */
function drawChair(img) {
  // backrest
  img.rect(2, 11, 12, 8, O);
  img.rect(3, 12, 10, 6, PAL.chair);
  img.hline(3, 12, 12, PAL.chairHi);
  img.hline(3, 12, 17, PAL.chairDark);
  // gas column + star base
  img.rect(7, 19, 2, 2, PAL.chairLeg);
  img.hline(4, 11, 21, PAL.chairLeg);
  img.px(3, 21, PAL.chairLeg);
  img.px(12, 21, PAL.chairLeg);
}

/** Tall executive chair for the Boss: wings + headrest + gold trim. */
function drawExecChair(img) {
  // headrest behind the head (drawn before the head)
  img.rect(4, 5, 8, 4, O);
  img.rect(5, 6, 6, 2, PAL.execChairDark);
  // tall backrest with wings above the shoulders
  img.rect(1, 12, 14, 9, O);
  img.rect(2, 13, 12, 7, PAL.execChair);
  img.hline(2, 13, 13, PAL.gold);
  img.vline(2, 14, 19, PAL.execChairHi);
  img.vline(13, 14, 19, PAL.execChairDark);
  // wings
  img.rect(1, 10, 2, 3, O);
  img.px(1, 11, PAL.execChair);
  img.px(2, 11, PAL.execChair);
  img.rect(13, 10, 2, 3, O);
  img.px(14, 11, PAL.execChair);
  img.px(13, 11, PAL.execChair);
  // column + star base
  img.rect(7, 21, 2, 2, PAL.chairLeg);
  img.hline(3, 12, 23, PAL.chairLeg);
  img.px(2, 23, PAL.chairLeg);
  img.px(13, 23, PAL.chairLeg);
}

function drawStandardAgent(img, style, bob) {
  drawTorso(img, style, bob);
  drawHead(img, style, bob);
  drawChair(img);
}

function drawBoss(img, style, bob) {
  drawExecChair(img);
  // suit shoulders, slightly wider
  img.rect(2, 8 + bob, 12, 6, O);
  img.rect(3, 9 + bob, 10, 4, style.top);
  img.hline(3, 12, 12 + bob, style.topShade);
  // gold collar peeking over the suit
  img.px(7, 9 + bob, style.accent);
  img.px(8, 9 + bob, style.accent);
  drawHead(img, style, bob + 1);
  // re-draw backrest top over the torso bottom so he sits IN the chair
  img.hline(2, 13, 14, PAL.execChair);
  img.hline(2, 13, 13, PAL.gold);
}

/** @returns {Img} one upscaled frame (32×44, Boss 32×48) */
export function drawAgentFrame(role, bob) {
  const style = ROLE_STYLES[role];
  if (!style) throw new Error(`No agent style for role "${role}"`);
  const logical = new Img(16, style.executive ? 24 : 22);
  if (style.executive) drawBoss(logical, style, bob);
  else drawStandardAgent(logical, style, bob);
  return upscale(logical, 2);
}

/** @returns {Img[]} two idle frames */
export function drawAgentFrames(role) {
  return [drawAgentFrame(role, 0), drawAgentFrame(role, 1)];
}

export const AGENT_ROLES = Object.keys(ROLE_STYLES);
