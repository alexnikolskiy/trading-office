# 04 — Office Visual Builder Kit Scope

## What Fable should build

Fable should build a reusable visual constructor for office floors.

This is not a throwaway mockup and not the full trading-office product.

It should be a quality foundation for:

```text
Tiled map → semantic scene schema → PixiJS renderer → React preview wrapper
```

## Core package

Suggested package:

```text
packages/office-visual-kit/
```

## Required capabilities

### 1. Tiled-compatible map loading

Support maps exported from Tiled.

Expected map layers:

```text
floor
walls
furniture
decor
agent_spawn_points
interactive_objects
labels
```

### 2. Tile layer rendering

Render floor/walls/furniture/decor tile layers.

### 3. Object layer processing

Read object layers for:

- agent spawn points;
- interactive objects;
- labels;
- debug hit areas.

### 4. Scene schema

Do not put all business semantics into `.tmj`.

Create a TypeScript scene schema that complements Tiled.

Example responsibilities:

- floor id/title/theme;
- agent role mapping;
- object type mapping;
- panel target names;
- label visibility;
- status badge defaults;
- asset variant mappings.

### 5. Asset registry

Support a registry for:

- tilesets;
- furniture;
- agents;
- status badges;
- labels;
- UI/debug overlays.

### 6. Agent renderer

Support role-based agent rendering.

Initial roles:

```text
boss
strategy_analyst
researcher
critic
builder
evaluator
performance_monitor
knowledge_curator
```

Initial statuses:

```text
idle
thinking
running
waiting
reviewing
backtesting
success
failed
blocked
```

### 7. Interactive object renderer

Support objects such as:

```text
boss_console
agent_desk
wall_monitor
hypothesis_board
bot_status_monitor
archive_shelf
server_rack
elevator
door
```

### 8. Hover/click events

The kit should emit events to the host app.

Example:

```ts
scene.on('agent:hover', handler)
scene.on('agent:click', handler)
scene.on('object:hover', handler)
scene.on('object:click', handler)
```

Preview can show debug cards instead of real panels.

### 9. Camera / viewport

Use pan/zoom/camera handling.

Default view should frame the whole first office floor nicely.

### 10. React preview wrapper

The renderer core should not become a huge React component tree.

But the kit should provide a React integration wrapper:

```tsx
<OfficeSceneCanvas
  scene={scene}
  onAgentClick={...}
  onObjectClick={...}
/>
```

## Explicit non-goals for Fable

Do not build:

- Hono backend;
- Postgres;
- auth/session;
- real trading-lab API integration;
- production dashboards;
- Boss command backend;
- Docker Compose for whole product;
- browser drag-and-drop editor;
- full admin app.

## What Superpowers will do later

Superpowers will later build:

- actual `apps/web`;
- `apps/server`;
- Hono + Postgres + auth;
- React panels;
- trading-lab connector;
- mock/connected data modes;
- Docker Compose;
- README for local/demo deployment.

Fable should leave a clear handoff for this.
