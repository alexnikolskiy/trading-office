/**
 * CityBackdrop — the atmospheric layers of the city: a banded sky, a pixel
 * sun/moon with rays, drifting varied clouds, stars + birds, and three
 * parallax skyline tiers whose buildings carry real detail (shaded faces, lit
 * windows, parapets, rooftop water-towers / antennas / billboards, neon signs).
 *
 * The drawing helpers return SVG groups so they embed both in a standalone
 * backdrop <svg> (behind the office) and inside the landing's CityScene <svg>.
 */
import { type CSSProperties } from 'react';
import {
  buildClouds,
  buildSkyline,
  buildStars,
  makeRng,
  PALETTES,
  ri,
  type Building,
  type CityPalette,
  type Cloud,
  type Material,
  type Mood,
} from './cityArt';

export const SCENE_W = 480;
export const SCENE_H = 270;
export const GROUND_Y = 222;

/* ---------------------------------------------------------------- helpers */

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function discRows(cx: number, cy: number, rad: number, fill: string, k: string) {
  const rows = [];
  for (let dy = -rad; dy <= rad; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, rad * rad - dy * dy)));
    if (half <= 0) continue;
    rows.push(<rect key={`${k}${dy}`} x={cx - half} y={cy + dy} width={half * 2} height={1} fill={fill} />);
  }
  return rows;
}

/* ------------------------------------------------------------- sky + orb */

export function SkyLayer({ mood }: { mood: Mood }) {
  const pal = PALETTES[mood];
  const stops = [pal.skyTop, pal.skyHi, pal.skyMid, pal.skyLow, pal.skyHaze];
  const bands = 16;
  const rects = [];
  for (let i = 0; i < bands; i++) {
    const t = (i / (bands - 1)) * (stops.length - 1);
    const lo = Math.min(Math.floor(t), stops.length - 2);
    const color = lerpHex(stops[lo]!, stops[lo + 1]!, t - lo);
    const y = Math.round((SCENE_H * i) / bands);
    const y2 = Math.round((SCENE_H * (i + 1)) / bands);
    rects.push(<rect key={`band${i}`} x={0} y={y} width={SCENE_W} height={y2 - y} fill={color} />);
  }
  return <g aria-hidden="true">{rects}</g>;
}

export function OrbLayer({ mood }: { mood: Mood }) {
  const pal = PALETTES[mood];
  const cx = 70;
  const cy = 50;
  const rays = [];
  if (mood === 'day') {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const x1 = Math.round(cx + Math.cos(ang) * 22);
      const y1 = Math.round(cy + Math.sin(ang) * 22);
      rays.push(<rect key={`ray${a}`} x={x1 - 1} y={y1 - 1} width={3} height={3} fill={pal.orbRay} opacity={0.7} />);
    }
  }
  return (
    <g aria-hidden="true">
      {rays}
      {discRows(cx, cy, 22, pal.orbRay, 'glow')}
      {discRows(cx, cy, 15, pal.orb, 'orb')}
      {discRows(cx, cy, 11, pal.orbCore, 'core')}
      {mood === 'night' && (
        <>
          <rect x={cx - 5} y={cy - 4} width={4} height={4} fill={pal.orbRay} />
          <rect x={cx + 3} y={cy + 2} width={3} height={3} fill={pal.orbRay} />
          <rect x={cx - 1} y={cy + 5} width={2} height={2} fill={pal.orbRay} />
        </>
      )}
    </g>
  );
}

export function StarLayer({ mood, seed = 7 }: { mood: Mood; seed?: number }) {
  if (mood !== 'night') return null;
  const pal = PALETTES[mood];
  const stars = buildStars(seed, SCENE_W, GROUND_Y - 60, 90);
  return (
    <g aria-hidden="true">
      {stars.map((s, i) => (
        <rect
          key={`s${i}`}
          className="city-star"
          x={s.x}
          y={s.y}
          width={s.big ? 2 : 1}
          height={s.big ? 2 : 1}
          fill={pal.star}
          style={{ animationDelay: `${s.phase * 0.4}s` } as CSSProperties}
        />
      ))}
    </g>
  );
}

export function BirdLayer({ mood, seed = 31 }: { mood: Mood; seed?: number }) {
  const pal = PALETTES[mood];
  const r = makeRng(seed);
  const birds = [];
  const n = mood === 'day' ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const x = ri(r, 120, 430);
    const y = ri(r, 24, 70);
    birds.push(
      <g key={`b${i}`}>
        <rect x={x} y={y} width={2} height={1} fill={pal.bird} />
        <rect x={x + 2} y={y - 1} width={2} height={1} fill={pal.bird} />
        <rect x={x + 4} y={y} width={2} height={1} fill={pal.bird} />
      </g>,
    );
  }
  return <g aria-hidden="true">{birds}</g>;
}

/* ---------------------------------------------------------------- clouds */

