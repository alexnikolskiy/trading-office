import { Img } from './img.mjs';
import { PAL } from './palette.mjs';

/**
 * Interactive object sprites ("props"), each with 2 animation frames so the
 * floor feels alive: blinking LEDs, drifting charts, glowing folders.
 * Sized for the 32px-tile floor; furniture colors match the day tileset and
 * darken naturally under the night ambient overlay.
 */

function wallMonitor(frame) {
  const img = new Img(96, 48);
  img.rect(0, 0, 96, 48, PAL.bezelDark);
  img.outline(0, 0, 96, 48, '#10131c');
  img.hline(1, 94, 1, PAL.bezelHi);
  img.rect(4, 4, 88, 40, PAL.screenDeep);
  // header bars
  img.rect(8, 7, 20, 4, frame === 0 ? PAL.screenBar : PAL.screenBarDim);
  img.rect(32, 7, 12, 4, PAL.screenBarDim);
  img.rect(76, 7, 12, 4, frame === 0 ? PAL.greenDim : PAL.green);
  // grid lines
  for (const y of [18, 26, 34]) img.hline(8, 88, y, '#152238');
  // equity curve
  const pts = [
    [8, 36],
    [16, 32],
    [24, 34],
    [32, 28],
    [40, 30],
    [48, 24],
    [56, 26],
    [64, 20],
    [72, 22],
    [80, 18],
    [87, 16],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    img.line(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, PAL.cyanDark);
    img.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], PAL.cyan);
  }
  if (frame === 1) img.rect(87, 15, 2, 2, '#d4fff2');
  // candle ticks along the bottom
  const candles = [
    [10, 4, PAL.greenDim],
    [20, 2, PAL.redDim],
    [30, 4, PAL.greenDim],
    [40, 6, PAL.greenDim],
    [50, 2, PAL.redDim],
    [60, 4, PAL.greenDim],
    [70, 5, PAL.greenDim],
    [80, 2, PAL.redDim],
  ];
  for (const [x, h, color] of candles) img.rect(x, 42 - h, 3, h, color);
  // wall mount
  img.rect(44, 46, 8, 2, '#10131c');
  return img;
}

function hypothesisBoard(frame) {
  const img = new Img(96, 48);
  // wooden frame around a dark board
  img.rect(0, 0, 96, 48, PAL.frame);
  img.outline(0, 0, 96, 48, PAL.frameDark);
  img.rect(3, 3, 90, 42, '#26303f');
  // column headers: draft / validated / built / live
  const headers = [PAL.paperLine, PAL.blue, PAL.amber, PAL.green];
  headers.forEach((color, i) => {
    img.rect(7 + i * 22, 6, 16, 4, color);
  });
  for (let i = 1; i < 4; i++) img.vline(5 + i * 22, 5, 43, '#34404f');
  // cards per column
  const card = (col, row, color) => {
    const x = 7 + col * 22;
    const y = 13 + row * 10;
    img.rect(x, y, 16, 7, color);
    img.hline(x, x + 15, y + 6, '#00000055');
    img.hline(x + 2, x + 12, y + 2, '#00000033');
  };
  card(0, 0, PAL.paperShade);
  card(0, 1, PAL.paper);
  card(0, 2, PAL.paperShade);
  card(1, frame === 0 ? 0 : 1, PAL.blueHi);
  card(1, 2, '#5a8fd0');
  card(2, 0, PAL.gold);
  card(2, 1, '#e0a23e');
  card(3, 0, PAL.green);
  card(3, 2, PAL.red);
  if (frame === 1) img.outline(28, 12 + 10, 20, 9, PAL.cyan);
  return img;
}

function botStatusMonitor(frame) {
  const img = new Img(48, 64);
  // stand
  img.rect(20, 48, 8, 10, PAL.steelPanel);
  img.rect(10, 58, 28, 4, '#2b303c');
  img.hline(11, 36, 58, PAL.bezelHi);
  // panel
  img.rect(0, 0, 48, 48, PAL.bezelDark);
  img.outline(0, 0, 48, 48, '#10131c');
  img.rect(4, 4, 40, 40, PAL.screenDeep);
  img.rect(6, 6, 20, 4, PAL.screenBar);
  // heartbeat line
  const off = frame === 0 ? 0 : 4;
  img.line(14 + off, 11, 18 + off, 9, PAL.green);
  img.line(18 + off, 9, 20 + off, 12, PAL.green);
  img.px(21 + off, 11, PAL.greenDim);
  // status rows: dot + bar
  const rows = [
    [15, PAL.green, true],
    [22, PAL.green, true],
    [29, PAL.amber, true],
    [36, PAL.red, frame === 0],
  ];
  for (const [y, color, lit] of rows) {
    img.rect(6, y, 4, 4, lit ? color : '#3a2a2a');
    img.rect(13, y, 26, 4, PAL.screenBarDim);
    img.rect(13, y, lit ? 18 : 8, 4, '#2f4260');
  }
  return img;
}

