# Trading Office — Phase 1: Application Shell — Design

Status: **approved (design)** · Date: 2026-06-13 · Supersedes nothing · Builds on
Phase 0 (Office Visual Builder Kit, frozen).

## Goal

Turn the Phase 0 visual-kit preview into the first **production-facing application
shell** for `trading-office`: an outside/building establishing screen, a mock
login, and an authenticated Trading Lab Research Floor that uses the kit's
`OfficeSceneCanvas` with a real **panel router** (replacing the technical
`DebugCard`). Data is **mock-first**; there is **no execution authority** and **no
direct access** to `trading-lab` or `trading-platform`.

Phase 1 is **frontend-only**. Real Hono/Postgres/auth/trading-lab integration and
the real-time stream are explicitly deferred to a later phase. The seams for them
are put in place but not implemented.

## Architectural boundaries (held for the whole phase)

1. **Pixi/office-visual-kit renders ONLY interactive agent floors.** The outside
   screen, login, panels, topbar, and routing are React/DOM. Pixi is a renderer,
   never a business-state owner.
2. **React panels never mutate Pixi objects per tick.** Runtime status flows
   `store → applyStatusToScene seam → scene.setAgentStatus(...)`. Re-rendering a
   panel must never re-render the floor.
3. **The browser talks only to the `OfficeGateway` interface.** In Phase 1 the
   single implementation is `MockOfficeGateway`. No imports of, or clients for,
   `trading-lab` or `trading-platform`. No execution authority anywhere.
4. **The router owns view/selection state; the scene follows.** See §6 — the
   scene emits user-intent events, the router owns route/panel state, and the
   scene is reconciled to the route via `selectEntity`/`focusEntity`. This
   one-way flow is what prevents update loops.

## 1. Repository / workspace structure

### New

- `apps/web/` — production shell. Stack: Vite 7 + React 19 + `react-router-dom`
  + `@pixi/react` 8 + `pixi.js` 8 + `pixi-viewport` + `@trading-office/office-visual-kit`
  + `@trading-office/trading-lab-floor`. Added to root `workspaces` via `apps/*`.
- `packages/trading-lab-floor/` — the Trading Lab floor extracted from the example.
  Name `@trading-office/trading-lab-floor`. Holds the scene config, the `tools/`
  generators, and the canonical `maps/` + `assets/` (generated + LPC).

### Refactored (NOT broken)

- `examples/trading-lab-research-floor/` becomes a **thin preview wrapper** that
  imports the floor from `@trading-office/trading-lab-floor`. It keeps
  `main.tsx`, `TradingLabResearchFloorPreview.tsx`, and `DebugCard.tsx`, and
  remains runnable as the visual-kit dev preview (`npm run dev`).

### Untouched

- `packages/office-visual-kit/` (Phase 0, frozen).

### Shared-floor ownership rules (locked)

- `packages/trading-lab-floor` is the **only source of truth** for the floor's
  scene config, maps, assets, and tools.
- `examples/*` and `apps/web` are **consumers** of that package.
- **`apps/web` must not import from `examples/*`** (production must not depend on
  an example). The dependency direction is `apps/web → packages/*` only.
- Maps/assets synced into any consumer's `public/` are **generated copy
  artifacts**: they are git-ignored, regenerated on `predev`/`prebuild`, and
  **must not be edited by hand**. Edit the canonical files under
  `packages/trading-lab-floor/` instead.

### Asset-sync mechanism

Canonical servable files live in `packages/trading-lab-floor/assets/`
(`maps/*.tmj`, `generated/...`, `third-party/lpc/...`). A zero-dependency script
`sync-floor-public.mjs` copies them into each consumer's `public/{maps,assets}`
on `predev`/`prebuild`. The synced subpaths are git-ignored. (Alternative
considered: `vite-plugin-static-copy`; the zero-dep script is preferred to match
the repo's existing "scripts produce committed/derived files" ethos. Final
mechanism is confirmed in the implementation plan.)

## 2. Data layer (gateway + mini-store + bridge-seam)

```ts
// runtime/OfficeGateway.ts — read-only contract: browser → (future) office gateway.
interface OfficeGateway {
  getAgentActivity(agentId: string): Promise<AgentActivity>; // status, currentTask, logs/traces
  getHypotheses(): Promise<Hypothesis[]>;
  getBacktests(): Promise<BacktestSummary[]>;
  getBotHealth(): Promise<BotHealth[]>;
  getKnowledge(): Promise<KnowledgeEntry[]>;
  getInfraStatus(): Promise<InfraStatus>;
  sendBossCommand(text: string): Promise<BossMessage>;       // INERT mock — see §7
  subscribeAgentStatuses?(cb: (s: AgentStatusMap) => void): () => void; // optional sim feed
}
```

