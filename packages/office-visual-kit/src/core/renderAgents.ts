import { AnimatedSprite, Container, Graphics, Sprite } from 'pixi.js';
import type { OfficeSceneTheme } from '../builder/officeSceneSchema';
import type { AssetRegistry } from './assetRegistry';
import { createLabelChip, type LabelChip } from './labelChip';
import type { StatusBadge, StatusBadgeRenderer } from './renderStatusBadges';
import type { AgentEntity, AgentStatus, EntityView } from './sceneTypes';

/**
 * Agent views: animated pixel sprite anchored at the feet, a label chip
 * below, a status badge above and a hover/selection ring at the feet.
 */

export class AgentView implements EntityView {
  readonly container: Container;

  private readonly ring: Graphics;
  private readonly badge: StatusBadge;
  private readonly labelChip: LabelChip | null;
  private hovered = false;
  private selected = false;
  private readonly spriteHeight: number;

  constructor(
    readonly entity: AgentEntity,
    private readonly theme: OfficeSceneTheme,
    registry: AssetRegistry,
    badgeRenderer: StatusBadgeRenderer,
    options: { spriteKey: string; showLabel: boolean },
  ) {
    this.container = new Container();
    this.container.label = `agent:${entity.id}`;
    this.container.position.set(entity.position.x, entity.position.y);
    // Depth-sort agents and object sprites by their baseline.
    this.container.zIndex = entity.position.y;

    this.ring = new Graphics();
    this.ring.visible = false;
    this.container.addChild(this.ring);

    const frames = registry.getFrames(options.spriteKey);
    let sprite: Sprite;
    if (frames.length > 1) {
      const animated = new AnimatedSprite(frames);
      animated.animationSpeed =
        registry.getAnimationSpeed(options.spriteKey) * (0.85 + Math.random() * 0.4);
      animated.play();
      // Desynchronize idle loops between agents.
      animated.currentFrame = Math.floor(Math.random() * frames.length);
      sprite = animated;
    } else {
      sprite = new Sprite(frames[0]);
    }
    sprite.anchor.set(0.5, 1);
    sprite.roundPixels = true;
    this.spriteHeight = sprite.height;
    this.container.addChild(sprite);

    this.badge = badgeRenderer.create(entity.status);
    this.badge.container.position.set(0, -this.spriteHeight - 3);
    this.container.addChild(this.badge.container);

    if (options.showLabel) {
      this.labelChip = createLabelChip(entity.label, theme.agentLabel);
      this.labelChip.container.position.set(0, 2);
      this.container.addChild(this.labelChip.container);
    } else {
      this.labelChip = null;
    }
  }

  setStatus(status: AgentStatus): void {
    this.entity.status = status;
    this.badge.setStatus(status);
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.refreshRing();
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.refreshRing();
  }

  private refreshRing(): void {
    const active = this.hovered || this.selected;
    this.ring.visible = active;
    if (!active) return;
    const color = this.selected ? this.theme.selectionColor : this.theme.hoverColor;
    this.ring.clear();
    this.ring.ellipse(0, -1, 9, 4).stroke({ color, width: 1, alpha: 0.95 });
    this.ring.ellipse(0, -1, 11, 5.5).stroke({ color, width: 0.75, alpha: 0.35 });
    this.labelChip?.setHighlighted(active, color);
  }

  destroy(): void {
    this.badge.destroy();
    this.container.destroy({ children: true });
  }
}

export function renderAgent(
  entity: AgentEntity,
  theme: OfficeSceneTheme,
  registry: AssetRegistry,
  badgeRenderer: StatusBadgeRenderer,
  options: { spriteKey: string; showLabel: boolean },
): AgentView {
  return new AgentView(entity, theme, registry, badgeRenderer, options);
}
