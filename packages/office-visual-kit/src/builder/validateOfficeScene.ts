import { AGENT_STATUSES } from '../core/sceneTypes';
import type { OfficeSceneConfig } from './officeSceneSchema';

/**
 * Structural validation of a scene config. `errors` block scene creation,
 * `warnings` are reported but tolerated.
 */

export interface SceneValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOfficeScene(config: OfficeSceneConfig): SceneValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.id) errors.push('Scene config needs an "id".');
  if (!config.title) warnings.push('Scene config has no "title".');
  if (!config.map?.url) errors.push('Scene config needs "map.url" (a .tmj file).');

  const assetKeys = new Set<string>();
  for (const asset of config.assets ?? []) {
    if (!asset.key) errors.push('An asset entry is missing its "key".');
    if (!asset.url) errors.push(`Asset "${asset.key}" is missing its "url".`);
    if (assetKeys.has(asset.key)) errors.push(`Duplicate asset key "${asset.key}".`);
    assetKeys.add(asset.key);
    if (asset.frameCount !== undefined && asset.frameCount < 1) {
      errors.push(`Asset "${asset.key}": frameCount must be >= 1.`);
    }
  }

  const entityIds = new Set<string>();
  for (const agent of config.agents ?? []) {
    if (!agent.id) {
      errors.push('An agent entry is missing its "id".');
      continue;
    }
    if (entityIds.has(agent.id)) errors.push(`Duplicate entity id "${agent.id}".`);
    entityIds.add(agent.id);
    if (!agent.role) errors.push(`Agent "${agent.id}" is missing its "role".`);
    if (!agent.displayName) {
      warnings.push(`Agent "${agent.id}" has no "displayName".`);
    }
    const spriteKey = agent.sprite ?? `agent:${agent.role}`;
    if (!assetKeys.has(spriteKey)) {
      errors.push(
        `Agent "${agent.id}" references sprite asset "${spriteKey}" which is not in "assets".`,
      );
    }
    if (
      agent.initialStatus !== undefined &&
      !AGENT_STATUSES.includes(agent.initialStatus)
    ) {
      warnings.push(
        `Agent "${agent.id}" has unknown initial status "${agent.initialStatus}".`,
      );
    }
  }

  for (const object of config.objects ?? []) {
    if (!object.id) {
      errors.push('An object entry is missing its "id".');
      continue;
    }
    if (entityIds.has(object.id)) errors.push(`Duplicate entity id "${object.id}".`);
    entityIds.add(object.id);
    if (!object.type) errors.push(`Object "${object.id}" is missing its "type".`);
    if (object.sprite !== undefined && !assetKeys.has(object.sprite)) {
      errors.push(
        `Object "${object.id}" references sprite asset "${object.sprite}" which is not in "assets".`,
      );
    }
  }

  const camera = config.camera;
  if (camera?.minZoom !== undefined && camera.maxZoom !== undefined) {
    if (camera.minZoom > camera.maxZoom) {
      errors.push('camera.minZoom must be <= camera.maxZoom.');
    }
  }
  if (
    typeof camera?.defaultZoom === 'number' &&
    (camera.defaultZoom <= 0 || !Number.isFinite(camera.defaultZoom))
  ) {
    errors.push('camera.defaultZoom must be a positive number or "fit".');
  }

  return { valid: errors.length === 0, errors, warnings };
}
