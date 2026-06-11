import {
  Application,
  Container,
  EventEmitter,
  Graphics,
  Text,
  TextStyle,
} from 'pixi.js';
import { resolveSceneEntities } from '../builder/createSceneFromTiled';
import {
  resolveTheme,
  type OfficeSceneConfig,
  type OfficeSceneTheme,
} from '../builder/officeSceneSchema';
import { validateOfficeScene } from '../builder/validateOfficeScene';
import { AssetRegistry } from './assetRegistry';
import { CameraController } from './cameraController';
import { InteractionManager } from './interactionManager';
import { loadTiledMap } from './loadTiledMap';
import type { NormalizedTiledMap } from './normalizeTiledMap';
import { AgentView } from './renderAgents';
import { ObjectView } from './renderObjectLayer';
import { StatusBadgeRenderer } from './renderStatusBadges';
import { renderTileLayers } from './renderTileLayers';
import type {
  AgentEntity,
  AgentStatus,
  FloorLabel,
  ObjectEntity,
  OfficeEntity,
  OfficeSceneEventMap,
} from './sceneTypes';

/**
 * The renderer core. Owns the viewport, tile layers, entity views and
 * interaction; emits semantic events to the host. Plain PixiJS — no React.
 *
 * Lifecycle:
 *   const scene = await createOfficeScene({ application, config });
 *   scene.on('agent:click', ...);
 *   scene.destroy();
 *
 * The Application is owned by the caller (React wrapper, preview shell, …);
 * `mountOfficeScene` below is a convenience that owns one for you.
 */

export interface CreateOfficeSceneOptions {
  /** An initialized PIXI.Application. */
  application: Application;
  config: OfficeSceneConfig;
  /** Container to attach the scene viewport to; defaults to app.stage. */
  parent?: Container;
}

export class OfficeScene extends EventEmitter<OfficeSceneEventMap> {
  readonly config: OfficeSceneConfig;
  readonly theme: OfficeSceneTheme;
  readonly map: NormalizedTiledMap;
  readonly camera: CameraController;

  private readonly app: Application;
  private readonly registry: AssetRegistry;
  private readonly interaction: InteractionManager;
  private readonly agentViews = new Map<string, AgentView>();
  private readonly objectViews = new Map<string, ObjectView>();
  private readonly onRendererResize: (width: number, height: number) => void;
  private destroyed = false;

  private constructor(options: {
    app: Application;
    config: OfficeSceneConfig;
    theme: OfficeSceneTheme;
    map: NormalizedTiledMap;
    camera: CameraController;
    registry: AssetRegistry;
  }) {
    super();
    this.app = options.app;
    this.config = options.config;
    this.theme = options.theme;
    this.map = options.map;
    this.camera = options.camera;
    this.registry = options.registry;
    this.interaction = new InteractionManager(this);

    this.onRendererResize = (width: number, height: number) => {
      this.camera.handleResize(width, height);
    };
    this.app.renderer.on('resize', this.onRendererResize);
  }

  static async create(options: CreateOfficeSceneOptions): Promise<OfficeScene> {
    const { application: app, config } = options;

    const validation = validateOfficeScene(config);
    for (const warning of validation.warnings) {
      console.warn(`[office-visual-kit] ${warning}`);
    }
    if (!validation.valid) {
      throw new Error(
        `Invalid scene config "${config.id}":\n- ${validation.errors.join('\n- ')}`,
      );
    }

    const theme = resolveTheme(config.theme);
    const map = await loadTiledMap(config.map.url);

    const registry = new AssetRegistry();
    registry.register(config.assets);
    const [tilesetIndex] = await Promise.all([
      registry.loadTilesets(map.tilesets),
      registry.load(),
    ]);

    const camera = new CameraController({
      events: app.renderer.events,
      screenWidth: app.renderer.width / app.renderer.resolution,
      screenHeight: app.renderer.height / app.renderer.resolution,
      worldWidth: map.pixelWidth,
      worldHeight: map.pixelHeight,
      config: config.camera,
    });

    const scene = new OfficeScene({ app, config, theme, map, camera, registry });

    // 1. Tile layers (floor, walls, furniture, decor) — also the
    //    "click empty floor to clear selection" background.
    const tileLayers = renderTileLayers(map, tilesetIndex);
    tileLayers.container.zIndex = 0;
    camera.viewport.addChild(tileLayers.container);
    scene.interaction.attachBackground(tileLayers.container);

    // 2. Decorative floor labels from the map's `labels` layer.
    const entities = resolveSceneEntities(map, config);
    for (const warning of entities.warnings) {
      console.warn(`[office-visual-kit] ${warning}`);
    }
    if (config.labels?.floor !== false) {
      const labelContainer = scene.buildFloorLabels(entities.floorLabels, theme);
      labelContainer.zIndex = 1;
      camera.viewport.addChild(labelContainer);
    }

    // 3. Entities (agents + interactive objects), depth-sorted by baseline.
    const entityLayer = new Container();
    entityLayer.label = 'entities';
    entityLayer.sortableChildren = true;
    entityLayer.zIndex = 2;
    camera.viewport.addChild(entityLayer);

    const badgeRenderer = new StatusBadgeRenderer(theme);
    const showAgentLabels = config.labels?.agents !== false;
    const showObjectLabels = config.labels?.objects !== false;

    const agentConfigById = new Map(config.agents.map((a) => [a.id, a]));
    for (const agent of entities.agents) {
      const spriteKey =
        agentConfigById.get(agent.id)?.sprite ?? `agent:${agent.role}`;
      const view = new AgentView(agent, theme, registry, badgeRenderer, {
        spriteKey,
        showLabel: showAgentLabels && agentConfigById.get(agent.id)?.showLabel !== false,
      });
      scene.agentViews.set(agent.id, view);
      scene.interaction.attach(view);
      entityLayer.addChild(view.container);
    }

    const objectConfigById = new Map(config.objects.map((o) => [o.id, o]));
    for (const object of entities.objects) {
      const objectConfig = objectConfigById.get(object.id);
      const view = new ObjectView(object, theme, registry, {
        spriteKey: objectConfig?.sprite,
        showLabel: showObjectLabels && objectConfig?.showLabel !== false,
      });
      scene.objectViews.set(object.id, view);
      if (object.interactive) {
        scene.interaction.attach(view);
      }
      entityLayer.addChild(view.container);
    }

    // 4. Subtle night-ambient tint above everything.
    const overlayAlpha = theme.ambientOverlayAlpha ?? 0;
    if (theme.ambientOverlayColor && overlayAlpha > 0) {
      const overlay = new Graphics();
      overlay
        .rect(0, 0, map.pixelWidth, map.pixelHeight)
        .fill({ color: theme.ambientOverlayColor, alpha: overlayAlpha });
      overlay.eventMode = 'none';
      overlay.zIndex = 3;
      camera.viewport.addChild(overlay);
    }

    (options.parent ?? app.stage).addChild(camera.viewport);
    camera.applyDefaultView();

    scene.emit('scene:ready');
    return scene;
  }

