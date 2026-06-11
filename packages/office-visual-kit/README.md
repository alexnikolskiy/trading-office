# @trading-office/office-visual-kit

Reusable visual constructor for pixel-art AI office floors.

```text
Tiled map → scene schema / semantic config → PixiJS v8 renderer → React wrapper
```

- Renderer core is plain PixiJS (no React); React integration is a thin
  wrapper exported from `@trading-office/office-visual-kit/react`.
- Floors are data: a Tiled `.tmj` map plus an `OfficeSceneConfig`. Adding a
  floor requires no renderer changes.
- Agents (animated sprites + status badges + labels), interactive objects,
  hover/click events, pan/zoom camera, asset registry, schema validation.

## Documentation

| Doc | Content |
| --- | --- |
| [docs/visual-builder-kit.md](./docs/visual-builder-kit.md) | architecture, API, quick start |
| [docs/tiled-conventions.md](./docs/tiled-conventions.md) | authoring floors in Tiled |
| [docs/scene-schema.md](./docs/scene-schema.md) | the scene config schema |
| [docs/asset-guidelines.md](./docs/asset-guidelines.md) | asset & license policy |
| [docs/visual-tuning.md](./docs/visual-tuning.md) | iterating on the look |
| [docs/superpowers-handoff.md](./docs/superpowers-handoff.md) | continuation plan for the full app |

## Example

See `examples/trading-lab-research-floor` — run `npm install && npm run dev`
from the repo root.