- **`MockOfficeGateway`** — the only Phase 1 implementation, backed by fixtures
  under `runtime/fixtures/*`. Async with small artificial latency so panels
  exercise their loading states.
- **`OfficeRuntimeStore`** — a minimal plain-TS subscribable holding the runtime
  state the UI actually needs now: agent statuses + current selection. Read by
  panels and floor badges via `useSyncExternalStore`.
- **`sceneBridge.ts`** — a single function `applyStatusToScene(scene, store)`,
  the embryo of the future `RuntimeSceneBridge`. An optional sim loop (topbar
  "simulate activity" toggle) pushes statuses into the store; the store, not
  React render cycles, drives the scene.
- **Phase 2 swap:** replace `MockOfficeGateway` with a real gateway client and
  grow the seam into a full bridge. No panel rewrites required.

## 3. Navigation & session

- Routes:
  - `/` — outside lobby (public)
  - `/floor/trading-lab` — floor (guarded)
  - `/floor/trading-lab/agent/:agentId` — floor + agent panel
  - `/floor/trading-lab/panel/:panelTarget` — floor + object panel
- `RequireSession` guard: a route under `/floor` with no mock session redirects
  to `/`.
- `SessionContext`: `{ user: { name } | null, login(name), logout() }`, persisted
  to `localStorage` (`trading-office.session`). `logout()` is a **separate**
  action in the topbar (see §5/§6).

## 4. Outside screen + login

- `OutsideScreen.tsx`: an **app-owned** generated pixel-art building facade
  (`apps/web/tools/generate-exterior.mjs`, CC0/MIT, same deterministic ethos as
  the floor tools), with the entrance **door as an absolutely-positioned
  `<button>` hotspot** over the facade PNG.
- Door behavior (see §5 for the full table):
  - **no session** → open `LoginModal` (name field + "Enter the Lab", no
    validation) → `login(name)` → navigate `/floor/trading-lab`.
  - **session exists** → navigate straight to `/floor/trading-lab` (skip login).

## 5. Door / exit behavior (locked)

| Where | Action | Result |
| --- | --- | --- |
| Outside, entrance door | click, **no session** | open login modal |
| Outside, entrance door | click, **session exists** | enter floor |
| Floor, Door/Exit object (`panelTarget: 'exit'`) | click | confirm → return to outside lobby (`/`) |
| Floor, Door/Exit | after return | **session remains** (re-entering the door goes straight back in) |
| Topbar | "Log out" | clears session (separate from exit); door then requires login again |

Exit is **return-to-lobby**, not logout. Logout is an explicit, separate topbar
action.

## 6. Floor screen + panel dock + router

- `FloorScreen.tsx` mounts
  `<OfficeSceneCanvas config={floorConfig} key={themeName}
  onAgentClick onObjectClick onEntitySelect onSceneReady onSceneError>` with a
  right-side `<PanelDock>`.

### Selection / route reconciliation (loop-free)

The flow is strictly one-way:

1. **Scene emits user intent.** `onAgentClick` / `onObjectClick` /
   `onEntitySelect(null)` are treated as *intent events only* — they do **not**
   mutate the scene directly. They call `navigate(...)`.
2. **Router owns route/panel state.** The active panel and the selected entity
   id are derived from the URL params — the single source of truth.
3. **Scene follows the route.** One effect keyed on the route param reconciles
   the scene to it: `scene.selectEntity(id)` + `scene.focusEntity(id)` (or
   `selectEntity(null)` when no panel route is active). The reconciler is guarded
   (no-op when the scene already matches) so the scene→intent→route→scene path
   cannot ping-pong.

Concretely: clicking an agent navigates to `/floor/trading-lab/agent/:id`;
clicking empty floor (`onEntitySelect(null)`) navigates to
`/floor/trading-lab`; the dock and the scene both read the route, never each
other.

### Panel router

`panelRegistry.ts` resolves the active panel from the route:

- agent role `boss` → **BossCommandPanel**
- any other agent role → **AgentActivityPanel(agentId)**
- object `panelTarget` → the matching panel (table in §7)
- `exit` → the exit-flow (confirm → lobby), not a dock panel
- unknown key → a graceful "panel not implemented" fallback in the dock

