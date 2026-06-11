import { Application } from '@pixi/react';
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { resolveTheme, type OfficeSceneConfig } from '../builder/officeSceneSchema';
import type { OfficeScene } from '../core/createOfficeScene';
import type {
  AgentEntity,
  ObjectEntity,
  OfficeEntity,
} from '../core/sceneTypes';
import { useOfficeScene } from './useOfficeScene';

/**
 * React integration wrapper. The component owns only canvas lifecycle and
 * event plumbing — all rendering happens in the imperative OfficeScene core.
 *
 *   <OfficeSceneCanvas
 *     config={scene}
 *     onAgentClick={...}
 *     onObjectClick={...}
 *   />
 */

export interface OfficeSceneCanvasProps {
  /** Memoize this — a new identity recreates the scene. */
  config: OfficeSceneConfig;
  onSceneReady?: (scene: OfficeScene) => void;
  onSceneError?: (error: Error) => void;
  onAgentHover?: (agent: AgentEntity) => void;
  onAgentHoverOut?: (agent: AgentEntity) => void;
  onAgentClick?: (agent: AgentEntity) => void;
  onObjectHover?: (object: ObjectEntity) => void;
  onObjectHoverOut?: (object: ObjectEntity) => void;
  onObjectClick?: (object: ObjectEntity) => void;
  /** Convenience: hover of any entity; `null` when the pointer leaves it. */
  onEntityHover?: (entity: OfficeEntity | null) => void;
  /** Convenience: selection changes; `null` when selection is cleared. */
  onEntitySelect?: (entity: OfficeEntity | null) => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function SceneBridge(props: OfficeSceneCanvasProps): null {
  const { scene, error } = useOfficeScene(props.config);

  useEffect(() => {
    if (error) props.onSceneError?.(error);
  }, [error, props.onSceneError]);

  useEffect(() => {
    if (scene) props.onSceneReady?.(scene);
  }, [scene, props.onSceneReady]);

  const {
    onAgentHover,
    onAgentHoverOut,
    onAgentClick,
    onObjectHover,
    onObjectHoverOut,
    onObjectClick,
    onEntityHover,
    onEntitySelect,
  } = props;

  useEffect(() => {
    if (!scene) return;

    const handleAgentHover = (agent: AgentEntity) => {
      onAgentHover?.(agent);
      onEntityHover?.(agent);
    };
    const handleAgentHoverOut = (agent: AgentEntity) => {
      onAgentHoverOut?.(agent);
      onEntityHover?.(null);
    };
    const handleObjectHover = (object: ObjectEntity) => {
      onObjectHover?.(object);
      onEntityHover?.(object);
    };
    const handleObjectHoverOut = (object: ObjectEntity) => {
      onObjectHoverOut?.(object);
      onEntityHover?.(null);
    };
    const handleAgentClick = (agent: AgentEntity) => onAgentClick?.(agent);
    const handleObjectClick = (object: ObjectEntity) => onObjectClick?.(object);
    const handleSelect = (entity: OfficeEntity | null) => onEntitySelect?.(entity);

    scene.on('agent:hover', handleAgentHover);
    scene.on('agent:hoverout', handleAgentHoverOut);
    scene.on('agent:click', handleAgentClick);
    scene.on('object:hover', handleObjectHover);
    scene.on('object:hoverout', handleObjectHoverOut);
    scene.on('object:click', handleObjectClick);
    scene.on('entity:select', handleSelect);

    return () => {
      scene.off('agent:hover', handleAgentHover);
      scene.off('agent:hoverout', handleAgentHoverOut);
      scene.off('agent:click', handleAgentClick);
      scene.off('object:hover', handleObjectHover);
      scene.off('object:hoverout', handleObjectHoverOut);
      scene.off('object:click', handleObjectClick);
      scene.off('entity:select', handleSelect);
    };
  }, [
    scene,
    onAgentHover,
    onAgentHoverOut,
    onAgentClick,
    onObjectHover,
    onObjectHoverOut,
    onObjectClick,
    onEntityHover,
    onEntitySelect,
  ]);

  return null;
}

export function OfficeSceneCanvas(props: OfficeSceneCanvasProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const theme = resolveTheme(props.config.theme);

  return (
    <div
      ref={setHost}
      className={props.className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...props.style,
      }}
    >
      {host !== null && (
        <Application
          resizeTo={host}
          background={theme.backgroundColor}
          antialias={false}
          roundPixels
          autoDensity
          resolution={Math.min(globalThis.devicePixelRatio ?? 1, 2)}
        >
          <SceneBridge {...props} />
        </Application>
      )}
      {props.children}
    </div>
  );
}
