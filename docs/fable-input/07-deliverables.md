# 07 — Deliverables

Fable should deliver a reusable Office Visual Builder Kit and one working visual example.

## Required deliverables

### 1. Office Visual Builder Kit package

Path:

```text
packages/office-visual-kit/
```

Must include:

- core renderer;
- Tiled map loader/normalizer;
- scene schema;
- asset registry;
- agent renderer;
- object renderer;
- status badge renderer;
- interaction manager;
- camera/viewport controller;
- React wrapper.

### 2. Example floor

Path:

```text
examples/trading-lab-research-floor/
```

Must include:

- preview app;
- Tiled-compatible map;
- assets;
- scene config;
- example agents;
- example interactive objects;
- hover/click debug info.

### 3. Visual style

Must include:

- original pixel-art style;
- coherent color palette;
- readable role labels;
- clear office/control-room feeling;
- no copied third-party layout.

### 4. Tiled conventions

Document:

```text
packages/office-visual-kit/docs/tiled-conventions.md
```

Must explain:

- required layer names;
- object layer names;
- required object properties;
- how to add agents;
- how to add interactive objects;
- how to create a new floor.

### 5. Scene schema docs

Document:

```text
packages/office-visual-kit/docs/scene-schema.md
```

Must explain:

- what is stored in Tiled;
- what is stored in scene config;
- what will later come from runtime state.

### 6. Asset guidelines

Document:

```text
packages/office-visual-kit/docs/asset-guidelines.md
```

Must explain:

- allowed assets;
- generated placeholders;
- Kenney usage;
- optional LPC usage;
- license/attribution rules.

### 7. Superpowers handoff

Document:

```text
packages/office-visual-kit/docs/superpowers-handoff.md
```

Must explain:

- what Fable built;
- how to run preview;
- how to integrate kit into future React app;
- what is intentionally missing;
- recommended next implementation steps.

### 8. Visual tuning guide

Document:

```text
packages/office-visual-kit/docs/visual-tuning.md
```

Must explain:

- how to move desks;
- how to change palette;
- how to replace assets;
- how to add a new agent role;
- how to add a new interactive object;
- how to scale/fit the scene;
- how to iterate after visual feedback.

## Non-deliverables

Fable should NOT deliver:

- production `apps/web`;
- production `apps/server`;
- auth;
- Postgres;
- Hono;
- real API connectors;
- connected data mode;
- dashboard panels;
- full Docker Compose.

Those are for Superpowers later.
