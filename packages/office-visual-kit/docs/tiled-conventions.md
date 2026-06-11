# Tiled Conventions

Floors are authored as [Tiled](https://www.mapeditor.org/) maps and exported
as JSON (`.tmj`). This document is the contract between the map author and the
renderer.

## Export settings

- Orientation: **orthogonal**, fixed size (no infinite maps).
- Tile layer format: **CSV** (or base64 *uncompressed*). Compression is not
  supported and fails loudly.
- Tilesets: **embedded in the map** ("Embed tilesets" on export). External
  `.tsx` references are rejected with a clear error.
- Tileset image paths are resolved **relative to the map URL** at load time.

## Required tile layers

| Layer name | Content | Notes |
| --- | --- | --- |
| `floor` | floor, carpets, rugs | bottom-most |
| `walls` | wall caps, wall faces, windows, doors | above floor |
| `furniture` | desks, chairs, plants, shelves | above walls |
| `decor` | desk items, small overlays | above furniture |

Any tile layer is rendered generically in map order, so extra layers are fine;
the four canonical names keep floors consistent and are what the docs and
examples assume. Missing layers are skipped silently.

## Object layers

### `agent_spawn_points`

Point objects. One per agent.

| Field | Value |
| --- | --- |
| `name` | spawn id — referenced by `AgentSceneConfig.spawnPoint` (defaults to the agent's `id`) |
| class (`type`) | `agent_spawn` |
| position | the agent's **feet** (sprites are anchored 0.5/1.0) |

Custom properties (all optional, used as fallback when no scene-config entry
exists):

| Property | Type | Meaning |
| --- | --- | --- |
| `role` | string | agent role (`boss`, `researcher`, …) |
| `displayName` | string | full name for panels/debug |
| `label` | string | short label under the sprite |
| `status` | string | initial status |

### `interactive_objects`

Rectangle objects. One per interactive (or decorative) object.

| Field | Value |
| --- | --- |
| `name` | object id — referenced by `ObjectSceneConfig.mapObjectName` (defaults to the object's `id`) |
| class (`type`) | `interactive_object` |
| rect | hover/click area; sprite objects should match the sprite size |

Custom properties (fallbacks for auto-discovered objects):

| Property | Type | Meaning |
| --- | --- | --- |
| `objectType` | string | `wall_monitor`, `boss_console`, … |
| `label` | string | label shown on the object |
| `panelTarget` | string | future React panel id |
| `interactive` | bool | `false` → no hover/click |

### `labels` (optional)

Tiled **text objects**. Rendered as faint decorative floor text (zone names
like `RESEARCH BAY`). The text color and `pixelsize` can be set per object;
otherwise the theme's `floorLabelColor` and an 8px default apply.

## Binding rules (map ⨯ scene config)

1. Each scene-config agent looks up the spawn point named
   `spawnPoint ?? id`. Missing spawn → warning, agent skipped.
2. Each scene-config object looks up the rectangle named
   `mapObjectName ?? id`. Missing rect → warning, object skipped.
3. Map objects **without** a config entry are auto-discovered using their
   custom properties (`role`, `objectType`, `label`, …). This lets you
   prototype a floor in Tiled alone before writing the config.
4. Config always wins over map properties when both exist.

## How to add an agent to a floor

1. In Tiled: add a point to `agent_spawn_points`, name it (e.g. `quant`),
   place it at the agent's feet.
2. In the scene config: add
   `{ id: 'quant', role: 'strategy_analyst', displayName: 'Quant' }`.
3. Make sure the role sprite (`agent:strategy_analyst`) is in `assets`.

## How to add an interactive object

1. In Tiled: draw a rectangle in `interactive_objects`, name it
   (e.g. `risk-board`), size it to the future sprite.
2. In the scene config: add
   `{ id: 'risk-board', type: 'hypothesis_board', label: 'Risk Board', sprite: 'prop:hypothesis_board', panelTarget: 'risk-panel' }`.
3. Objects without `sprite` become invisible hit-areas — use this to make
   tile-layer furniture (e.g. a desk) clickable.

## How to create a new floor

1. Create a map in Tiled: orthogonal, any square tile size — the renderer is
   tile-size agnostic (the example uses 30×21 tiles at 32×32).
2. Add the four tile layers and paint the room with your tileset.
3. Add `agent_spawn_points`, `interactive_objects`, optional `labels`.
4. Export as `.tmj` with embedded tilesets, put it under `public/maps/`.
5. Write a scene config (see [scene-schema.md](./scene-schema.md)).
6. Point `<OfficeSceneCanvas config={...}>` at it. No renderer changes needed.

Layout conventions that made the example read as a real office: a 3-row top
wall (cap + two face rows) with a 2×2 door and 2×2 windows; wall-mounted
boards/monitors as object sprites over the wall face; desks as furniture
tiles with the seated agent's spawn point centered on the desk's bottom edge,
~26px below the desk row (the chair is part of the agent sprite, so the pair
always lines up); a small 9-slice rug per workstation; amenities
(vending/coffee/cooler/bins/plants) along walls and corners.

The example floor's map is itself generated by a reviewable script
(`examples/trading-lab-research-floor/tools/generate-map.mjs`) — handy when
you want layouts in code review, but hand-authored Tiled maps are the primary
path.
