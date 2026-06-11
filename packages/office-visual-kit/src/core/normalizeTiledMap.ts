/**
 * Normalizes a raw Tiled JSON map (.tmj, orthogonal, finite) into a compact
 * structure the renderer understands. Supports CSV (`number[]`) and
 * uncompressed base64 tile data; embedded tilesets only (export with
 * "Embed tilesets" in Tiled — see docs/tiled-conventions.md).
 */

// ---------------------------------------------------------------------------
// Raw Tiled JSON shapes (the subset we read)
// ---------------------------------------------------------------------------

export interface TiledProperty {
  name: string;
  type?: string;
  value: string | number | boolean;
}

export interface TiledText {
  text: string;
  color?: string;
  pixelsize?: number;
  halign?: string;
  valign?: string;
}

export interface TiledObject {
  id: number;
  name: string;
  /** Object class. Tiled writes it as `type` in JSON. */
  type?: string;
  class?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  point?: boolean;
  ellipse?: boolean;
  gid?: number;
  visible?: boolean;
  text?: TiledText;
  properties?: TiledProperty[];
}

export interface TiledLayer {
  id?: number;
  name: string;
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  visible?: boolean;
  opacity?: number;
  offsetx?: number;
  offsety?: number;
  width?: number;
  height?: number;
  data?: number[] | string;
  encoding?: 'csv' | 'base64';
  compression?: string;
  objects?: TiledObject[];
  layers?: TiledLayer[];
  properties?: TiledProperty[];
}

export interface TiledTileset {
  firstgid: number;
  source?: string;
  name?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  tilewidth?: number;
  tileheight?: number;
  tilecount?: number;
  columns?: number;
  margin?: number;
  spacing?: number;
}