function archiveShelf(frame) {
  const img = new Img(64, 64);
  img.rect(2, 2, 60, 58, PAL.shelfFrame);
  img.outline(2, 2, 60, 58, PAL.shelfDark);
  img.hline(3, 60, 3, '#a87f55');
  const spines = ['#c9a23e', '#5a78b8', '#8a6acd', '#58a070', '#b85a50', '#5a78b8'];
  const glowShelf = frame === 0 ? 0 : 2;
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 7 + shelf * 18;
    img.rect(5, y, 54, 14, PAL.shelfDark);
    img.hline(4, 59, y + 14, PAL.shelfBoard);
    img.hline(4, 59, y + 15, PAL.shelfDark);
    for (let i = 0; i < 7; i++) {
      const x = 7 + i * 8;
      let color = spines[(i + shelf * 2) % spines.length];
      const glowing = shelf === glowShelf && i === 5;
      if (glowing) color = PAL.gold;
      img.rect(x, y + 2, 6, 12, color);
      img.px(x, y + 2, '#00000033');
      img.hline(x + 1, x + 4, y + 5, '#00000033');
      if (glowing) {
        img.rect(x + 2, y, 2, 2, '#ffe9b3');
        img.rect(x - 1, y + 2, 1, 12, '#caa54b66');
        img.rect(x + 6, y + 2, 1, 12, '#caa54b66');
      }
    }
  }
  img.rect(5, 60, 6, 4, PAL.shelfDark);
  img.rect(53, 60, 6, 4, PAL.shelfDark);
  return img;
}

function serverRack(frame) {
  const img = new Img(64, 88);
  img.rect(4, 0, 56, 84, PAL.rackBody);
  img.outline(4, 0, 56, 84, PAL.rackDark);
  img.hline(5, 58, 1, '#3c4250');
  for (let unit = 0; unit < 6; unit++) {
    const y = 4 + unit * 13;
    img.rect(8, y, 48, 10, PAL.rackPanel);
    img.hline(8, 55, y + 9, PAL.rackDark);
    img.hline(8, 55, y, '#3c4250');
    // LED column
    const phase = (unit + frame) % 2 === 0;
    img.rect(12, y + 4, 2, 2, phase ? PAL.cyan : PAL.cyanDim);
    img.rect(18, y + 4, 2, 2, phase ? PAL.greenDim : PAL.green);
    img.rect(24, y + 4, 2, 2, unit === 3 ? PAL.amber : '#3a414e');
    // vents
    for (let vx = 32; vx <= 50; vx += 4) img.vline(vx, y + 2, y + 7, PAL.rackDark);
  }
  img.rect(8, 84, 8, 4, PAL.rackDark);
  img.rect(48, 84, 8, 4, PAL.rackDark);
  return img;
}

