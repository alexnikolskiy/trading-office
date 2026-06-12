# 08 — Acceptance Criteria

The Fable phase is successful only if the visual builder kit can be evaluated visually and reused later.

## Run criteria

A developer can run:

```bash
npm install
npm run dev
```

And see the preview.

If the exact command differs, document it clearly.

## Visual criteria

The preview must show a coherent pixel-art `Trading Lab Research Floor`.

It must contain:

- Boss / Orchestrator console;
- Strategy Analyst desk;
- Researcher desk;
- Critic review desk;
- Builder terminal;
- Evaluator dashboard desk;
- Performance Monitor station;
- Wall Monitor;
- Hypothesis Board;
- Bot Status Monitor;
- Archive Shelf.

The result should be visually reviewable, not just a technical placeholder.

## Builder criteria

The kit must make it possible to create another floor by:

1. creating a Tiled-compatible map;
2. adding required layers and object properties;
3. adding scene config;
4. loading it in preview;
5. rendering without rewriting the renderer.

## Interaction criteria

Preview-level interaction must support:

- hover agent;
- click agent;
- hover interactive object;
- click interactive object;
- show debug information for selected entity.

Real React panels are not required.

## Architecture criteria

The renderer core should not be a giant React component tree.

Expected relationship:

```text
React wrapper → PixiJS renderer core
```

The kit should be usable later inside a React app.

## Licensing criteria

The output must not include unclear assets.

Every third-party asset must have:

- source;
- license note;
- attribution file if needed.

The YouTube screenshot must not be copied into layout/assets.

## Scope criteria

Fable must not spend time on:

- backend;
- auth;
- Postgres;
- trading-lab real API;
- execution commands;
- production dashboards.

## Handoff criteria

Superpowers should be able to continue using:

- documented package structure;
- visual builder kit docs;
- Tiled conventions;
- React wrapper;
- example floor;
- handoff document.
