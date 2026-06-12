import type { Container, FederatedPointerEvent } from 'pixi.js';
import type { EventEmitter } from 'pixi.js';
import type {
  EntityView,
  OfficeEntity,
  OfficeSceneEventMap,
} from './sceneTypes';

/**
 * Wires Pixi pointer events on entity views to scene-level semantic events
 * (`agent:hover`, `object:click`, …) and owns hover/selection state.
 */

type SceneEmitter = EventEmitter<OfficeSceneEventMap>;

export class InteractionManager {
  private hovered: EntityView | null = null;
  private selected: EntityView | null = null;
  private readonly views = new Set<EntityView>();

  constructor(private readonly emitter: SceneEmitter) {}

  /** Make one entity view hoverable/clickable. */
  attach(view: EntityView): void {
    this.views.add(view);
    const container = view.container;
    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerover', () => this.handleOver(view));
    container.on('pointerout', () => this.handleOut(view));
    container.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.select(view);
    });
  }

  /**
   * Clicking the bare floor (tile layers) clears the selection. Pixi only
   * dispatches the tap here when no entity captured it.
   */
  attachBackground(container: Container): void {
    container.eventMode = 'static';
    container.on('pointertap', () => this.select(null));
  }

  select(view: EntityView | null): void {
    if (this.selected === view) {
      this.emitInteraction(view?.entity ?? null, 'click');
      return;
    }
    this.selected?.setSelected(false);
    this.selected = view;
    view?.setSelected(true);
    if (view) this.emitInteraction(view.entity, 'click');
    this.emitter.emit('entity:select', view?.entity ?? null);
  }

  selectEntityId(id: string | null): void {
    if (id === null) {
      this.select(null);
      return;
    }
    for (const view of this.views) {
      if (view.entity.id === id) {
        this.select(view);
        return;
      }
    }
  }

  get selectedEntity(): OfficeEntity | null {
    return this.selected?.entity ?? null;
  }

  private handleOver(view: EntityView): void {
    if (this.hovered === view) return;
    this.hovered?.setHovered(false);
    this.hovered = view;
    view.setHovered(true);
    this.emitInteraction(view.entity, 'hover');
  }

  private handleOut(view: EntityView): void {
    if (this.hovered !== view) return;
    this.hovered = null;
    view.setHovered(false);
    this.emitInteraction(view.entity, 'hoverout');
  }

  private emitInteraction(
    entity: OfficeEntity | null,
    action: 'hover' | 'hoverout' | 'click',
  ): void {
    if (!entity) return;
    if (entity.kind === 'agent') {
      this.emitter.emit(`agent:${action}`, entity);
    } else {
      this.emitter.emit(`object:${action}`, entity);
    }
  }

  destroy(): void {
    this.hovered = null;
    this.selected = null;
    this.views.clear();
  }
}