Note: the Phase 0 floor config already carries the routing keys
(`hypothesis-pipeline`, `backtest-summary`, `bot-health`, `knowledge-base`,
`infra-status`, `exit`) and the Boss is a clickable agent — so no floor-config
change is needed to wire panels.

### Production layout (NOT preview chrome)

- **No `DebugCard`.**
- **No hintbar/footer** by default.
- The floor uses the **app layout** (topbar + stage + right dock), not the
  preview shell.
- Panels live in the **right dock**; surrounding empty space may be used for
  panels/background as the layout sees fit.
- `examples/trading-lab-research-floor` remains the **technical preview** (it
  keeps its `DebugCard` and hintbar); the production shell does not reuse them.

## 7. Panel inventory (mock-first)

`PanelChrome` provides a shared header + close for every panel. Each panel has
`loading` / `empty` / `error` states fed by the gateway.

| Trigger | panelTarget / source | Panel | Mock content |
| --- | --- | --- | --- |
| Boss/Orchestrator (agent) | role `boss` | **BossCommandPanel** | chat transcript + input + command chips; `sendBossCommand` appends a canned response; visible badge `MOCK · no execution authority` |
| Any other agent | `agent-activity` | **AgentActivityPanel** | status pill (live from store), current task, scrollable logs/traces |
| Hypothesis Board | `hypothesis-pipeline` | **HypothesisPanel** | hypotheses by stage: proposed → testing → validated/rejected |
| Wall Monitor | `backtest-summary` | **BacktestPanel** | runs table: symbol, period, PnL, Sharpe, win-rate, drawdown |
| Bot Status | `bot-health` | **BotHealthPanel** | bots: running/paused/error, uptime, last heartbeat |
| Archive Shelf | `knowledge-base` | **KnowledgePanel** | knowledge/experiment entries, filterable list |
| Server Rack / Data Node | `infra-status` | **InfraStatusPanel** | services up/down, queue depths, last sync |
| Door / Exit | `exit` | **exit-flow** | confirm "Return to lobby" → `/` (session kept) |

### `sendBossCommand` contract (locked)

`sendBossCommand` in Phase 1 is **mock-only and inert**. It may **only** append a
canned response to the mock transcript. It performs **no side effects** and **no
trading/platform actions** of any kind. The Boss panel **must** show a visible
badge: `MOCK · no execution authority`.

## 8. No-execution-authority guarantees

- The gateway is read-only except `sendBossCommand`, which is inert (§7).
- No import of or client for `trading-lab` / `trading-platform`. The
  `OfficeGateway` interface is the only boundary the browser crosses.

## 9. Out of scope (Phase 1)

Real Hono/server gateway, Postgres, real auth, real trading-lab API, SSE/WebSocket,
any execution, direct `trading-platform` access, multi-floor / elevator (the
structure is ready but only one floor ships), drag-and-drop editor, walking
animations.

## 10. Tests & verification (lightweight)

Unit tests (Vitest) on pure logic only:

- `OfficeRuntimeStore`
- `MockOfficeGateway` (contract / fixtures shape)
- `panelRegistry` (route → panel resolution)
- session reducer / `RequireSession` guard

**No heavy Pixi integration tests in Phase 1.** The Pixi-integrated `FloorScreen`
is verified by a smoke check + manual in-browser verification (as the example is).

## 11. Suggested build order (within Phase 1)

1. Extract `packages/trading-lab-floor`; refactor the example onto it (green
   preview = checkpoint).
2. `apps/web` skeleton: Vite, router, session, AppShell, outside screen + login.
3. `FloorScreen` + `OfficeSceneCanvas` + selection↔route↔camera reconciliation.
4. Data layer: gateway / mock / store / bridge-seam + fixtures.
5. `PanelDock` + `panelRegistry` + the seven panels + exit-flow.
6. Topbar (theme toggle, sim toggle, logout), error states, polish.

## Open implementation details (resolved in the plan, not blockers)

- Exact asset-sync mechanism (zero-dep script vs `vite-plugin-static-copy`).
- `vite resolve.dedupe` list for `pixi.js` / `react` / `react-dom` / kit (mirror
  the example's vite config).
- Fixture depth per panel (kept modest but plausible).
- Whether the exterior generator reuses `trading-lab-floor` png/palette `lib/`
  helpers or stays self-contained in `apps/web/tools/`.