function CloudShape({ c, pal }: { c: Cloud; pal: CityPalette }) {
  const u = c.u;
  const parts: Array<[number, number, number, number]> = [];
  if (c.kind === 'long') {
    parts.push([0, u, 11 * u, 2 * u], [2 * u, 0, 3 * u, u], [6 * u, 0, 3 * u, u]);
  } else if (c.kind === 'small') {
    parts.push([0, u, 5 * u, u], [u, 0, 2 * u, u], [2 * u, 0, 2 * u, u]);
  } else {
    parts.push([0, u, 8 * u, 2 * u], [u, 0, 3 * u, 2 * u], [4 * u, 0, 3 * u, u], [3 * u, -u, 2 * u, u]);
  }
  const w = Math.max(...parts.map((p) => p[0] + p[2]));
  const bottom = Math.max(...parts.map((p) => p[1] + p[3]));
  return (
    <g transform={`translate(${c.x} ${c.y})`}>
      <g className="city-cloud" style={{ animationDuration: `${c.speed}s` } as CSSProperties}>
        {parts.map((p, i) => (
          <rect key={`cp${i}`} x={p[0]} y={p[1]} width={p[2]} height={p[3]} fill={pal.cloud} />
        ))}
        <rect x={0} y={bottom - 1} width={w} height={1} fill={pal.cloudShade} />
        <rect x={u} y={parts[0]![1] - 0} width={Math.round(w * 0.5)} height={1} fill={pal.cloudHi} />
      </g>
    </g>
  );
}

export function CloudLayer({ mood, seed = 3, count = 6 }: { mood: Mood; seed?: number; count?: number }) {
  const pal = PALETTES[mood];
  const clouds = buildClouds(seed, SCENE_W, count);
  return (
    <g aria-hidden="true">
      {clouds.map((c, i) => (
        <CloudShape key={`c${i}`} c={c} pal={pal} />
      ))}
    </g>
  );
}

/* --------------------------------------------------------------- buildings */

function windows(b: Building, pal: CityPalette) {
  const r = makeRng(b.seed);
  const style = b.seed % 2;
  const cw = style === 0 ? 3 : 2;
  const ch = style === 0 ? 3 : 5;
  const gx = 3;
  const gy = 4;
  const els = [];
  let i = 0;
  for (let y = b.y + 6; y < b.y + b.h - 4; y += ch + gy) {
    for (let x = b.x + 4; x <= b.x + b.w - 4 - cw; x += cw + gx) {
      const roll = r();
      const fill = !b.lit
        ? roll > 0.5
          ? pal.winDark
          : pal.winCool
        : roll > 0.72
          ? pal.winWarm
          : roll > 0.5
            ? pal.winLit
            : roll > 0.3
              ? pal.winCool
              : pal.winDark;
      els.push(<rect key={`w${i}`} x={x} y={y} width={cw} height={ch} fill={fill} />);
      i++;
    }
  }
  return els;
}

function roofDetails(b: Building, pal: CityPalette, mat: Material) {
  const cx = b.x + Math.floor(b.w / 2);
  const els = [];
  switch (b.roof) {
    case 'step':
      els.push(<rect key="s1" x={cx - Math.floor(b.w * 0.3)} y={b.y - 6} width={Math.floor(b.w * 0.6)} height={6} fill={mat.face} />);
      els.push(<rect key="s2" x={cx - Math.floor(b.w * 0.3)} y={b.y - 6} width={Math.floor(b.w * 0.6)} height={1} fill={mat.hi} />);
      break;
    case 'penthouse':
      els.push(<rect key="p1" x={cx - 5} y={b.y - 8} width={10} height={8} fill={mat.face} />);
      els.push(<rect key="p2" x={cx - 5} y={b.y - 8} width={10} height={1} fill={mat.hi} />);
      els.push(<rect key="p3" x={cx - 3} y={b.y - 6} width={6} height={3} fill={pal.winWarm} />);
      break;
    case 'water':
      els.push(<rect key="wl1" x={cx - 5} y={b.y - 3} width={2} height={3} fill={pal.trunk} />);
      els.push(<rect key="wl2" x={cx + 3} y={b.y - 3} width={2} height={3} fill={pal.trunk} />);
      els.push(<rect key="wt" x={cx - 6} y={b.y - 11} width={12} height={8} fill={pal.trunk} />);
      els.push(<rect key="wtc" x={cx - 6} y={b.y - 12} width={12} height={2} fill={mat.shade} />);
      break;
    case 'antenna':
      els.push(<rect key="am" x={cx} y={b.y - 14} width={1} height={14} fill={mat.shade} />);
      els.push(<rect key="ab" className="city-beacon" x={cx - 1} y={b.y - 15} width={3} height={3} fill={pal.beacon} />);
      break;
    case 'billboard': {
      const c = pal.neon[b.sign >= 0 ? b.sign : 2]!;
      els.push(<rect key="bl" x={cx - 9} y={b.y - 1} width={2} height={1} fill={mat.shade} />);
      els.push(<rect key="bf" x={cx - 10} y={b.y - 12} width={20} height={11} fill={pal.signFrame} />);
      els.push(<rect key="bp" x={cx - 8} y={b.y - 10} width={16} height={7} fill={c} opacity={0.92} />);
      break;
    }
    case 'parapet':
      els.push(<rect key="pv1" x={b.x + 3} y={b.y - 2} width={2} height={2} fill={mat.shade} />);
      els.push(<rect key="pv2" x={b.x + b.w - 5} y={b.y - 2} width={2} height={2} fill={mat.shade} />);
      break;
    default:
      break;
  }
  return els;
}