  private buildFloorLabels(labels: FloorLabel[], theme: OfficeSceneTheme): Container {
    const container = new Container();
    container.label = 'floor-labels';
    container.eventMode = 'none';
    for (const label of labels) {
      const text = new Text({
        text: label.text,
        style: new TextStyle({
          fontFamily: '"Courier New", ui-monospace, Menlo, monospace',
          fontSize: 8,
          fontWeight: '700',
          letterSpacing: 2,
          fill: label.color ?? theme.floorLabelColor,
        }),
        resolution: 4,
      });
      text.roundPixels = true;
      text.alpha = 0.6;
      const cx = label.position.x + (label.size?.width ?? 0) / 2;
      const cy = label.position.y + (label.size?.height ?? 0) / 2;
      text.anchor.set(0.5, 0.5);
      text.position.set(cx, cy);
      container.addChild(text);
    }
    return container;
  }

  // --- Public runtime API ----------------------------------------------------

  getAgents(): AgentEntity[] {
    return [...this.agentViews.values()].map((v) => v.entity);
  }

  getObjects(): ObjectEntity[] {
    return [...this.objectViews.values()].map((v) => v.entity);
  }

  getEntity(id: string): OfficeEntity | null {
    return (
      this.agentViews.get(id)?.entity ?? this.objectViews.get(id)?.entity ?? null
    );
  }

  /** Update an agent's status badge (later driven by the office gateway). */
  setAgentStatus(agentId: string, status: AgentStatus): void {
    const view = this.agentViews.get(agentId);
    if (!view) {
      console.warn(`[office-visual-kit] setAgentStatus: unknown agent "${agentId}".`);
      return;
    }
    const previous = view.entity.status;
    view.setStatus(status);
    this.emit('agent:status', view.entity, previous);
  }

  /** Programmatically select an entity (or clear with null). */
  selectEntity(id: string | null): void {
    this.interaction.selectEntityId(id);
  }

  get selectedEntity(): OfficeEntity | null {
    return this.interaction.selectedEntity;
  }

  /** Smoothly pan the camera to an entity. */
  focusEntity(id: string, scale?: number): void {
    const entity = this.getEntity(id);
    if (!entity) return;
    const cx =
      entity.kind === 'object'
        ? entity.position.x + entity.size.width / 2
        : entity.position.x;
    const cy =
      entity.kind === 'object'
        ? entity.position.y + entity.size.height / 2
        : entity.position.y;
    this.camera.focusOn(cx, cy, scale);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.renderer.off('resize', this.onRendererResize);
    this.interaction.destroy();
    for (const view of this.agentViews.values()) view.destroy();
    for (const view of this.objectViews.values()) view.destroy();
    this.agentViews.clear();
    this.objectViews.clear();
    this.camera.destroy();
    this.registry.destroy();
    this.removeAllListeners();
  }
}

export async function createOfficeScene(
  options: CreateOfficeSceneOptions,
): Promise<OfficeScene> {
  return OfficeScene.create(options);
}

export interface MountedOfficeScene {
  app: Application;
  scene: OfficeScene;
  destroy: () => void;
}

/**
 * Framework-free convenience: creates a PIXI.Application sized to `host`,
 * mounts the scene and returns both. Demonstrates that the renderer core
 * works without React.
 */
export async function mountOfficeScene(
  host: HTMLElement,
  config: OfficeSceneConfig,
): Promise<MountedOfficeScene> {
  const theme = resolveTheme(config.theme);
  const app = new Application();
  await app.init({
    background: theme.backgroundColor,
    antialias: false,
    roundPixels: true,
    resolution: Math.min(globalThis.devicePixelRatio ?? 1, 2),
    autoDensity: true,
    resizeTo: host,
  });
  host.appendChild(app.canvas);

  const scene = await createOfficeScene({ application: app, config });
  return {
    app,
    scene,
    destroy: () => {
      scene.destroy();
      app.destroy(true, { children: true });
    },
  };
}
