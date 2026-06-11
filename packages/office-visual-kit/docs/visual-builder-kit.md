# Office Visual Builder Kit

A reusable visual constructor for pixel-art office floors. It powers the
`trading-office` AI Office Shell: floors are authored as Tiled maps, bound to
semantics by a scene config, rendered by a PixiJS v8 core and embedded into
React through a thin wrapper.

```text
Tiled map (.tmj)            geometry: tiles, walls, furniture, positions
        ↓
scene config (TS)           semantics: roles, labels, sprites, panels, theme
        ↓
PixiJS renderer core        OfficeScene: layers, entities, camera, events
        ↓
React preview wrapper       <OfficeSceneCanvas> — lifecycle + event plumbing
```

## Package layout

```text
src/
  core/                      plain PixiJS — no React imports
    createOfficeScene.ts     OfficeScene orchestrator + mountOfficeScene()
    loadTiledMap.ts          fetch + normalize a .tmj
    normalizeTiledMap.ts     raw Tiled JSON → NormalizedTiledMap
    renderTileLayers.ts      tile layers → sprite containers
    renderObjectLayer.ts     ObjectView (sprite or hit-area objects)
    renderAgents.ts          AgentView (AnimatedSprite + label + badge)
    renderStatusBadges.ts    status pill renderer (pure Graphics)
    interactionManager.ts    hover/click state → semantic events
    cameraController.ts      pixi-viewport wrapper (pan/zoom/fit)
    assetRegistry.ts         texture loading, frame slicing, tileset slicing
    labelChip.ts             shared label chip (text over translucent chip)
    sceneTypes.ts            entities, roles, statuses, event map
  builder/
    officeSceneSchema.ts     OfficeSceneConfig schema + default theme
    validateOfficeScene.ts   structural validation (errors/warnings)
    createSceneFromTiled.ts  map ⨯ config → resolved entities
  react/
    OfficeSceneCanvas.tsx    React wrapper (@pixi/react Application)
    useOfficeScene.ts        hook: scene lifecycle inside <Application>
```

The core never imports React. React integration lives behind the
`@trading-office/office-visual-kit/react` subpath.

## Quick start (inside a React app)

```tsx
import type { OfficeSceneConfig } from '@trading-office/office-visual-kit';
import { OfficeSceneCanvas } from '@trading-office/office-visual-kit/react';

const config: OfficeSceneConfig = {
  id: 'my-floor',
  title: 'My Floor',
  map: { url: '/maps/my-floor.tmj' },
  assets: [
    { key: 'agent:researcher', url: '/assets/agents/agent-researcher.png', frameWidth: 16, frameCount: 2 },
  ],
  agents: [{ id: 'alice', role: 'researcher', displayName: 'Alice' }],
  objects: [],
};

<OfficeSceneCanvas
  config={config}
  onAgentClick={(agent) => console.log(agent.id)}
  onObjectClick={(object) => console.log(object.panelTarget)}
/>;
```

`config` must be referentially stable (`useMemo`) — a new identity recreates
the scene.

## Quick start (no React)

```ts
import { mountOfficeScene } from '@trading-office/office-visual-kit';

const { scene, destroy } = await mountOfficeScene(
  document.getElementById('host')!,
  config,
);
scene.on('agent:click', (agent) => console.log(agent.id));
```

## Scene events

```ts
scene.on('agent:hover', (agent) => {});
scene.on('agent:hoverout', (agent) => {});
scene.on('agent:click', (agent) => {});
scene.on('agent:status', (agent, previous) => {});
scene.on('object:hover', (object) => {});
scene.on('object:hoverout', (object) => {});
scene.on('object:click', (object) => {});
scene.on('entity:select', (entity /* | null */) => {});
scene.on('scene:ready', () => {});
```

`ObjectEntity.panelTarget` carries the future React panel id — the preview
shows debug cards, the production app will route the event to a real panel.

## Scene runtime API

| Method | Purpose |
| --- | --- |
| `scene.setAgentStatus(id, status)` | update an agent's badge (live data later) |
| `scene.getAgents()` / `scene.getObjects()` | resolved entities |
| `scene.getEntity(id)` | one entity or `null` |
| `scene.selectEntity(id \| null)` | programmatic selection |
| `scene.focusEntity(id, scale?)` | animate the camera to an entity |
| `scene.camera.fit(padding)` | re-frame the whole floor |
| `scene.destroy()` | full teardown (the host owns the Application) |

## Rendering model

- Tile layers render in Tiled order: `floor` → `walls` → `furniture` → `decor`.
- Entities (agents + object sprites) live in one container with
  `sortableChildren`; `zIndex` is the baseline `y`, so agents can stand behind
  tall props (e.g. the Boss behind the console).
- Decorative floor labels (`labels` object layer) render between tiles and
  entities.
- An optional ambient tint (theme `ambientOverlayColor/Alpha`) sits on top for
  the night mood.
- All textures are nearest-neighbour; the canvas runs with `roundPixels`.

## Related docs

- [tiled-conventions.md](./tiled-conventions.md) — authoring floors in Tiled
- [scene-schema.md](./scene-schema.md) — what lives where (map vs config vs runtime)
- [asset-guidelines.md](./asset-guidelines.md) — asset and license policy
- [visual-tuning.md](./visual-tuning.md) — how to iterate on the look
- [superpowers-handoff.md](./superpowers-handoff.md) — continuation plan
