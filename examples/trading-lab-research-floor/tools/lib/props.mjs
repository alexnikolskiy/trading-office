import { Img } from './img.mjs';
import { PAL } from './palette.mjs';

/**
 * Interactive object sprites ("props"), each with 2 animation frames so the
 * floor feels alive: blinking LEDs, drifting charts, glowing folders.
 */

function wallMonitor(frame) {
  const img = new Img(48, 24);
  img.rect(0, 0, 48, 24, PAL.bezelDark);
  img.outline(0, 0, 48, 24, '#0b0d14');
  img.rect(2, 2, 44, 20, PAL.screenDeep);
  // header bars
  img.rect(4, 4, 10, 2, frame === 0 ? PAL.screenBar : PAL.screenBarDim);
  img.rect(16, 4, 6, 2, PAL.screenBarDim);
  img.rect(38, 4, 6, 2, frame === 0 ? PAL.greenDim : PAL.green);
  // equity curve
  const pts = [
    [4, 18],
    [8, 16],
    [12, 17],
    [16, 14],
    [20, 15],
    [24, 12],
    [28, 13],
    [32, 10],
    [36, 11],
    [40, 9],
    [43, 8],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    img.line(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, PAL.cyanDark);
    img.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], PAL.cyan);
  }
  if (frame === 1) img.px(44, 7, '#d4fff2');
  // candle ticks
  const candles = [
    [6, 2, PAL.greenDim],
    [11, 1, PAL.redDim],
    [16, 2, PAL.greenDim],
    [21, 3, PAL.greenDim],
    [26, 1, PAL.redDim],
    [31, 2, PAL.greenDim],
    [36, 2, PAL.greenDim],
    [41, 1, PAL.redDim],
  ];
  for (const [x, h, color] of candles) img.rect(x, 21 - h, 2, h, color);
  return img;
}

function hypothesisBoard(frame) {
  const img = new Img(48, 24);
  img.rect(0, 0, 48, 24, '#1b2434');
  img.outline(0, 0, 48, 24, '#3d4a63');
  // column headers: draft / validated / built / live
  const headers = [PAL.paperLine, PAL.blue, PAL.amber, PAL.green];
  headers.forEach((color, i) => img.rect(3 + i * 11, 2, 8, 2, color));
  // cards per column
  const card = (x, y, color) => {
    img.rect(x, y, 8, 4, color);
    img.hline(x, x + 7, y + 3, '#00000055');
  };
  card(3, 6, PAL.paperShade);
  card(3, 11, PAL.paper);
  card(3, 16, PAL.paperShade);
  card(14, frame === 0 ? 6 : 11, PAL.blueHi);
  card(14, 16, '#5a8fd0');
  card(25, 6, PAL.gold);
  card(25, 11, '#e0a23e');
  card(36, 6, PAL.green);
  card(36, 16, PAL.red);
  if (frame === 1) img.outline(13, 10, 10, 6, PAL.cyan);
  return img;
}

function botStatusMonitor(frame) {
  const img = new Img(24, 32);
  // stand
  img.rect(10, 24, 4, 5, PAL.steelPanel);
  img.rect(5, 29, 14, 2, PAL.wallBase);
  // panel
  img.rect(0, 0, 24, 24, PAL.bezelDark);
  img.outline(0, 0, 24, 24, '#0b0d14');
  img.rect(2, 2, 20, 20, PAL.screenDeep);
  img.rect(3, 3, 10, 2, PAL.screenBar);
  // status rows: dot + bar
  const rows = [
    [7, PAL.green, true],
    [11, PAL.green, true],
    [15, PAL.amber, true],
    [19, PAL.red, frame === 0],
  ];
  for (const [y, color, lit] of rows) {
    img.rect(3, y, 2, 2, lit ? color : '#3a2a2a');
    img.rect(7, y, 13, 2, PAL.screenBarDim);
  }
  // tiny heartbeat
  const off = frame === 0 ? 0 : 2;
  img.line(7 + off, 5, 9 + off, 4, PAL.green);
  img.px(10 + off, 5, PAL.greenDim);
  return img;
}

function archiveShelf(frame) {
  const img = new Img(32, 32);
  img.rect(1, 2, 30, 28, PAL.shelfFrame);
  img.outline(1, 2, 30, 28, PAL.shelfDark);
  img.hline(1, 30, 3, '#6a4c34');
  const spines = ['#c9a23e', '#5a78b8', '#a06bff', '#2f8a5e', '#a04848', '#5a78b8'];
  const glowShelf = frame === 0 ? 0 : 2;
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 5 + shelf * 9;
    img.hline(2, 29, y + 7, PAL.shelfDark);
    for (let i = 0; i < 6; i++) {
      const x = 3 + i * 4;
      let color = spines[(i + shelf * 2) % spines.length];
      const glowing = shelf === glowShelf && i === 4;
      if (glowing) color = PAL.gold;
      img.rect(x, y, 3, 7, color);
      img.px(x, y, '#00000033');
      if (glowing) {
        img.px(x + 1, y - 1, '#ffe9b3');
        img.rect(x - 1, y, 1, 7, '#8a6f3a55');
        img.rect(x + 3, y, 1, 7, '#8a6f3a55');
      }
    }
  }
  img.rect(3, 30, 3, 2, PAL.shelfDark);
  img.rect(26, 30, 3, 2, PAL.shelfDark);
  return img;
}