function renderBuilding(b: Building, pal: CityPalette, flat: string | null, i: number) {
  const els = [];
  if (flat) {
    els.push(<rect key="f" x={b.x} y={b.y} width={b.w} height={b.h} fill={flat} />);
    els.push(<rect key="hi" x={b.x} y={b.y} width={b.w} height={1} fill={lerpHex(flat, '#ffffff', 0.12)} />);
    // a few faint window dots for depth
    const r = makeRng(b.seed);
    for (let k = 0; k < Math.floor(b.w / 6); k++) {
      if (r() > 0.7) {
        els.push(<rect key={`d${k}`} x={b.x + ri(r, 2, b.w - 3)} y={b.y + ri(r, 4, b.h - 4)} width={1} height={2} fill={lerpHex(flat, pal.winLit, 0.5)} />);
      }
    }
    return <g key={`b${i}`}>{els}</g>;
  }
  const mat = pal.buildings[b.mat] ?? pal.buildings[0]!;
  els.push(<rect key="face" x={b.x} y={b.y} width={b.w} height={b.h} fill={mat.face} />);
  els.push(<rect key="hi" x={b.x} y={b.y} width={2} height={b.h} fill={mat.hi} />);
  els.push(<rect key="sh" x={b.x + b.w - 2} y={b.y} width={2} height={b.h} fill={mat.shade} />);
  els.push(<rect key="cap" x={b.x} y={b.y} width={b.w} height={2} fill={mat.hi} />);
  els.push(<rect key="cap2" x={b.x} y={b.y + 2} width={b.w} height={1} fill={mat.shade} />);
  els.push(...windows(b, pal));
  els.push(...roofDetails(b, pal, mat));
  if (b.sign >= 0 && b.roof !== 'billboard') {
    const c = pal.neon[b.sign]!;
    const sx = b.x + (b.seed % 2 === 0 ? 2 : b.w - 5);
    els.push(<rect key="sgn" x={sx} y={b.y + 10} width={3} height={Math.min(20, b.h - 16)} fill={pal.signFrame} />);
    els.push(<rect key="sgn2" x={sx + 1} y={b.y + 11} width={1} height={Math.min(18, b.h - 18)} fill={c} />);
  }
  return <g key={`b${i}`}>{els}</g>;
}

export function SkylineLayer({ mood, seed, layer }: { mood: Mood; seed: number; layer: 'far3' | 'far2' | 'far1' | 'blocks' }) {
  const pal = PALETTES[mood];
  let buildings: Building[];
  let flat: string | null = null;
  if (layer === 'far3') {
    flat = pal.far3;
    buildings = buildSkyline(seed, SCENE_W, GROUND_Y - 18, 1, { minW: 16, maxW: 30, minH: 34, maxH: 72, lit: false, detail: false, gap: 0 });
  } else if (layer === 'far2') {
    flat = pal.far2;
    buildings = buildSkyline(seed, SCENE_W, GROUND_Y - 10, 1, { minW: 18, maxW: 34, minH: 44, maxH: 96, lit: false, detail: false, gap: 1 });
  } else if (layer === 'far1') {
    flat = pal.far1;
    buildings = buildSkyline(seed, SCENE_W, GROUND_Y - 4, 1, { minW: 20, maxW: 38, minH: 56, maxH: 116, lit: true, detail: false, gap: 1 });
  } else {
    buildings = buildSkyline(seed, SCENE_W, GROUND_Y, pal.buildings.length, { minW: 26, maxW: 52, minH: 64, maxH: 140, lit: true, detail: true, gap: 2 });
  }
  return <g aria-hidden="true">{buildings.map((b, i) => renderBuilding(b, pal, flat, i))}</g>;
}

/* ----------------------------------------------- standalone dim backdrop */

export function CityBackdrop({ mood, seed = 11, className }: { mood: Mood; seed?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <SkyLayer mood={mood} />
      <StarLayer mood={mood} seed={seed + 1} />
      <OrbLayer mood={mood} />
      <BirdLayer mood={mood} seed={seed + 4} />
      <CloudLayer mood={mood} seed={seed + 2} count={6} />
      <SkylineLayer mood={mood} seed={seed} layer="far3" />
      <SkylineLayer mood={mood} seed={seed + 5} layer="far2" />
      <SkylineLayer mood={mood} seed={seed + 9} layer="far1" />
      <SkylineLayer mood={mood} seed={seed + 13} layer="blocks" />
    </svg>
  );
}
