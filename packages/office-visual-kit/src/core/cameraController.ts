import { Viewport } from 'pixi-viewport';
import type { EventSystem } from 'pixi.js';
import type { SceneCameraConfig } from '../builder/officeSceneSchema';

/**
 * Camera/viewport controller on top of pixi-viewport: pan, zoom, world
 * clamping and "frame the whole floor" fitting.
 */

export interface CameraControllerOptions {
  events: EventSystem;
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  config?: SceneCameraConfig;
}

const WORLD_PADDING = 64;

export class CameraController {
  readonly viewport: Viewport;
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly config: SceneCameraConfig;

  constructor(options: CameraControllerOptions) {
    this.worldWidth = options.worldWidth;
    this.worldHeight = options.worldHeight;
    this.config = options.config ?? {};

    this.viewport = new Viewport({
      screenWidth: options.screenWidth,
      screenHeight: options.screenHeight,
      worldWidth: options.worldWidth,
      worldHeight: options.worldHeight,
      events: options.events,
      disableOnContextMenu: true,
    });
    this.viewport.label = 'office-viewport';
    this.viewport.sortableChildren = true;

    if (this.config.enablePan !== false) {
      this.viewport.drag().decelerate({ friction: 0.92 });
    }
    if (this.config.enableZoom !== false) {
      this.viewport.wheel({ smooth: 5 }).pinch();
    }
    this.viewport.clampZoom({
      minScale: this.config.minZoom ?? 0.5,
      maxScale: this.config.maxZoom ?? 6,
    });
    this.viewport.clamp({
      left: -WORLD_PADDING,
      top: -WORLD_PADDING,
      right: options.worldWidth + WORLD_PADDING,
      bottom: options.worldHeight + WORLD_PADDING,
      underflow: 'center',
    });
  }

  /** Apply the configured default view (fit or fixed zoom), centered. */
  applyDefaultView(): void {
    const zoom = this.config.defaultZoom ?? 'fit';
    if (zoom === 'fit') {
      this.fit(this.config.fitPadding ?? 24);
    } else {
      this.viewport.setZoom(zoom, true);
      this.center();
    }
  }

  /** Scale so the whole world is visible with screen-space padding. */
  fit(padding = 24): void {
    const scale = Math.min(
      (this.viewport.screenWidth - padding * 2) / this.worldWidth,
      (this.viewport.screenHeight - padding * 2) / this.worldHeight,
    );
    this.viewport.setZoom(Math.max(scale, 0.1), true);
    this.center();
  }

  center(): void {
    this.viewport.moveCenter(this.worldWidth / 2, this.worldHeight / 2);
  }

  /** Smoothly move the camera to a world position. */
  focusOn(x: number, y: number, scale?: number): void {
    this.viewport.animate({
      time: 400,
      position: { x, y },
      ...(scale !== undefined ? { scale } : {}),
      ease: 'easeInOutSine',
    });
  }

  handleResize(screenWidth: number, screenHeight: number): void {
    this.viewport.resize(screenWidth, screenHeight, this.worldWidth, this.worldHeight);
  }

  destroy(): void {
    this.viewport.destroy({ children: true });
  }
}
