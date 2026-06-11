import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { OfficeSceneTheme } from '../builder/officeSceneSchema';
import { DEFAULT_STATUS_COLORS } from '../builder/officeSceneSchema';
import type { AgentStatus } from './sceneTypes';

/**
 * Status badges: a small pill with a colored dot (and optionally the status
 * text) floating above an agent's head. Pure Pixi Graphics — no assets.
 */

export interface StatusBadge {
  container: Container;
  setStatus(status: AgentStatus): void;
  destroy(): void;
}

const BADGE_FONT = '"Courier New", ui-monospace, Menlo, monospace';

export class StatusBadgeRenderer {
  constructor(private readonly theme: OfficeSceneTheme) {}

  colorFor(status: AgentStatus): string {
    return (
      this.theme.statusColors?.[status] ??
      DEFAULT_STATUS_COLORS[status] ??
      '#8a93a8'
    );
  }

  create(initial: AgentStatus): StatusBadge {
    const showText = this.theme.statusBadgeText !== false;
    const container = new Container();
    container.label = 'status-badge';

    const background = new Graphics();
    const dot = new Graphics();
    container.addChild(background, dot);

    let text: Text | null = null;
    if (showText) {
      text = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: BADGE_FONT,
          fontSize: 6,
          fontWeight: '700',
          fill: '#ffffff',
          letterSpacing: 0.5,
        }),
        resolution: 4,
      });
      text.roundPixels = true;
      container.addChild(text);
    }

    const renderer = this;

    function redraw(status: AgentStatus): void {
      const color = renderer.colorFor(status);
      const dotRadius = 2;
      const padX = 3;
      const height = 9;

      if (text) text.text = status;
      const textWidth = text ? Math.ceil(text.width) : 0;
      const width = padX + dotRadius * 2 + (text ? 3 + textWidth : 0) + padX;

      background.clear();
      background
        .roundRect(0, 0, width, height, 3)
        .fill({ color: '#10131f', alpha: 0.78 })
        .stroke({ color, width: 0.75, alpha: 0.65 });

      dot.clear();
      dot.circle(padX + dotRadius, height / 2, dotRadius).fill({ color });
      // Soft outer glow ring around the dot.
      dot
        .circle(padX + dotRadius, height / 2, dotRadius + 1.25)
        .stroke({ color, width: 0.75, alpha: 0.35 });

      if (text) {
        text.position.set(padX + dotRadius * 2 + 3, (height - text.height) / 2);
      }
      container.pivot.set(width / 2, height);
    }

    redraw(initial);

    return {
      container,
      setStatus(status: AgentStatus): void {
        redraw(status);
      },
      destroy(): void {
        container.destroy({ children: true });
      },
    };
  }
}