function bossConsole(frame) {
  const img = new Img(144, 72);
  // desk body
  img.rect(4, 28, 136, 24, PAL.consoleTop);
  img.hline(4, 139, 28, PAL.consoleTopHi);
  img.hline(4, 139, 29, PAL.consoleTopHi);
  img.rect(4, 52, 136, 12, PAL.consoleFace);
  img.hline(4, 139, 51, PAL.gold);
  img.px(4, 51, '#ffe9b3');
  img.px(139, 51, '#ffe9b3');
  img.outline(4, 28, 136, 36, '#2b2448');
  // legs
  img.rect(12, 64, 10, 8, PAL.consoleLeg);
  img.rect(122, 64, 10, 8, PAL.consoleLeg);
  // three screens
  const screen = (x, y, w, h) => {
    img.rect(x, y, w, h, PAL.bezelDark);
    img.outline(x, y, w, h, '#10131c');
    img.rect(x + 2, y + 2, w - 4, h - 4, '#0d0a20');
    img.rect(x + Math.floor(w / 2) - 2, y + h, 4, 2, PAL.bezelDark);
  };
  screen(16, 8, 32, 22);
  screen(56, 2, 32, 28);
  screen(96, 8, 32, 22);
  // left screen: cyan task list
  img.hline(20, 40, 13, PAL.cyanDim);
  img.hline(20, 34, 17, frame === 0 ? PAL.cyan : PAL.cyanDim);
  img.hline(20, 38, 21, PAL.cyanDim);
  img.hline(20, 30, 25, frame === 0 ? PAL.cyanDim : PAL.cyan);
  // center screen: routing graph (violet nodes)
  const nodes = [
    [62, 10],
    [72, 6],
    [82, 12],
    [66, 20],
    [78, 22],
  ];
  img.line(62, 10, 72, 6, PAL.violetDim);
  img.line(72, 6, 82, 12, PAL.violetDim);
  img.line(66, 20, 72, 6, PAL.violetDim);
  img.line(78, 22, 82, 12, PAL.violetDim);
  nodes.forEach(([x, y], i) => {
    const hot = (i + frame) % 2 === 0;
    img.rect(x, y, 2, 2, hot ? PAL.violet : PAL.violetDim);
    if (hot) img.px(x + 2, y, '#c9aaff');
  });
  // right screen: gold bars
  const bars = [6, 10, 4, 12, 8];
  bars.forEach((h, i) => {
    img.rect(102 + i * 5, 26 - h, 3, h, PAL.goldDim);
    img.hline(102 + i * 5, 104 + i * 5, 26 - h, frame === 0 && i === 3 ? '#ffe9b3' : PAL.gold);
  });
  // console deck details
  img.rect(20, 34, 22, 6, PAL.steelPanel);
  img.px(24, 36, PAL.cyan);
  img.px(30, 36, PAL.amber);
  img.px(36, 36, PAL.green);
  img.rect(58, 34, 28, 8, PAL.steelPanel);
  img.rect(62, 36, 20, 4, frame === 0 ? '#241c4a' : '#2e2460');
  img.px(70, 38, PAL.violet);
  img.rect(100, 34, 22, 6, PAL.steelPanel);
  img.px(104, 36, PAL.gold);
  img.px(110, 36, frame === 0 ? PAL.green : PAL.greenDim);
  return img;
}

function holoTable(frame) {
  const img = new Img(96, 64);
  // table
  img.rect(8, 32, 80, 16, PAL.holoTable);
  img.outline(8, 32, 80, 16, PAL.holoRim);
  img.hline(9, 86, 33, '#67768f');
  img.rect(14, 48, 8, 10, PAL.holoLeg);
  img.rect(74, 48, 8, 10, PAL.holoLeg);
  img.rect(40, 48, 16, 8, PAL.holoLeg);
  img.hline(14, 81, 58, '#222a38');
  // hologram beam
  for (let y = 8; y < 32; y++) {
    img.px(46, y, '#2c8a7644');
    img.px(47, y, '#2c8a7644');
    img.px(48, y, '#2c8a7644');
  }
  // floating chart
  const off = frame === 0 ? 0 : 2;
  const pts = [
    [28, 22],
    [36, 18],
    [44, 20],
    [52, 14],
    [60, 16],
    [68, 10],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    img.line(pts[i][0], pts[i][1] - off, pts[i + 1][0], pts[i + 1][1] - off, '#59f7d4aa');
  }
  img.rect(68, 9 - off, 2, 2, '#d4fff2');
  img.hline(28, 68, 26, '#2c8a7666');
  img.px(32, 26, '#59f7d488');
  img.px(56, 26, '#59f7d488');
  // glowing rim pads
  img.rect(24, 34, 4, 2, frame === 0 ? PAL.cyan : PAL.cyanDim);
  img.rect(68, 34, 4, 2, frame === 0 ? PAL.cyanDim : PAL.cyan);
  return img;
}

export const PROP_DEFS = [
  { name: 'wall-monitor', draw: wallMonitor, width: 96, height: 48 },
  { name: 'hypothesis-board', draw: hypothesisBoard, width: 96, height: 48 },
  { name: 'bot-status-monitor', draw: botStatusMonitor, width: 48, height: 64 },
  { name: 'archive-shelf', draw: archiveShelf, width: 64, height: 64 },
  { name: 'server-rack', draw: serverRack, width: 64, height: 88 },
  { name: 'boss-console', draw: bossConsole, width: 144, height: 72 },
  { name: 'holo-table', draw: holoTable, width: 96, height: 64 },
];
