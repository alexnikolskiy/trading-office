# 06 — Technical Stack for Fable Phase

This file defines the stack only for the Office Visual Builder Kit phase.

## Use

```text
TypeScript
Vite
React 19 for preview/wrapper
PixiJS v8 for rendering
@pixi/react v8 for integration wrapper / preview
pixi-viewport for pan/zoom/camera
Tiled-compatible maps for floor authoring
PIXI.AnimatedSprite for simple agent animation
```

## Do not use in this phase

```text
Hono
Postgres
Drizzle
auth libraries
real trading-lab API clients
SSE/WebSocket
production dashboard libraries
Phaser
Spine
DragonBones
Rive
```

## Rationale

### Tiled

Tiled is the authoring tool for floors and rooms.

It should define:

- tile layers;
- walls/floor/furniture;
- object layers;
- spawn points;
- interactive object coordinates;
- custom properties.

### PixiJS

PixiJS is the rendering runtime.

It should render:

- floor layers;
- furniture;
- agents;
- labels;
- status badges;
- hover/click overlays.

### React

React is the integration and preview layer.

React should not render thousands of tiles directly.

Preferred shape:

```text
React shell
  ↓
OfficeSceneCanvas
  ↓
PixiJS renderer core
```

### pixi-viewport

Use for:

- default camera;
- pan;
- zoom;
- fitting the whole floor to viewport.

### AnimatedSprite

Use for simple pixel-agent animations.

First iteration may use simple idle/typing/thinking frame loops.

## Desired package shape

```text
packages/office-visual-kit/
  src/
    core/
      createOfficeScene.ts
      loadTiledMap.ts
      normalizeTiledMap.ts
      renderTileLayers.ts
      renderObjectLayer.ts
      renderAgents.ts
      renderStatusBadges.ts
      interactionManager.ts
      cameraController.ts
      assetRegistry.ts
      sceneTypes.ts

    react/
      OfficeSceneCanvas.tsx
      useOfficeScene.ts

    builder/
      officeSceneSchema.ts
      validateOfficeScene.ts
      createSceneFromTiled.ts

  docs/
    visual-builder-kit.md
    tiled-conventions.md
    asset-guidelines.md
    scene-schema.md
    superpowers-handoff.md
```

## Preview example shape

```text
examples/trading-lab-research-floor/
  index.html
  src/
    main.tsx
    TradingLabResearchFloorPreview.tsx
  maps/
    trading-lab-research-floor.tmj
  assets/
    tiles/
    furniture/
    agents/
    ui/
  scene/
    tradingLabResearchFloor.scene.ts
```
