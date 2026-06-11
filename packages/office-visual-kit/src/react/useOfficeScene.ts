import { useApplication } from '@pixi/react';
import { useEffect, useState } from 'react';
import type { OfficeSceneConfig } from '../builder/officeSceneSchema';
import { createOfficeScene, OfficeScene } from '../core/createOfficeScene';

/**
 * Creates an OfficeScene inside an `@pixi/react` `<Application>` subtree.
 * Memoize `config` in the host component — a new object identity recreates
 * the scene.
 */

export interface UseOfficeSceneResult {
  scene: OfficeScene | null;
  error: Error | null;
}

export function useOfficeScene(config: OfficeSceneConfig): UseOfficeSceneResult {
  const { app } = useApplication();
  const [scene, setScene] = useState<OfficeScene | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!app?.renderer) return;

    let cancelled = false;
    let created: OfficeScene | null = null;

    createOfficeScene({ application: app, config })
      .then((s) => {
        if (cancelled) {
          s.destroy();
          return;
        }
        created = s;
        setScene(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });

    return () => {
      cancelled = true;
      created?.destroy();
      setScene(null);
      setError(null);
    };
  }, [app, config]);

  return { scene, error };
}