export interface TiledMapJson {
  type?: string;
  orientation: string;
  infinite?: boolean;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  backgroundcolor?: string;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

// ---------------------------------------------------------------------------
// Normalized shapes
// ---------------------------------------------------------------------------

export interface TileFlips {
  flipH: boolean;
  flipV: boolean;
  flipD: boolean;
}

export interface NormalizedTileLayer {
  name: string;
  width: number;
  height: number;
  /** Raw gids including flip bits; use `resolveGid` per cell. */
  gids: Uint32Array;
  opacity: number;
  visible: boolean;
  offsetX: number;
  offsetY: number;
}

export interface NormalizedObject {
  id: number;
  name: string;
  /** Tiled object class (`type` in JSON). */
  className: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  point: boolean;
  visible: boolean;
  text?: TiledText;
  properties: Record<string, string | number | boolean>;
}

export interface NormalizedObjectLayer {
  name: string;
  objects: NormalizedObject[];
}

export interface NormalizedTileset {
  firstGid: number;
  name: string;
  /** Image URL resolved against the map URL. */
  image: string;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  columns: number;
  margin: number;
  spacing: number;
}

export interface NormalizedTiledMap {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  backgroundColor?: string;
  tileLayers: NormalizedTileLayer[];
  objectLayers: NormalizedObjectLayer[];
  tilesets: NormalizedTileset[];
}

// ---------------------------------------------------------------------------

const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const GID_MASK = 0x1fffffff;

export function resolveGid(rawGid: number): { gid: number } & TileFlips {
  return {
    gid: rawGid & GID_MASK,
    flipH: (rawGid & FLIP_H) !== 0,
    flipV: (rawGid & FLIP_V) !== 0,
    flipD: (rawGid & FLIP_D) !== 0,
  };
}

function propertiesToRecord(
  props: TiledProperty[] | undefined,
): Record<string, string | number | boolean> {
  const record: Record<string, string | number | boolean> = {};
  for (const p of props ?? []) record[p.name] = p.value;
  return record;
}

function decodeTileData(layer: TiledLayer): Uint32Array {
  const { data } = layer;
  if (Array.isArray(data)) {
    return Uint32Array.from(data);
  }
  if (typeof data === 'string') {
    if (layer.compression) {
      throw new Error(
        `Tile layer "${layer.name}" uses compression "${layer.compression}". ` +
          'Export tile layer data as CSV or uncompressed base64.',
      );
    }
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Uint32Array(bytes.buffer);
  }
  throw new Error(`Tile layer "${layer.name}" has no data.`);
}

function flattenLayers(
  layers: TiledLayer[],
  offsetX: number,
  offsetY: number,
  out: { layer: TiledLayer; offsetX: number; offsetY: number }[],
): void {
  for (const layer of layers) {
    const ox = offsetX + (layer.offsetx ?? 0);
    const oy = offsetY + (layer.offsety ?? 0);
    if (layer.type === 'group') {
      flattenLayers(layer.layers ?? [], ox, oy, out);
    } else {
      out.push({ layer, offsetX: ox, offsetY: oy });
    }
  }
}

/**
 * @param raw Parsed .tmj JSON.
 * @param baseUrl Absolute URL of the map file, used to resolve tileset images.
 */
export function normalizeTiledMap(raw: TiledMapJson, baseUrl: string): NormalizedTiledMap {
  if (raw.orientation !== 'orthogonal') {
    throw new Error(`Unsupported map orientation "${raw.orientation}" — expected "orthogonal".`);
  }
  if (raw.infinite) {
    throw new Error('Infinite maps are not supported. Use a fixed-size map.');
  }

  const tilesets: NormalizedTileset[] = raw.tilesets.map((ts) => {
    if (ts.source !== undefined) {
      throw new Error(
        `Tileset "${ts.source}" is external (.tsx). Embed tilesets in the map when exporting.`,
      );
    }
    if (!ts.image) {
      throw new Error(`Tileset "${ts.name ?? '?'}" has no image.`);
    }
    return {
      firstGid: ts.firstgid,
      name: ts.name ?? 'tileset',
      image: new URL(ts.image, baseUrl).toString(),
      imageWidth: ts.imagewidth ?? 0,
      imageHeight: ts.imageheight ?? 0,
      tileWidth: ts.tilewidth ?? raw.tilewidth,
      tileHeight: ts.tileheight ?? raw.tileheight,
      tileCount: ts.tilecount ?? 0,
      columns: ts.columns ?? 0,
      margin: ts.margin ?? 0,
      spacing: ts.spacing ?? 0,
    };
  });
  tilesets.sort((a, b) => a.firstGid - b.firstGid);

  const flat: { layer: TiledLayer; offsetX: number; offsetY: number }[] = [];
  flattenLayers(raw.layers, 0, 0, flat);

  const tileLayers: NormalizedTileLayer[] = [];
  const objectLayers: NormalizedObjectLayer[] = [];

  for (const { layer, offsetX, offsetY } of flat) {
    if (layer.type === 'tilelayer') {
      tileLayers.push({
        name: layer.name,
        width: layer.width ?? raw.width,
        height: layer.height ?? raw.height,
        gids: decodeTileData(layer),
        opacity: layer.opacity ?? 1,
        visible: layer.visible !== false,
        offsetX,
        offsetY,
      });
    } else if (layer.type === 'objectgroup') {
      objectLayers.push({
        name: layer.name,
        objects: (layer.objects ?? []).map((obj) => ({
          id: obj.id,
          name: obj.name,
          className: obj.class ?? obj.type ?? '',
          x: obj.x + offsetX,
          y: obj.y + offsetY,
          width: obj.width ?? 0,
          height: obj.height ?? 0,
          rotation: obj.rotation ?? 0,
          point: obj.point === true,
          visible: obj.visible !== false,
          text: obj.text,
          properties: propertiesToRecord(obj.properties),
        })),
      });
    }
    // imagelayer is intentionally ignored in Phase 0.
  }

  return {
    width: raw.width,
    height: raw.height,
    tileWidth: raw.tilewidth,
    tileHeight: raw.tileheight,
    pixelWidth: raw.width * raw.tilewidth,
    pixelHeight: raw.height * raw.tileheight,
    backgroundColor: raw.backgroundcolor,
    tileLayers,
    objectLayers,
    tilesets,
  };
}

/** Find the tileset owning a (clean) gid. */
export function findTilesetForGid(
  tilesets: NormalizedTileset[],
  gid: number,
): NormalizedTileset | null {
  let match: NormalizedTileset | null = null;
  for (const ts of tilesets) {
    if (gid >= ts.firstGid) match = ts;
    else break;
  }
  return match;
}