function serverRack(frame) {
  const img = new Img(32, 44);
  img.rect(2, 0, 28, 42, PAL.rackBody);
  img.outline(2, 0, 28, 42, PAL.rackDark);
  for (let unit = 0; unit < 6; unit++) {
    const y = 2 + unit * 6.5;
    img.rect(4, y, 24, 5, PAL.rackPanel);
    img.hline(4, 27, y + 4, '#10141c');
    // LED column
    const phase = (unit + frame) % 2 === 0;
    img.px(6, y + 2, phase ? PAL.cyan : PAL.cyanDim);
    img.px(9, y + 2, phase ? PAL.greenDim : PAL.green);
    img.px(12, y + 2, unit === 3 ? PAL.amber : '#2a3142');
    // vents
    for (let vx = 16; vx <= 25; vx += 2) img.vline(vx, y + 1, y + 3, '#10141c');
  }
  img.rect(4, 42, 4, 2, PAL.rackDark);
  img.rect(24, 42, 4, 2, PAL.rackDark);
  return img;
}

function bossConsole(frame) {
  const img = new Img(72, 36);
  // desk body
  img.rect(2, 14, 68, 12, PAL.consoleTop);
  img.hline(2, 69, 14, PAL.consoleTopHi);
  img.rect(2, 26, 68, 6, PAL.consoleFace);
  img.hline(2, 69, 25, PAL.gold);
  img.px(2, 25, '#ffe9b3');
  img.px(69, 25, '#ffe9b3');
  img.outline(2, 14, 68, 18, '#181430');
  // legs
  img.rect(6, 32, 5, 4, PAL.consoleLeg);
  img.rect(61, 32, 5, 4, PAL.consoleLeg);
  // three screens
  const screen = (x, y, w, h) => {
    img.rect(x, y, w, h, PAL.bezelDark);
    img.outline(x, y, w, h, '#0b0d14');
    img.rect(x + 1, y + 1, w - 2, h - 2, '#0d0a20');
  };
  screen(8, 4, 16, 11);
  screen(28, 1, 16, 14);
  screen(48, 4, 16, 11);
  // left screen: cyan task list
  img.hline(10, 20, 6, PAL.cyanDim);
  img.hline(10, 17, 8, frame === 0 ? PAL.cyan : PAL.cyanDim);
  img.hline(10, 19, 10, PAL.cyanDim);
  img.hline(10, 15, 12, frame === 0 ? PAL.cyanDim : PAL.cyan);
  // center screen: routing graph (violet nodes)
  const nodes = [
    [31, 5],
    [36, 3],
    [41, 6],
    [33, 10],
    [39, 11],
  ];
  img.line(31, 5, 36, 3, PAL.violetDim);
  img.line(36, 3, 41, 6, PAL.violetDim);
  img.line(33, 10, 36, 3, PAL.violetDim);
  img.line(39, 11, 41, 6, PAL.violetDim);
  nodes.forEach(([x, y], i) => {
    const hot = (i + frame) % 2 === 0;
    img.px(x, y, hot ? PAL.violet : PAL.violetDim);
    if (hot) img.px(x + 1, y, '#c9aaff');
  });
  // right screen: gold bars
  const bars = [3, 5, 2, 6, 4];
  bars.forEach((h, i) => {
    img.vline(51 + i * 3, 13 - h, 13, PAL.goldDim);
    img.px(51 + i * 3, 13 - h, frame === 0 && i === 3 ? '#ffe9b3' : PAL.gold);
  });
  // console deck details
  img.rect(12, 17, 10, 3, PAL.steelPanel);
  img.px(14, 18, PAL.cyan);
  img.px(17, 18, PAL.amber);
  img.rect(30, 17, 12, 4, PAL.steelPanel);
  img.rect(32, 18, 8, 2, frame === 0 ? '#1b1438' : '#241c4a');
  img.px(35, 19, PAL.violet);
  img.rect(50, 17, 10, 3, PAL.steelPanel);
  img.px(52, 18, PAL.gold);
  img.px(55, 18, frame === 0 ? PAL.green : PAL.greenDim);
  return img;
}

function holoTable(frame) {
  const img = new Img(48, 32);
  // table
  img.rect(4, 16, 40, 8, PAL.holoTable);
  img.outline(4, 16, 40, 8, PAL.holoRim);
  img.hline(5, 42, 17, '#37496a');
  img.rect(7, 24, 4, 5, PAL.holoLeg);
  img.rect(37, 24, 4, 5, PAL.holoLeg);
  img.rect(20, 24, 8, 4, PAL.holoLeg);
  // hologram beam
  for (let y = 4; y < 16; y++) {
    img.px(23, y, '#2c6b5e44');
    img.px(24, y, '#2c6b5e44');
  }
  // floating chart
  const off = frame === 0 ? 0 : 1;
  const pts = [
    [14, 11],
    [18, 9],
    [22, 10],
    [26, 7],
    [30, 8],
    [34, 5],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    img.line(pts[i][0], pts[i][1] - off, pts[i + 1][0], pts[i + 1][1] - off, '#59f7d4aa');
  }
  img.px(34, 5 - off, '#d4fff2');
  img.hline(14, 34, 13, '#2c6b5e66');
  img.px(16, 13, '#59f7d488');
  img.px(28, 13, '#59f7d488');
  return img;
}

export const PROP_DEFS = [
  { name: 'wall-monitor', draw: wallMonitor, width: 48, height: 24 },
  { name: 'hypothesis-board', draw: hypothesisBoard, width: 48, height: 24 },
  { name: 'bot-status-monitor', draw: botStatusMonitor, width: 24, height: 32 },
  { name: 'archive-shelf', draw: archiveShelf, width: 32, height: 32 },
  { name: 'server-rack', draw: serverRack, width: 32, height: 44 },
  { name: 'boss-console', draw: bossConsole, width: 72, height: 36 },
  { name: 'holo-table', draw: holoTable, width: 48, height: 32 },
];
