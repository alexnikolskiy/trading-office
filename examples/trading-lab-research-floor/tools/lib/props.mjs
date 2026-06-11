import { Img, upscale } from './img.mjs';
import { PAL } from './palette.mjs';

/**
 * Interactive object sprites ("props"), each with 2 animation frames so the
 * floor feels alive: blinking LEDs, pulsing glyphs.
 *
 * Visual Iteration 2: drawn on a logical half-res grid and upscaled ×2 to
 * match the chunky tileset. Screens carry large simple shapes — a line, a
 * few bars, a dot — never dense fake dashboards.
 */

function wallMonitor(frame) {
  const img = new Img(48, 24);
  img.rect(0, 0, 48, 24, PAL.bezelDark);
  img.outline(0, 0, 48, 24, '#10131c');
  img.hline(1, 46, 1, PAL.bezelHi);
  img.rect(2, 2, 44, 20, PAL.screenDeep);
  // one bold equity line
  const pts = [
    [5, 17],
    [12, 14],
    [19, 15],
    [26, 10],
    [33, 12],
    [40, 6],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    img.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], PAL.cyan);
  }
  img.hline(5, 42, 19, PAL.cyanDark);
  if (frame === 1) img.rect(40, 5, 2, 2, '#d4fff2');
  // two chunky ticks
  img.rect(8, 19 - 3, 2, 3, PAL.greenDim);
  img.rect(30, 19 - 2, 2, 2, PAL.redDim);
  // wall mount
  img.rect(22, 23, 4, 1, '#10131c');
  return upscale(img, 2);
}

function hypothesisBoard(frame) {
  const img = new Img(48, 24);
  img.rect(0, 0, 48, 24, PAL.frame);
  img.outline(0, 0, 48, 24, PAL.frameDark);
  img.rect(2, 2, 44, 20, '#26303f');
  // 4 columns: draft / validated / built / live
  const headers = [PAL.paperLine, PAL.blue, PAL.amber, PAL.green];
  headers.forEach((color, i) => {
    img.rect(4 + i * 11, 3, 8, 2, color);
  });
  for (let i = 1; i < 4; i++) img.vline(3 + i * 11, 3, 20, '#34404f');
  const card = (col, row, color) => {
    img.rect(4 + col * 11, 7 + row * 5, 8, 3, color);
  };
  card(0, 0, PAL.paperShade);
  card(0, 1, PAL.paper);
  card(0, 2, PAL.paperShade);
  card(1, frame === 0 ? 0 : 1, PAL.blueHi);
  card(1, 2, '#5a8fd0');
  card(2, 0, PAL.gold);
  card(3, 0, PAL.green);
  card(3, 2, PAL.red);
  return upscale(img, 2);
}

function botStatusMonitor(frame) {
  const img = new Img(24, 32);
  // stand
  img.rect(10, 24, 4, 5, PAL.steelPanel);
  img.rect(5, 29, 14, 2, '#2b303c');
  img.hline(6, 18, 29, PAL.bezelHi);
  // panel
  img.rect(0, 0, 24, 24, PAL.bezelDark);
  img.outline(0, 0, 24, 24, '#10131c');
  img.rect(2, 2, 20, 20, PAL.screenDeep);
  // heartbeat blip
  const off = frame === 0 ? 0 : 2;
  img.line(5 + off, 5, 7 + off, 3, PAL.green);
  img.line(7 + off, 3, 8 + off, 6, PAL.green);
  // status rows: dot + bar
  const rows = [
    [9, PAL.green, true],
    [13, PAL.amber, true],
    [17, PAL.red, frame === 0],
  ];
  for (const [y, color, lit] of rows) {
    img.rect(4, y, 2, 2, lit ? color : '#3a2a2a');
    img.rect(8, y, 12, 2, PAL.screenBarDim);
    img.rect(8, y, lit ? 8 : 4, 2, '#2f4260');
  }
  return upscale(img, 2);
}

