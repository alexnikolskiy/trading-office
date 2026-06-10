# 09 — Fable Master Prompt

Use this as the main prompt for Fable after creating the `trading-office` repository and adding this input pack.

---

We are creating a new repository: `trading-office`.

Read all files in:

```text
docs/fable-input/
```

Your task is NOT to build the entire product.

Your task is to create a high-quality, reusable **Office Visual Builder Kit** for a pixel-art AI office / AI Research Tower.

This kit will later be used by Superpowers to build the full `trading-office` app with React panels, Hono server, Postgres, auth, and real `trading-lab` integration.

## Context

`trading-office` is not just an admin panel for `trading-lab`.

It is a separate AI Office Shell / Control Room for multiple agent systems.

`trading-lab` will be the first connected floor/system.

`trading-platform` remains the execution/data authority.

`trading-office` must not have execution authority.

## Current scope

Build only the visual constructor and one visual example floor.

The constructor should support this pipeline:

```text
Tiled map
  ↓
scene schema / semantic config
  ↓
PixiJS renderer
  ↓
React preview wrapper
```

## Stack for this phase

Use:

- TypeScript;
- Vite;
- React 19 for preview/wrapper;
- PixiJS v8 for rendering;
- `@pixi/react` v8 for integration wrapper / preview;
- `pixi-viewport` for pan/zoom/camera;
- Tiled-compatible maps for floor authoring;
- `PIXI.AnimatedSprite` for simple agent animation if useful.

Do not use:

- Hono;
- Postgres;
- Drizzle;
- auth;
- real `trading-lab` API;
- SSE/WebSocket;
- Phaser;
- Spine;
- DragonBones;
- Rive.

## Required output

Create:

```text
packages/office-visual-kit/
```

with:

- core renderer;
- Tiled map loader/normalizer;
- tile layer renderer;
- object layer processor;
- agent renderer;
- status badge renderer;
- interaction manager;
- camera/viewport controller;
- asset registry;
- scene schema;
- React wrapper.

Create:

```text
examples/trading-lab-research-floor/
```

with:

- runnable preview app;
- Tiled-compatible map;
- scene config;
- pixel-art assets or placeholders;
- Trading Lab Research Floor example.

## Example floor must include

Agents:

- Boss / Orchestrator;
- Strategy Analyst;
- Researcher;
- Critic / Risk Reviewer;
- Builder;
- Evaluator;
- Performance Monitor.

Objects:

- Wall Monitor;
- Hypothesis Board;
- Bot Status Monitor;
- Archive Shelf;
- Server Rack / Data Node;
- Boss Console.

## Interaction

Preview-level interaction is enough:

- hover agent;
- click agent;
- hover object;
- click object;
- show debug card/overlay with selected entity info.

Do not build production React panels.

## Visual style

Create an original visual language.

Use the YouTube screenshot only as mood reference if present locally.

Do not copy:

- layout;
- characters;
- exact palette;
- props;
- composition;
- assets.

Desired style:

```text
Retro Pixel AI Research Tower
```

Mood:

```text
cozy night research office + trading command center
```

## Assets

Prefer:

- original/generated placeholder pixel assets;
- Kenney CC0 assets for environment/furniture if available.

Optional later:

- LPC spritesheet-compatible pipeline.

Do not make LPC mandatory because attribution/licensing may be complex.

Include asset/license documentation.

## Documentation

Create docs under:

```text
packages/office-visual-kit/docs/
```

Required docs:

- `visual-builder-kit.md`
- `tiled-conventions.md`
- `asset-guidelines.md`
- `scene-schema.md`
- `visual-tuning.md`
- `superpowers-handoff.md`

## Acceptance criteria

The phase is successful if:

1. `npm install && npm run dev` launches a visual preview or the run command is clearly documented.
2. The preview shows a coherent pixel-art `Trading Lab Research Floor`.
3. The floor includes all required agents and objects.
4. Hover/click debug interactions work.
5. A new floor can be created through Tiled map + scene config without rewriting renderer.
6. The renderer core is not a giant React component tree.
7. React integration exists as wrapper/preview support.
8. Asset/license policy is documented.
9. No backend/auth/Postgres/API work is done.
10. Superpowers can continue from the handoff docs.

Remember:

```text
Fable builds how the office is visually authored and rendered.
Superpowers later builds the full trading-office application around it.
```
