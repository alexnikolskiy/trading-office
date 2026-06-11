import { AnimatedSprite, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import type { OfficeSceneTheme } from '../builder/officeSceneSchema';
import type { AssetRegistry } from './assetRegistry';
import { createLabelChip, type LabelChip } from './labelChip';
import type { EntityView, ObjectEntity } from './sceneTypes';

/**
 * Interactive object views. Two flavours:
 * - sprite objects: a (possibly animated) sprite drawn at the Tiled rectangle;
 * - hit-area objects: no sprite — an invisible hover/click zone over
 *   furniture already painted in tile layers.
 */

export class ObjectView implements EntityView {
  readonly container: Container;

  private readonly outline: Graphics;
  private readonly labelChip: LabelChip | null;
  private hovered = false;
  private selected = false;
  private readonly width: number;
  private readonly height: number;

  constructor(
    readonly entity: ObjectEntity,
    private readonly theme: OfficeSceneTheme,
    registry: AssetRegistry,
    options: { spriteKey?: string; showLabel: boolean },
  ) {
    this.container = new Container();
    this.container.label = `object:${entity.id}`;
    this.container.position.set(entity.position.x, entity.position.y);

    let width = entity.size.width;
    let height = entity.size.height;

    if (options.spriteKey) {
      const frames = registry.getFrames(options.spriteKey);
      let sprite: Sprite;
      if (frames.length > 1) {
        const animated = new AnimatedSprite(frames);
        animated.animationSpeed = registry.getAnimationSpeed(options.spriteKey);
        animated.play();
        animated.currentFrame = Math.floor(Math.random() * frames.length);
        sprite = animated;
      } else {
        sprite = new Sprite(frames[0]);
      }
      sprite.roundPixels = true;
      width = width || sprite.width;
      height = height || sprite.height;
      // Center the sprite inside the Tiled rectangle, baseline-aligned.
      sprite.position.set(
        Math.round((width - sprite.width) / 2),
        Math.round(height - sprite.height),
      );
      this.container.addChild(sprite);
    } else {
      // Pure hit-area object over tile-layer furniture.
      this.container.hitArea = new Rectangle(0, 0, width, height);
    }

    this.width = width;
    this.height = height;
    // Depth-sort by the object's baseline so agents can stand behind it.
    this.container.zIndex = entity.position.y + height;

    this.outline = new Graphics();
    this.outline.visible = false;
    this.container.addChild(this.outline);

    if (options.showLabel && entity.label) {
      this.labelChip = createLabelChip(entity.label, theme.objectLabel);
      this.labelChip.container.position.set(Math.round(width / 2), height + 2);
      this.container.addChild(this.labelChip.container);
    } else {
      this.labelChip = null;
    }
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.refreshOutline();
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.refreshOutline();
  }

  private refreshOutline(): void {
    const active = this.hovered || this.selected;
    this.outline.visible = active;
    if (!active) return;
    const color = this.selected ? this.theme.selectionColor : this.theme.hoverColor;
    this.outline.clear();
    this.outline
      .roundRect(-1.5, -1.5, this.width + 3, this.height + 3, 2)
      .stroke({ color, width: 1, alpha: 0.95 });
    this.outline
      .roundRect(-3, -3, this.width + 6, this.height + 6, 3)
      .stroke({ color, width: 0.75, alpha: 0.3 });
    this.labelChip?.setHighlighted(active, color);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

export function renderObject(
  entity: ObjectEntity,
  theme: OfficeSceneTheme,
  registry: AssetRegistry,
  options: { spriteKey?: string; showLabel: boolean },
): ObjectView {
  return new ObjectView(entity, theme, registry, options);
}
