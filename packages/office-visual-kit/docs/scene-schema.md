# Scene Schema

The kit deliberately splits a floor's definition across three places. Keeping
this split clean is what makes floors cheap to author and the renderer
reusable.

## What lives where

| Concern | Lives in | Why |
| --- | --- | --- |
| Tiles, walls, furniture, room shape | **Tiled map** | visual editing belongs in a map editor |
| Positions of agents and objects | **Tiled map** (spawn points / rects) | placement is geometry |
| Roles, names, labels | **scene config** | semantics, reviewed in code |
| Sprite/asset bindings | **scene config** | assets change independently of maps |
| Panel targets (`panelTarget`) | **scene config** | app-level concern |
| Theme, camera, label visibility | **scene config** | presentation defaults |
| Agent statuses, metrics, live data | **runtime** (`scene.setAgentStatus`, events) | will come from the office gateway later — never bake into map or config |

## OfficeSceneConfig

```ts
interface OfficeSceneConfig {
  id: string;                       // unique floor id
  title: string;                    // human title
  map: { url: string };             // .tmj location
  theme?: Partial<OfficeSceneTheme>;
  assets: SpriteAssetConfig[];      // every sprite the floor needs
  agents: AgentSceneConfig[];
  objects: ObjectSceneConfig[];
  camera?: SceneCameraConfig;
  labels?: {
    agents?: boolean;            // master switches
    objects?: boolean;
    floor?: boolean;
    agentMode?: 'always' | 'hover';   // 'hover' shows chips only on hover/selection
    objectMode?: 'always' | 'hover';
  };
}
```

