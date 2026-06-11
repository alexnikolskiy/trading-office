/**
 * @trading-office/office-visual-kit
 *
 * Pipeline: Tiled map → scene schema → PixiJS renderer → React wrapper.
 * React integration lives in the `@trading-office/office-visual-kit/react`
 * subpath so the core stays React-free.
 */

// Core renderer
export {
  OfficeScene,
  createOfficeScene,
  mountOfficeScene,
  type CreateOfficeSceneOptions,
  type MountedOfficeScene,
} from './core/createOfficeScene';
export { CameraController, type CameraControllerOptions } from './core/cameraController';
export { InteractionManager } from './core/interactionManager';
export {
  AssetRegistry,
  TilesetTextureIndex,
  DEFAULT_ANIMATION_SPEED,
} from './core/assetRegistry';
export { AgentView, renderAgent } from './core/renderAgents';
export { ObjectView, renderObject } from './core/renderObjectLayer';
export { StatusBadgeRenderer, type StatusBadge } from './core/renderStatusBadges';
export { renderTileLayers, type TileLayersResult } from './core/renderTileLayers';

// Tiled loading / normalization
export { loadTiledMap } from './core/loadTiledMap';
export {
  normalizeTiledMap,
  resolveGid,
  findTilesetForGid,
  type NormalizedTiledMap,
  type NormalizedTileLayer,
  type NormalizedObjectLayer,
  type NormalizedObject,
  type NormalizedTileset,
  type TiledMapJson,
} from './core/normalizeTiledMap';

// Scene vocabulary
export {
  AGENT_ROLES,
  AGENT_STATUSES,
  TILED_LAYERS,
  TILED_OBJECT_CLASSES,
  type AgentRole,
  type AgentStatus,
  type InteractiveObjectType,
  type AgentEntity,
  type ObjectEntity,
  type OfficeEntity,
  type FloorLabel,
  type EntityView,
  type OfficeSceneEventMap,
  type ScenePoint,
  type SceneSize,
  type EntityProperties,
} from './core/sceneTypes';

// Scene schema (builder)
export {
  DEFAULT_THEME,
  DEFAULT_STATUS_COLORS,
  resolveTheme,
  type OfficeSceneConfig,
  type OfficeSceneTheme,
  type OfficeSceneThemeLabelStyle,
  type SpriteAssetConfig,
  type AgentSceneConfig,
  type ObjectSceneConfig,
  type SceneCameraConfig,
} from './builder/officeSceneSchema';
export {
  validateOfficeScene,
  type SceneValidationResult,
} from './builder/validateOfficeScene';
export {
  resolveSceneEntities,
  type ResolvedSceneEntities,
} from './builder/createSceneFromTiled';
