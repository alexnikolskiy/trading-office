import { Container, Sprite } from 'pixi.js';
import type { TilesetTextureIndex } from './assetRegistry';
import { resolveGid, type NormalizedTiledMap } from './normalizeTiledMap';

/**
 * Renders every visible tile layer of a normalized Tiled map into one
 * container. Layers keep Tiled's order (floor below walls below furniture…).
 */

export interface TileLayersResult {
  container: Container;
  /** Per-layer containers, keyed by Tiled layer name. */
  layers: Map<string, Container>;
}

/** Apply Tiled flip bits to a sprite with anchor (0.5, 0.5). */
function applyTileFlips(
  sprite: Sprite,
  flipH: boolean,
  flipV: boolean,
  flipD: boolean,
): void {
  if (flipD) {
    // Anti-diagonal flip combos map to rotations per the Tiled format docs.
    if (flipH && flipV) {
      sprite.rotation = Math.PI / 2;
      sprite.scale.y = -1;
    } else if (flipH) {
      sprite.rotation = Math.PI / 2;
    } else if (flipV) {
      sprite.rotation = -Math.PI / 2;
    } else {
      sprite.rotation = -Math.PI / 2;
      sprite.scale.y = -1;
    }
  } else {
    if (flipH) sprite.scale.x = -1;
    if (flipV) sprite.scale.y = -1;
  }
}

export function renderTileLayers(
  map: NormalizedTiledMap,
  tilesetIndex: TilesetTextureIndex,
): TileLayersResult {
  const root = new Container();
  root.label = 'tile-layers';
  const layers = new Map<string, Container>();

  for (const layer of map.tileLayers) {
    if (!layer.visible) continue;

    const layerContainer = new Container();
    layerContainer.label = `tile-layer:${layer.name}`;
    layerContainer.alpha = layer.opacity;
    layerContainer.position.set(layer.offsetX, layer.offsetY);

    for (let i = 0; i < layer.gids.length; i++) {
      const rawGid = layer.gids[i] ?? 0;
      if (rawGid === 0) continue;
      const { gid, flipH, flipV, flipD } = resolveGid(rawGid);
      const texture = tilesetIndex.textureForGid(gid);
      if (!texture) continue;

      const col = i % layer.width;
      const row = Math.floor(i / layer.width);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      // Tiled anchors oversized tiles to the cell's bottom-left corner.
      sprite.position.set(
        col * map.tileWidth + texture.width / 2,
        row * map.tileHeight + map.tileHeight - texture.height / 2,
      );
      applyTileFlips(sprite, flipH, flipV, flipD);
      layerContainer.addChild(sprite);
    }

    layers.set(layer.name, layerContainer);
    root.addChild(layerContainer);
  }

  return { container: root, layers };
}
