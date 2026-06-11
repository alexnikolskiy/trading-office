import {
  normalizeTiledMap,
  type NormalizedTiledMap,
  type TiledMapJson,
} from './normalizeTiledMap';

/**
 * Fetch a Tiled JSON map (.tmj) and normalize it. Relative tileset image
 * paths inside the map are resolved against the map URL.
 */
export async function loadTiledMap(url: string): Promise<NormalizedTiledMap> {
  const absoluteUrl = new URL(
    url,
    typeof location !== 'undefined' ? location.href : 'http://localhost/',
  ).toString();

  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error(`Failed to load Tiled map "${url}": HTTP ${response.status}`);
  }
  const raw = (await response.json()) as TiledMapJson;
  return normalizeTiledMap(raw, absoluteUrl);
}