function archiveShelf(frame) {
  const img = new Img(32, 32);
  img.rect(1, 1, 30, 29, PAL.shelfFrame);
  img.outline(1, 1, 30, 29, PAL.shelfDark);
  img.hline(2, 29, 2, '#a87f55');
  const spines = ['#c9a23e', '#5a78b8', '#8a6acd', '#58a070', '#b85a50'];
  const glowShelf = frame === 0 ? 0 : 1;
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 4 + shelf * 9;
    img.rect(3, y, 26, 7, PAL.shelfDark);
    img.hline(2, 29, y + 7, PAL.shelfBoard);
    for (let i = 0; i < 8; i++) {
      const x = 4 + i * 3;
      let color = spines[(i + shelf * 2) % spines.length];
      const glowing = shelf === glowShelf && i === 6;
      if (glowing) color = PAL.gold;
      img.rect(x, y + 1, 3, 6, color);
      img.px(x, y + 1, '#00000033');
      if (glowing) img.px(x + 1, y, '#ffe9b3');
    }
  }
  img.rect(2, 30, 4, 2, PAL.shelfDark);
  img.rect(26, 30, 4, 2, PAL.shelfDark);
  return upscale(img, 2);
}

function serverRack(frame) {
  const img = new Img(28, 44);
  img.rect(2, 0, 24, 42, PAL.rackBody);
  img.outline(2, 0, 24, 42, PAL.rackDark);
  img.hline(3, 24, 1, '#3c4250');
  for (let unit = 0; unit < 5; unit++) {
    const y = 3 + unit * 8;
    img.rect(4, y, 20, 6, PAL.rackPanel);
    img.hline(4, 23, y + 5, PAL.rackDark);
    const phase = (unit + frame) % 2 === 0;
    img.rect(6, y + 2, 2, 2, phase ? PAL.cyan : PAL.cyanDim);
    img.rect(10, y + 2, 2, 2, phase ? PAL.greenDim : PAL.green);
    if (unit === 2) img.rect(14, y + 2, 2, 2, PAL.amber);
    for (let vx = 18; vx <= 22; vx += 2) img.vline(vx, y + 1, y + 4, PAL.rackDark);
  }
  img.rect(4, 42, 4, 2, PAL.rackDark);
  img.rect(20, 42, 4, 2, PAL.rackDark);
  return upscale(img, 2);
}

function bossConsole(frame) {
  const img = new Img(64, 20);
  // wide command desk — tall enough that the monitors sit ON it
  img.rect(2, 6, 60, 9, PAL.consoleTop);
  img.hline(3, 60, 6, PAL.consoleTopHi);
  img.rect(2, 15, 60, 3, PAL.consoleFace);
  img.hline(2, 61, 14, PAL.gold);
  img.outline(2, 6, 60, 12, '#2b2448');
  img.rect(6, 18, 4, 2, PAL.consoleLeg);
  img.rect(54, 18, 4, 2, PAL.consoleLeg);
  // three monitors facing the Boss (south), one glyph each
  const screen = (x, y, w, h) => {
    img.rect(x, y, w, h, PAL.bezelDark);
    img.outline(x, y, w, h, '#10131c');
    img.rect(x + 1, y + 1, w - 2, h - 2, '#0d0a20');
  };
  screen(7, 1, 14, 8);
  screen(25, 0, 14, 9);
  screen(43, 1, 14, 8);
  // left: cyan task lines
  img.hline(10, 17, 3, frame === 0 ? PAL.cyan : PAL.cyanDim);
  img.hline(10, 14, 6, PAL.cyanDim);
  // center: violet node triangle
  img.px(31, 2, frame === 0 ? PAL.violet : PAL.violetDim);
  img.px(28, 6, PAL.violetDim);
  img.px(34, 6, frame === 0 ? PAL.violetDim : PAL.violet);
  img.line(28, 6, 31, 2, '#46356e');
  img.line(31, 2, 34, 6, '#46356e');
  // right: gold bars
  img.rect(46, 5, 2, 3, PAL.goldDim);
  img.rect(49, 3, 2, 5, frame === 0 ? PAL.gold : PAL.goldDim);
  img.rect(52, 6, 2, 2, PAL.goldDim);
  return upscale(img, 2);
}

export const PROP_DEFS = [
  { name: 'wall-monitor', draw: wallMonitor, width: 96, height: 48 },
  { name: 'hypothesis-board', draw: hypothesisBoard, width: 96, height: 48 },
  { name: 'bot-status-monitor', draw: botStatusMonitor, width: 48, height: 64 },
  { name: 'archive-shelf', draw: archiveShelf, width: 64, height: 64 },
  { name: 'server-rack', draw: serverRack, width: 56, height: 88 },
  { name: 'boss-console', draw: bossConsole, width: 128, height: 40 },
];