A "theme" of a floor (like the example's Day Office / Night Control Room) is
just a different `OfficeSceneConfig`: same agents/objects, a different map
URL (same geometry, different tileset image) and a different `theme` block.
Switching is a config swap — no schema or kit changes involved.

### SpriteAssetConfig

```ts
// A status-driven agent strip (still idle pose + typing loop):
{
  key: 'agent:researcher',   // referenced by agents/objects
  url: '/assets/.../agent-researcher.png',
  frameWidth: 64,            // horizontal strip slicing
  frameCount: 4,             // total frames in the strip
  states: {                  // named frame ranges for status-driven animation
    idle:   { from: 0, count: 1 },              // still pose
    active: { from: 1, count: 3, speed: 0.14 }, // typing loop
  },
}

// A plain looping / static sprite (props) — no `states`:
{
  key: 'prop:wall_monitor',
  url: '/assets/.../wall-monitor.png',
  frameWidth: 96,
  frameCount: 2,             // 1 = static sprite
  animationSpeed: 0.012,     // PIXI.AnimatedSprite speed
}
```

Convention for keys: `agent:<role>` for agent sprites (the default lookup),
`prop:<type>` for object sprites (explicitly referenced).

**Animation states.** A sprite may declare `states: Record<string,
SpriteAnimationState>`, where each state is `{ from, count?, speed? }` —
`from` is the first frame index in the strip, `count` defaults to `1`, and
`speed` is the PIXI.AnimatedSprite speed (`0` or a single frame ⇒ held
still). Agents look for an `idle` and an `active` state: at runtime
`AgentView` plays `idle` for any status listed in `theme.agentIdleStatuses`
(default `['idle']`) and `active` for every other status — so a
`setAgentStatus()` call flips an agent between sitting still and typing.
Sprites without `states` just use `frameCount` / `animationSpeed` (continuous
loop, or static when `frameCount` is 1) — the prop default.

### AgentSceneConfig

```ts
{
  id: 'researcher',             // unique; default spawn-point name
  role: 'researcher',           // picks sprite `agent:<role>` unless overridden
  displayName: 'Researcher',
  label: 'Researcher',          // short text under the sprite
  spawnPoint: 'researcher',     // Tiled point name (default: id)
  initialStatus: 'thinking',
  sprite: 'agent:researcher',   // optional override
  showLabel: true,
  labelOffsetY: 44,             // optional per-agent override of
                                // theme.agentLabelOffsetY (deeper desks,
                                // e.g. the Boss's 4×2 console)
}
```

Built-in roles: `boss`, `strategy_analyst`, `researcher`, `critic`,
`builder`, `evaluator`, `performance_monitor`, `knowledge_curator`.
The union is open — any string works as a custom role as long as a sprite is
registered for it.

### ObjectSceneConfig

```ts
{
  id: 'wall-monitor',
  type: 'wall_monitor',           // open union, see below
  label: 'Backtests',
  mapObjectName: 'wall-monitor',  // Tiled rect name (default: id)
  panelTarget: 'backtest-summary',// future React panel id
  sprite: 'prop:wall_monitor',    // omit → invisible hit-area over tiles
  interactive: true,              // false → decorative
  showLabel: true,
}
```

`panelTarget` is an **app-level routing key**: the kit only carries it
through — on `object:click` and into the debug overlay — and never opens a
panel itself. A sprite-less `interactive` object is a pure hit-area over
tile-painted furniture (the example's entrance door uses this with
`panelTarget: 'exit'`).

Built-in object types: `boss_console`, `agent_desk`, `wall_monitor`,
`hypothesis_board`, `bot_status_monitor`, `archive_shelf`, `server_rack`,
`data_table`, `elevator`, `door`.

### Statuses

`idle · thinking · running · waiting · reviewing · backtesting · success ·
failed · blocked`

Status → badge color mapping lives in the theme (`statusColors`), defaults in
`DEFAULT_STATUS_COLORS`.

### Theme

```ts
{
  backgroundColor: '#6f7886',
  ambientOverlayColor: '#ffd9a0',  // scene-wide tint (warm sun / night violet)
  ambientOverlayAlpha: 0.04,       // 0 disables
  hoverColor: '#0a84ff',
  selectionColor: '#e8590c',
  floorLabelColor: '#7a6850',
  statusColors: { running: '#59f7d4', /* … */ },
  statusBadgeText: true,           // false → dot-only badges
  statusBadgeScale: 1.1,           // badge size relative to the world (1 = 16px-tile sizing)
  statusBadgeOffsetY: -8,          // px offset of the badge above the sprite top;
                                   // negative drops it down close to the head
  agentLabelOffsetY: 30,           // px below the feet anchor — push the chip
                                   // below the desk block so it clears the desk
                                   // ("floor nameplate") when the agent sits
                                   // behind its desk
  agentIdleStatuses: ['idle'],     // statuses that play the sprite's `idle`
                                   // animation state and hide the badge; every
                                   // other status plays `active` + shows a badge
  agentLabel: { color, backgroundColor, backgroundAlpha, fontSize,
                borderColor, borderAlpha },  // border = plaque look (optional)
  objectLabel: { /* same shape */ },
}
```

Busy agents show a shimmering `<status>…` badge; idle statuses (per
`agentIdleStatuses`) show no badge at all. Hover/selection are driven by
`hoverColor` / `selectionColor` — a translucent rectangle behind the
character plus a breathing corner-bracket reticle (only the character body is
a hit target, not the nameplate or badge).

The kit's `DEFAULT_THEME` is the night control-room look; the example's Day
Office overrides it via `FLOOR_THEMES` in its scene module.

### Camera

```ts
{
  defaultZoom: 'fit',  // or a number
  fitPadding: 28,      // screen px around the floor when fitting
  minZoom: 0.75,
  maxZoom: 6,
  enablePan: true,
  enableZoom: true,
}
```

## Validation

`validateOfficeScene(config)` runs automatically inside
`createOfficeScene` — duplicate ids, missing asset keys, bad camera ranges are
**errors** (scene refuses to load); unknown statuses or missing titles are
**warnings** (logged). Binding problems against the map (missing spawn points
or rects) are reported as warnings at resolve time.

## What will come from runtime later (Superpowers)

- agent statuses driven by real `trading-lab` workflow state;
- object panel data (backtest summaries, bot health, hypotheses);
- selection/focus orchestrated by the app shell;
- possibly more entity kinds (events, alerts).

The kit's contract for all of this is already in place: `setAgentStatus()`,
`focusEntity()`, `selectEntity()` and the event map.
