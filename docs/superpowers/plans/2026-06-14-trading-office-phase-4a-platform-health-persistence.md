# Phase 4a — Platform health-snapshot persistence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back the trading-platform Ops Read `runtime-health` / `market-health` / `source-coverage` resources with real data via a PG health-snapshot channel, and add a read-only `execution-health` activity-proxy — keeping the market-service core DB-free and never fabricating health.

**Architecture:** Live processes write compact health snapshots to a new `canonical.platform_health_snapshot` table (latest-state upsert). The runtime process computes its snapshot by running the *existing* health-gate pipeline over its own bounded JSONL window (A1). The market-service stays DB-free: it publishes through an optional `HealthSnapshotSink` port whose PG implementation is wired only at the bin when `DATABASE_URL` + `MARKET_HEALTH_PERSIST` are set (mirrors `attachDecisionLogCapability`). The Ops Read process swaps three stub readers for PG readers and adds an `execution-health` resource derived from existing `operational_event` rows. Honesty is preserved: no fresh snapshot → `availability:'unavailable'`; gate unbuildable → no fake `ok`.

**Tech Stack:** TypeScript 6 (NodeNext ESM, build-to-`dist`), `pg` (node-postgres), Hono ops server. **No vitest/jest** — tests are hermetic gate scripts (`scripts/verify_4a_*.mjs`) over the existing `scripts/_033_harness.mjs`, run as `npm run build && node scripts/verify_4a_*.mjs`.

---

## Conventions (read before starting)

- **Repo:** ALL paths below are relative to the `trading-platform` repo root: `/home/alexxxnikolskiy/projects/trading-platform`. The design doc lives in the *trading-office* repo; the code is in *trading-platform*. Do the work on a fresh trading-platform branch: `git -C /home/alexxxnikolskiy/projects/trading-platform checkout -b phase-4a-platform-health-persistence`.
- **Spec (source of truth):** `/home/alexxxnikolskiy/projects/trading-office/docs/superpowers/specs/2026-06-14-trading-office-phase-4a-platform-health-persistence-design.md`.
- **Test model = gate scripts.** There is no test runner. Each "test" is an ESM script under `scripts/` that imports compiled `dist/` and `process.exit(1)` on failure. The loop is always: write the gate → `npm run build` → `node scripts/verify_4a_<x>.mjs` (expect FAIL) → implement → `npm run build` → run again (expect `OK`). `npm run build` = `tsc && npm run build:sandbox-harness`; you MUST build before running any gate.
- **Harness helpers** (`scripts/_033_harness.mjs`, already exists; leading underscore keeps it out of the gate glob):
  - `distUrl(rel)` → file URL under `dist/src/` (e.g. `distUrl('canonical/writers/platform_health_snapshot_writer.js')`); `process.exit`s with a "run `npm run build` first" message if missing.
  - `loadModules()` → `{ ops }` where `ops = import(dist/src/operations/index.js)` (the barrel).
  - `makeOpsHarness({ ops }, { startClock?, configOverrides?, readers?, pool? })` → `{ ops, service, ctx, state, ... }`. `state.clock` is the mock clock; `service` is an `OperationsReadService`; `ctx` is `ANONYMOUS_LOCAL`. Inject fake readers via `readers:{ runtimeHealth:{ async read(){...} }, ... }`.
  - `makeChecker(gateName)` → `{ check(name,cond), finish(okMsg, cleanup?) }`. `finish` prints `OK`/`FAIL` and exits 1 on any failed check.
- **Barrel:** any new file under `src/operations/**` that a gate imports via `ops.*` MUST be re-exported in `src/operations/index.ts` (`export * from './...'`), or `ops.getExecutionHealth` etc. will be `undefined`. `bin/` and `adapters/` are deliberately NOT in the barrel.
- **Fake pool** (for writer/reader gates, no DB): a plain object `{ async query(sql, params){ calls.push({sql,params}); return { rows: <canned> }; } }` typed-cast to the `Pool` the factory expects.
- **CI registration:** add a `gates:4a` script to `package.json` chaining every `verify_4a_*.mjs` (Task 16). PG round-trip gates (Task 15) are gated on `DATABASE_URL` and skip cleanly when unset.
- **Honesty invariant (non-negotiable):** source unavailability ⇒ `availability:'unavailable'` data, never an `OpsError`; gate-unbuildable ⇒ skip write (no fake `ok`). `internal_read_error` is only for unexpected surface failures.

---

## File Structure

**New files (trading-platform):**
- `migrations/canonical/0018_create_platform_health_snapshot.sql` — channel table + `app` grants.
- `src/canonical/writers/platform_health_snapshot_writer.ts` — shared upsert writer.
- `src/health/health_gate.ts` — extracted `evaluateHealthGate` + `Check`/`EventState` (pure).
- `src/health/event_scan.ts` — extracted `analyzeEvents`/`buildChecks` + helpers (bounded JSONL scan).
- `src/runtime/health/runtime_health_snapshotter.ts` — periodic tick (gate → writer).
- `src/runtime/health/gate_indicators.ts` — `computeIndicators` over own bounded JSONL.
- `src/operations/sources/execution-health-reader.ts` — execution activity-proxy reader + derive.
- `src/operations/handlers/get-execution-health.ts` — execution-health handler.
- `src/market/health/health_snapshot_sink.ts` — `HealthSnapshotSink` port + `noopHealthSnapshotSink` (market core; **no pg import**).
- `src/canonical/adapter/pg_health_snapshot_sink.ts` — `createPgHealthSnapshotSink` + `makeHealthSnapshotSink(env)` (composition-boundary only).
- `scripts/verify_4a_*.mjs` — one gate per component.

**Modified files:**
- `scripts/check_runtime_health.ts` — import from `src/health/*`; guard top-level `main()`.
- `src/operations/sources/runtime-health-reader.ts` — add `createPgRuntimeHealthReader`.
- `src/operations/sources/market-health-reader.ts` — add `createPgMarketHealthReader`.
- `src/operations/sources/source-coverage-reader.ts` — add `createPgSourceCoverageReader`.
- `src/operations/dto.ts` — add `ExecutionActivityHealthSnapshot`.
- `src/operations/handlers/discover.ts` — add `execution-health` to `OPS_RESOURCE_CATALOG`.
- `src/operations/dispatch.ts` — add `'execution-health': getExecutionHealth`.
- `src/operations/index.ts` — `export *` the new reader/handler/dto.
- `src/operations/bin/start-ops-read.ts` — swap 3 stubs → PG readers; add `executionHealth`.
- `src/market/service/market_data_service.ts` — accept optional `sink`; `publishMarket` in `startHeartbeat`.
- `src/market/service/finalization/coverage_emitter.ts` — `publishCoverage` from `flushSummary`.
- `src/app/run_long_oi.ts`, `src/app/run_short_oi.ts` — start the snapshotter.
- `src/app/run_market_data_service.ts` — wire the gated sink.
- `package.json` — `gates:4a` script.

> **Staleness semantics (locked for this plan):** a reader returns `null` when there is **no row OR the latest row is stale** (`captured_at_ms` older than `PLATFORM_HEALTH_STALENESS_MS`). `null` → handler `availability:'unavailable'`. The office renders `unavailable` as a gap, so a dead writer is visible. (This slightly tightens the spec's "degraded/down" wording for the writer-death case to "unavailable"; it is honest and needs no handler change.)

---

# Milestone M0 — the channel

## Task 1: Migration — `canonical.platform_health_snapshot`

**Files:**
- Create: `migrations/canonical/0018_create_platform_health_snapshot.sql`
- Test: `scripts/verify_4a_migration.mjs`

- [ ] **Step 1: Write the failing gate** (string assertions over the SQL file — the migrator applies it for real in Task 15)

`scripts/verify_4a_migration.mjs`:
```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { makeChecker } from './_033_harness.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(resolve(REPO, 'migrations/canonical/0018_create_platform_health_snapshot.sql'), 'utf8');
const c = makeChecker('verify_4a_migration');
c.check('creates the table', /CREATE TABLE\s+canonical\.platform_health_snapshot/i.test(sql));
c.check('schema_version is a column with default 1', /schema_version\s+SMALLINT\s+NOT NULL\s+DEFAULT\s+1/i.test(sql));
c.check('has domain/source/captured_at_ms/payload columns', /\bdomain\b[\s\S]*\bsource\b[\s\S]*\bcaptured_at_ms\b[\s\S]*\bpayload\b/i.test(sql));
c.check('PK is (domain, source)', /PRIMARY KEY\s*\(\s*domain\s*,\s*source\s*\)/i.test(sql));
c.check('grants INSERT, SELECT, UPDATE to app', /GRANT\s+INSERT,\s*SELECT,\s*UPDATE\s+ON\s+canonical\.platform_health_snapshot\s+TO\s+app/i.test(sql));
c.finish('migration 0018 shape + grants present');
```

- [ ] **Step 2: Run, expect FAIL**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && node scripts/verify_4a_migration.mjs`
Expected: throws (file not found) — that's the failing state.

- [ ] **Step 3: Write the migration**

`migrations/canonical/0018_create_platform_health_snapshot.sql`:
```sql
-- Phase 4a: platform health-snapshot persistence channel (latest-state upsert).
-- One row per (domain, source). schema_version is a real column so the payload
-- contract can evolve unambiguously; readers accept v1.
CREATE TABLE canonical.platform_health_snapshot (
  domain         TEXT     NOT NULL,
  source         TEXT     NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 1,
  captured_at_ms BIGINT   NOT NULL,
  payload        JSONB    NOT NULL,
  updated_at_ms  BIGINT   NOT NULL DEFAULT (extract(epoch FROM now()) * 1000)::BIGINT,
  PRIMARY KEY (domain, source)
);

-- Runtime + market processes upsert; ops-read reads. Mirror the canonical.trade grant
-- (upsert needs INSERT + UPDATE; SELECT for read-back / ops-read).
GRANT INSERT, SELECT, UPDATE ON canonical.platform_health_snapshot TO app;
```

- [ ] **Step 4: Build + run, expect OK**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && node scripts/verify_4a_migration.mjs`
Expected: `verify_4a_migration: OK (migration 0018 shape + grants present)` (no build needed — pure file read).

- [ ] **Step 5: Commit**

```bash
git add migrations/canonical/0018_create_platform_health_snapshot.sql scripts/verify_4a_migration.mjs
git commit -m "feat(canonical): add platform_health_snapshot migration (4a M0)"
```

## Task 2: `PlatformHealthSnapshotWriter` (upsert)

**Files:**
- Create: `src/canonical/writers/platform_health_snapshot_writer.ts`
- Test: `scripts/verify_4a_writer.mjs`

- [ ] **Step 1: Write the failing gate** (fake pool captures the SQL + params)

`scripts/verify_4a_writer.mjs`:
```js
import { distUrl, makeChecker } from './_033_harness.mjs';

const { createPlatformHealthSnapshotWriter } = await import(distUrl('canonical/writers/platform_health_snapshot_writer.js'));
const c = makeChecker('verify_4a_writer');

const calls = [];
const fakePool = { async query(sql, params) { calls.push({ sql, params }); return { rows: [] }; } };
const writer = createPlatformHealthSnapshotWriter(fakePool);

await writer.writeSnapshot({ domain: 'runtime', source: 'long_oi', schemaVersion: 1, capturedAtMs: 1700, payload: { ready: true } });

c.check('one query issued', calls.length === 1);
c.check('uses INSERT ... ON CONFLICT (domain, source) DO UPDATE', /INSERT INTO canonical\.platform_health_snapshot[\s\S]*ON CONFLICT \(domain, source\) DO UPDATE/i.test(calls[0].sql));
c.check('casts payload to jsonb', /\$5::jsonb/.test(calls[0].sql));
c.check('binds domain/source/schema/capturedAt', calls[0].params[0] === 'runtime' && calls[0].params[1] === 'long_oi' && calls[0].params[2] === 1 && calls[0].params[3] === 1700);
c.check('payload bound as JSON string', calls[0].params[4] === JSON.stringify({ ready: true }));
c.finish('writer upserts with correct SQL + params');
```

- [ ] **Step 2: Build + run, expect FAIL**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_writer.mjs`
Expected: build fails / import undefined — failing state.

- [ ] **Step 3: Implement the writer**

`src/canonical/writers/platform_health_snapshot_writer.ts`:
```ts
import type { Pool } from '../pg/pool.js';

export type PlatformHealthDomain = 'runtime' | 'market' | 'coverage';

export interface PlatformHealthSnapshotInput {
  readonly domain: PlatformHealthDomain;
  readonly source: string;
  readonly schemaVersion: number;
  readonly capturedAtMs: number;
  readonly payload: Record<string, unknown>;
}

export interface PlatformHealthSnapshotWriter {
  writeSnapshot(input: PlatformHealthSnapshotInput): Promise<void>;
}

const UPSERT_SQL = `INSERT INTO canonical.platform_health_snapshot
  (domain, source, schema_version, captured_at_ms, payload, updated_at_ms)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (domain, source) DO UPDATE SET
  schema_version = EXCLUDED.schema_version,
  captured_at_ms = EXCLUDED.captured_at_ms,
  payload        = EXCLUDED.payload,
  updated_at_ms  = EXCLUDED.updated_at_ms`;

export function createPlatformHealthSnapshotWriter(pool: Pool): PlatformHealthSnapshotWriter {
  return {
    async writeSnapshot(input) {
      await pool.query(UPSERT_SQL, [
        input.domain,
        input.source,
        input.schemaVersion,
        input.capturedAtMs,
        JSON.stringify(input.payload),
        Date.now(),
      ]);
    },
  };
}
```

- [ ] **Step 4: Build + run, expect OK**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_writer.mjs`
Expected: `verify_4a_writer: OK (writer upserts with correct SQL + params)`

- [ ] **Step 5: Commit**

```bash
git add src/canonical/writers/platform_health_snapshot_writer.ts scripts/verify_4a_writer.mjs
git commit -m "feat(canonical): platform_health_snapshot upsert writer (4a M0)"
```

---

# Milestone M1 — runtime half + execution-health

## Task 3: Extract the health-gate pipeline into `src/health/`

**Goal:** make `evaluateHealthGate` + the scanners importable without launching the CLI, and add a bounded read. `evaluateHealthGate` is pure (reads `Check[]` + `ctx.events.{parsedLines,aggregatorSummaryCount}`); `analyzeEvents`/`buildChecks` do file I/O.

**Files:**
- Create: `src/health/health_gate.ts`, `src/health/event_scan.ts`
- Modify: `scripts/check_runtime_health.ts`
- Test: `scripts/verify_4a_gate_parity.mjs`

- [ ] **Step 1: Write the failing parity gate** (extracted gate yields the documented booleans for hand-built `Check[]`)

`scripts/verify_4a_gate_parity.mjs`:
```js
import { distUrl, makeChecker } from './_033_harness.mjs';

const { evaluateHealthGate } = await import(distUrl('health/health_gate.js'));
const c = makeChecker('verify_4a_gate_parity');

const mk = (id, status) => ({ id, title: id, optional: false, status, message: '', details: null });
const okIds = ['oi_flow','pipeline_feed','service_start','bot_start','snapshot_minute_path','service_stage3','minute_context_nonzero','log_integrity'];
const allOk = okIds.map((id) => mk(id, id === 'oi_flow' ? 'OK' : 'OK'));
const freshEvents = { parsedLines: 10, aggregatorSummaryCount: 2 };

const ready = evaluateHealthGate(allOk, { events: freshEvents });
c.check('all-OK + fresh ⇒ ready', ready.ready === true && ready.serviceOk === true && ready.botOk === true && ready.freshnessOk === true);

const noData = evaluateHealthGate(allOk, { events: { parsedLines: 0, aggregatorSummaryCount: 0 } });
c.check('no parsed lines ⇒ freshnessOk false ⇒ not ready', noData.freshnessOk === false && noData.ready === false);

const serviceFail = evaluateHealthGate(allOk.map((x) => x.id === 'service_start' ? mk('service_start','FAIL') : x), { events: freshEvents });
c.check('service_start FAIL ⇒ serviceOk false', serviceFail.serviceOk === false && serviceFail.ready === false);

c.finish('extracted evaluateHealthGate matches documented gate logic');
```

- [ ] **Step 2: Build + run, expect FAIL**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_gate_parity.mjs`
Expected: import of `health/health_gate.js` fails.

- [ ] **Step 3: Create `src/health/health_gate.ts`** — move the pure gate + its types out of `scripts/check_runtime_health.ts` verbatim

```ts
export interface Check {
  id: string;
  title: string;
  optional: boolean;
  status: string;
  message: string;
  details: unknown;
}

// Only the fields evaluateHealthGate reads. event_scan produces the full EventState;
// this Pick keeps the gate decoupled from the scanner's large shape.
export interface GateEventState {
  parsedLines?: number;
  aggregatorSummaryCount?: number;
}

export function evaluateHealthGate(
  checks: Check[],
  ctx: { events: GateEventState },
): Record<string, boolean> {
  const byId = new Map(checks.map((c) => [c.id, c]));
  const oi = byId.get('oi_flow');
  const pipeline = byId.get('pipeline_feed');
  const serviceStart = byId.get('service_start');
  const botStart = byId.get('bot_start');
  const snapshotPath = byId.get('snapshot_minute_path');
  const serviceStage3 = byId.get('service_stage3');
  const minuteNonZero = byId.get('minute_context_nonzero');
  const eventsIntegrity = byId.get('log_integrity');
  const healthOk = oi && oi.status === 'OK';
  const pipelineOk = pipeline && pipeline.status !== 'FAIL';
  const serviceOk = serviceStart && serviceStart.status !== 'FAIL';
  const botOk = botStart && botStart.status !== 'FAIL';
  const snapshotPathOk = snapshotPath && snapshotPath.status !== 'FAIL';
  const serviceStage3Ok = serviceStage3 && serviceStage3.status !== 'FAIL';
  const minuteNonZeroOk = minuteNonZero && minuteNonZero.status !== 'FAIL';
  const prereqOk = eventsIntegrity && eventsIntegrity.status !== 'FAIL';
  const hasNewData = Number(ctx?.events?.parsedLines || 0) > 0;
  const hasFreshHealthSummary = Number(ctx?.events?.aggregatorSummaryCount || 0) > 0;
  const freshnessOk = hasNewData && hasFreshHealthSummary;
  return {
    ready: !!(healthOk && prereqOk && freshnessOk && pipelineOk && serviceOk && botOk && snapshotPathOk && serviceStage3Ok && minuteNonZeroOk),
    healthOk: !!healthOk, prereqOk: !!prereqOk, freshnessOk: !!freshnessOk,
    pipelineOk: !!pipelineOk, serviceOk: !!serviceOk, botOk: !!botOk,
    snapshotPathOk: !!snapshotPathOk, serviceStage3Ok: !!serviceStage3Ok,
    minuteNonZeroOk: !!minuteNonZeroOk, hasHardFail: false,
  };
}
```

- [ ] **Step 4: Create `src/health/event_scan.ts`** — move `analyzeEvents`, `buildChecks`, and their helpers (`makeCheck`, `setCheck`, `parseJsonLine`, `percentile`, `toNum`, `maybeTs`, `maxOiFreshAcrossExchanges`, `mergeServiceTelemetry`, `CheckArgs`, full `EventState`) out of `check_runtime_health.ts`. Add a **bounded** entrypoint that tails at most `maxBytes` and applies a `timeoutMs`:

```ts
import { readFile, stat, open } from 'node:fs/promises';
// ... (moved EventState, Check re-export from ./health_gate.js, CheckArgs, helpers, analyzeEvents, buildChecks verbatim) ...
export type { Check } from './health_gate.js';

export async function analyzeEventsBounded(
  eventsPath: string,
  opts: { maxBytes: number; timeoutMs: number },
): Promise<EventState> {
  const run = (async () => {
    const { size } = await stat(eventsPath);
    const start = Math.max(0, size - opts.maxBytes);
    const fh = await open(eventsPath, 'r');
    try {
      const buf = Buffer.alloc(size - start);
      await fh.read(buf, 0, buf.length, start);
      // Drop a partial first line when tailing from a mid-file offset.
      const text = start > 0 ? buf.toString('utf8').slice(buf.indexOf(0x0a) + 1) : buf.toString('utf8');
      return analyzeEventLines(text.split('\n')); // analyzeEvents factored to accept lines
    } finally {
      await fh.close();
    }
  })();
  return Promise.race([
    run,
    new Promise<EventState>((_, rej) => setTimeout(() => rej(new Error('analyzeEventsBounded timeout')), opts.timeoutMs)),
  ]);
}
```
> Note (M1 calibration): factor the existing `analyzeEvents(path, startLine)` so its line-parsing core is reusable as `analyzeEventLines(lines)`; `analyzeEventsBounded` feeds it the tail slice. Confirm the exact `CheckArgs` shape `buildChecks` needs while moving it (the extractor reported `buildChecks({ args: CheckArgs; events: EventState; bundleLabel: string })`).

- [ ] **Step 5: Update `scripts/check_runtime_health.ts`** — import from the new modules; guard the CLI launch

Replace the now-moved declarations with imports, and guard the top-level call:
```ts
import { pathToFileURL } from 'node:url';
import { evaluateHealthGate, type Check } from '../src/health/health_gate.js';
import { analyzeEvents, buildChecks, /* helpers used by main */ } from '../src/health/event_scan.js';
// ... existing main() unchanged ...
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 6: Build + run, expect OK**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_gate_parity.mjs`
Expected: `verify_4a_gate_parity: OK (...)`

- [ ] **Step 7: Sanity — the CLI still runs**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && node dist/scripts/check_runtime_health.js --help 2>&1 | head -5` (or its usual invocation)
Expected: same behavior as before the extraction (CLI launches; importing the modules in the gate did NOT launch it).

- [ ] **Step 8: Commit**

```bash
git add src/health/health_gate.ts src/health/event_scan.ts scripts/check_runtime_health.ts scripts/verify_4a_gate_parity.mjs
git commit -m "refactor(health): extract evaluateHealthGate + scanners into importable src/health (4a M1)"
```

## Task 4: `computeIndicators` (gate over own bounded JSONL) + snapshotter

**Files:**
- Create: `src/runtime/health/gate_indicators.ts`, `src/runtime/health/runtime_health_snapshotter.ts`
- Test: `scripts/verify_4a_snapshotter.mjs`

- [ ] **Step 1: Write the failing gate** (fake `computeIndicators` + fake writer; assert tick behavior, no-fake-ok, swallow)

`scripts/verify_4a_snapshotter.mjs`:
```js
import { distUrl, makeChecker } from './_033_harness.mjs';

const { createRuntimeHealthSnapshotter } = await import(distUrl('runtime/health/runtime_health_snapshotter.js'));
const c = makeChecker('verify_4a_snapshotter');

const writes = [];
const writer = { async writeSnapshot(x) { writes.push(x); } };
const logger = { event() {} };
const indicators = { ready: true, freshnessOk: true, pipelineOk: true, serviceOk: true, botOk: true };

// happy path
const s1 = createRuntimeHealthSnapshotter({ botId: 'long_oi', writer, computeIndicators: async () => indicators, now: () => 4242, errorLogger: logger });
await s1.tickOnce();
c.check('writes one runtime snapshot', writes.length === 1 && writes[0].domain === 'runtime' && writes[0].source === 'long_oi');
c.check('schemaVersion 1, capturedAt from now()', writes[0].schemaVersion === 1 && writes[0].capturedAtMs === 4242);
c.check('payload carries indicators', writes[0].payload.ready === true && writes[0].payload.serviceOk === true);

// gate-unbuildable ⇒ NO fake ok (skip write)
writes.length = 0;
const s2 = createRuntimeHealthSnapshotter({ botId: 'long_oi', writer, computeIndicators: async () => null, errorLogger: logger });
await s2.tickOnce();
c.check('null indicators ⇒ no write (no fake ok)', writes.length === 0);

// computeIndicators throws ⇒ swallowed, no write, no crash
const s3 = createRuntimeHealthSnapshotter({ botId: 'long_oi', writer, computeIndicators: async () => { throw new Error('boom'); }, errorLogger: logger });
await s3.tickOnce();
c.check('throw ⇒ swallowed, no write', writes.length === 0);

c.finish('snapshotter writes on success, skips on null/throw (no fake ok)');
```

- [ ] **Step 2: Build + run, expect FAIL**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_snapshotter.mjs`
Expected: import fails.

- [ ] **Step 3: Implement the snapshotter**

`src/runtime/health/runtime_health_snapshotter.ts`:
```ts
import type { PlatformHealthSnapshotWriter } from '../../canonical/writers/platform_health_snapshot_writer.js';
import type { RuntimeHealthIndicators } from '../../operations/dto.js';

export interface RuntimeHealthSnapshotterDeps {
  readonly botId: string;
  readonly writer: PlatformHealthSnapshotWriter;
  readonly computeIndicators: () => Promise<RuntimeHealthIndicators | null>;
  readonly errorLogger: { event(type: string, payload?: object): void };
  readonly intervalMs?: number;
  readonly now?: () => number;
}

export interface RuntimeHealthSnapshotter {
  start(): void;
  stop(): void;
  tickOnce(): Promise<void>;
}

export function createRuntimeHealthSnapshotter(deps: RuntimeHealthSnapshotterDeps): RuntimeHealthSnapshotter {
  const now = deps.now ?? (() => Date.now());
  const intervalMs = deps.intervalMs ?? Number(process.env.PLATFORM_HEALTH_SNAPSHOT_INTERVAL_MS ?? 30_000);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tickOnce(): Promise<void> {
    let indicators: RuntimeHealthIndicators | null = null;
    try {
      indicators = await deps.computeIndicators();
    } catch (err) {
      deps.errorLogger.event('runtime_health_gate_error', { error: err instanceof Error ? err.message : String(err) });
      return; // no fake ok
    }
    if (indicators === null) return; // gate unbuildable ⇒ skip; row goes stale ⇒ reader unavailable
    try {
      await deps.writer.writeSnapshot({
        domain: 'runtime',
        source: deps.botId,
        schemaVersion: 1,
        capturedAtMs: now(),
        payload: indicators as unknown as Record<string, unknown>,
      });
    } catch (err) {
      deps.errorLogger.event('runtime_health_write_error', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    tickOnce,
    start() {
      if (timer) return;
      timer = setInterval(() => { void tickOnce(); }, intervalMs);
      timer.unref();
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } },
  };
}
```

- [ ] **Step 4: Implement `gate_indicators.ts`** (wires the extracted pipeline; bounded)

`src/runtime/health/gate_indicators.ts`:
```ts
import { analyzeEventsBounded, buildChecks } from '../../health/event_scan.js';
import { evaluateHealthGate } from '../../health/health_gate.js';
import type { RuntimeHealthIndicators } from '../../operations/dto.js';

export interface GateIndicatorsOptions {
  readonly eventsFile: string;
  readonly checkArgs: unknown; // CheckArgs from event_scan; confirm shape in M1
  readonly maxBytes?: number;
  readonly timeoutMs?: number;
}

export function makeGateIndicators(opts: GateIndicatorsOptions): () => Promise<RuntimeHealthIndicators | null> {
  const maxBytes = opts.maxBytes ?? Number(process.env.PLATFORM_HEALTH_RUNTIME_GATE_MAX_BYTES ?? 2_000_000);
  const timeoutMs = opts.timeoutMs ?? 5_000;
  return async () => {
    try {
      const events = await analyzeEventsBounded(opts.eventsFile, { maxBytes, timeoutMs });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checks = buildChecks({ args: opts.checkArgs as any, events, bundleLabel: 'runtime-health-snapshot' });
      const gate = evaluateHealthGate(checks, { events });
      return {
        ready: gate.ready,
        freshnessOk: gate.freshnessOk,
        pipelineOk: gate.pipelineOk,
        serviceOk: gate.serviceOk,
        botOk: gate.botOk,
      };
    } catch {
      return null; // unreadable / parse / timeout ⇒ no fake ok
    }
  };
}
```

- [ ] **Step 5: Build + run, expect OK**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_snapshotter.mjs`
Expected: `verify_4a_snapshotter: OK (...)`

- [ ] **Step 6: Commit**

```bash
git add src/runtime/health/ scripts/verify_4a_snapshotter.mjs
git commit -m "feat(runtime): runtime health snapshotter over own bounded JSONL (4a M1)"
```

## Task 5: Wire the snapshotter into the runtime bins

**Files:**
- Modify: `src/app/run_long_oi.ts`, `src/app/run_short_oi.ts`

- [ ] **Step 1: Add the wiring** (after `bootstrapBotRun`; uses `botRun.pool`; `.unref()`d so it never blocks shutdown). Verified by a build + a manual smoke (no hermetic gate — it needs a running bot + log).

In `run_long_oi.ts` `main()`, after `const botRun = await bootstrapBotRun({ botId: 'long_oi', cfg });` and once `cfg.logs.eventsFile` is known:
```ts
import { createPlatformHealthSnapshotWriter } from '../canonical/writers/platform_health_snapshot_writer.js';
import { createRuntimeHealthSnapshotter } from '../runtime/health/runtime_health_snapshotter.js';
import { makeGateIndicators } from '../runtime/health/gate_indicators.js';
// ...
const healthSnapshotter = createRuntimeHealthSnapshotter({
  botId: 'long_oi',
  writer: createPlatformHealthSnapshotWriter(botRun.pool),
  computeIndicators: makeGateIndicators({ eventsFile: cfg.logs.eventsFile, checkArgs: /* same args main() uses */ undefined }),
  errorLogger: appLogger,
});
healthSnapshotter.start();
```
Repeat identically in `run_short_oi.ts` with `botId: 'short_oi'`.

> Note: the bin has no `finally`; the `.unref()`'d interval dies with the process. If `registerShutdownHandler` exposes a cleanup-registration API (confirm its body), also register `healthSnapshotter.stop()`; otherwise relying on process exit + `.unref()` is acceptable.

- [ ] **Step 2: Build, expect clean typecheck**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build`
Expected: `tsc` passes (no type errors from the new wiring).

- [ ] **Step 3: Commit**

```bash
git add src/app/run_long_oi.ts src/app/run_short_oi.ts
git commit -m "feat(runtime): start health snapshotter in long/short oi bins (4a M1)"
```

## Task 6: `createPgRuntimeHealthReader` + un-stub

**Files:**
- Modify: `src/operations/sources/runtime-health-reader.ts`, `src/operations/bin/start-ops-read.ts`
- Test: `scripts/verify_4a_runtime_reader.mjs`

- [ ] **Step 1: Write the failing gate** (fake pool rows → worst-of + staleness + schema_version; then through the handler for null→unavailable)

`scripts/verify_4a_runtime_reader.mjs`:
```js
import { distUrl, loadModules, makeOpsHarness, makeChecker } from './_033_harness.mjs';

const { createPgRuntimeHealthReader } = await import(distUrl('operations/sources/runtime-health-reader.js'));
const { ops } = await loadModules();
const c = makeChecker('verify_4a_runtime_reader');
const now = () => 100_000;
const ind = (o) => ({ ready: true, freshnessOk: true, pipelineOk: true, serviceOk: true, botOk: true, ...o });

// worst-of across two fresh sources
const poolWorst = { async query() { return { rows: [
  { source: 'long_oi', schema_version: 1, captured_at_ms: '99000', payload: ind({}) },
  { source: 'short_oi', schema_version: 1, captured_at_ms: '99000', payload: ind({ serviceOk: false }) },
] }; } };
const r1 = await createPgRuntimeHealthReader(poolWorst, now, 120_000).read();
c.check('worst-of ANDs indicators', r1 && r1.serviceOk === false && r1.ready === false && r1.botOk === true);

// all stale ⇒ null
const poolStale = { async query() { return { rows: [{ source: 'long_oi', schema_version: 1, captured_at_ms: '1000', payload: ind({}) }] }; } };
c.check('stale rows ⇒ null', (await createPgRuntimeHealthReader(poolStale, now, 120_000).read()) === null);

// unknown schema_version ignored ⇒ null
const poolV2 = { async query() { return { rows: [{ source: 'long_oi', schema_version: 2, captured_at_ms: '99000', payload: ind({}) }] }; } };
c.check('unknown schema_version ⇒ null', (await createPgRuntimeHealthReader(poolV2, now, 120_000).read()) === null);

// through the handler: null reader ⇒ availability unavailable
const h = makeOpsHarness({ ops }, { startClock: 100_000, readers: { runtimeHealth: createPgRuntimeHealthReader(poolStale, now, 120_000) } });
const snap = await ops.getRuntimeHealth(h.service, {}, h.ctx);
c.check('handler maps null ⇒ unavailable', snap.availability === 'unavailable' && snap.status === 'down');

c.finish('runtime PG reader: worst-of, staleness, schema gate, handler unavailable');
```

- [ ] **Step 2: Build + run, expect FAIL**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_runtime_reader.mjs`
Expected: `createPgRuntimeHealthReader` undefined.

- [ ] **Step 3: Add the reader** to `src/operations/sources/runtime-health-reader.ts` (append; keep the existing interface/derive/down-const)

```ts
import type { Pool } from '../../canonical/pg/pool.js';
import type { RuntimeHealthIndicators } from '../dto.js';

interface RuntimeSnapshotRow {
  readonly source: string;
  readonly schema_version: number;
  readonly captured_at_ms: string;
  readonly payload: RuntimeHealthIndicators;
}

const RUNTIME_SELECT_SQL =
  `SELECT source, schema_version, captured_at_ms, payload
   FROM canonical.platform_health_snapshot WHERE domain = 'runtime'`;

export function createPgRuntimeHealthReader(
  pool: Pool,
  now: () => number = () => Date.now(),
  staleMs: number = Number(process.env.PLATFORM_HEALTH_STALENESS_MS ?? 120_000),
): RuntimeHealthReader {
  return {
    async read(): Promise<RuntimeHealthIndicators | null> {
      const { rows } = await pool.query<RuntimeSnapshotRow>(RUNTIME_SELECT_SQL);
      const t = now();
      const fresh = rows.filter((r) => r.schema_version === 1 && t - Number(r.captured_at_ms) <= staleMs);
      if (fresh.length === 0) return null;
      return fresh.reduce<RuntimeHealthIndicators>(
        (acc, r) => ({
          ready: acc.ready && !!r.payload.ready,
          freshnessOk: acc.freshnessOk && !!r.payload.freshnessOk,
          pipelineOk: acc.pipelineOk && !!r.payload.pipelineOk,
          serviceOk: acc.serviceOk && !!r.payload.serviceOk,
          botOk: acc.botOk && !!r.payload.botOk,
        }),
        { ready: true, freshnessOk: true, pipelineOk: true, serviceOk: true, botOk: true },
      );
    },
  };
}
```

- [ ] **Step 4: Un-stub in `src/operations/bin/start-ops-read.ts`**

Add import: `import { createPgRuntimeHealthReader } from '../sources/runtime-health-reader.js';`
In the `readers` object: replace `runtimeHealth: unavailableRuntimeHealth,` with `runtimeHealth: createPgRuntimeHealthReader(pool),`.

- [ ] **Step 5: Build + run, expect OK**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_runtime_reader.mjs`
Expected: `verify_4a_runtime_reader: OK (...)`

- [ ] **Step 6: Commit**

```bash
git add src/operations/sources/runtime-health-reader.ts src/operations/bin/start-ops-read.ts scripts/verify_4a_runtime_reader.mjs
git commit -m "feat(ops-read): PG runtime-health reader (worst-of + staleness) (4a M1)"
```

## Task 7: `execution-health` resource (activity-proxy)

**Files:**
- Modify: `src/operations/dto.ts`, `src/operations/dispatch.ts`, `src/operations/handlers/discover.ts`, `src/operations/index.ts`, `src/operations/bin/start-ops-read.ts`
- Create: `src/operations/sources/execution-health-reader.ts`, `src/operations/handlers/get-execution-health.ts`
- Test: `scripts/verify_4a_execution_health.mjs`

- [ ] **Step 1: Write the failing gate**

`scripts/verify_4a_execution_health.mjs`:
```js
import { distUrl, loadModules, makeOpsHarness, makeChecker } from './_033_harness.mjs';

const { createPgExecutionHealthReader, deriveExecutionStatus } = await import(distUrl('operations/sources/execution-health-reader.js'));
const { ops } = await loadModules();
const c = makeChecker('verify_4a_execution_health');

c.check('errors=0 ⇒ ok', deriveExecutionStatus({ lastEventMs: 1, recentRejected: 0, recentTransientErrors: 0, recentTotal: 5 }) === 'ok');
c.check('some errors ⇒ degraded', deriveExecutionStatus({ lastEventMs: 1, recentRejected: 1, recentTransientErrors: 0, recentTotal: 5 }) === 'degraded');
c.check('all errors ⇒ down', deriveExecutionStatus({ lastEventMs: 1, recentRejected: 5, recentTransientErrors: 0, recentTotal: 5 }) === 'down');

const poolActive = { async query() { return { rows: [{ last_event_ms: '999', rejected: '1', transient_errors: '0', total: '4' }] }; } };
const sig = await createPgExecutionHealthReader(poolActive, () => 1000, 300000).read();
c.check('reader maps counts', sig.recentTotal === 4 && sig.recentRejected === 1 && sig.lastEventMs === 999);

const poolEmpty = { async query() { return { rows: [{ last_event_ms: null, rejected: '0', transient_errors: '0', total: '0' }] }; } };
c.check('no activity ⇒ null', (await createPgExecutionHealthReader(poolEmpty, () => 1000, 300000).read()) === null);

const h = makeOpsHarness({ ops }, { startClock: 1000, readers: { executionHealth: createPgExecutionHealthReader(poolEmpty, () => 1000, 300000) } });
const snap = await ops.getExecutionHealth(h.service, {}, h.ctx);
c.check('handler null ⇒ unavailable', snap.availability === 'unavailable');
c.check('catalog advertises execution-health', ops.OPS_RESOURCE_CATALOG.some((r) => r.name === 'execution-health'));

c.finish('execution-health: derive, reader, handler unavailable, catalog');
```

- [ ] **Step 2: Build + run, expect FAIL**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_execution_health.mjs`
Expected: imports undefined.

- [ ] **Step 3: Add the DTO** to `src/operations/dto.ts`

```ts
export interface ExecutionActivityHealthSnapshot {
  readonly status: OpsHealthStatus;
  readonly lastEventMs: number | null;
  readonly recentRejected: number;
  readonly recentTransientErrors: number;
  readonly recentTotal: number;
  readonly availability: SourceAvailability;
  readonly asOf: number;
}
```

- [ ] **Step 4: Create the reader** `src/operations/sources/execution-health-reader.ts`

```ts
import type { Pool } from '../../canonical/pg/pool.js';
import type { OpsHealthStatus } from '../dto.js';

export interface ExecutionActivitySignal {
  readonly lastEventMs: number | null;
  readonly recentRejected: number;
  readonly recentTransientErrors: number;
  readonly recentTotal: number;
}
export interface ExecutionHealthReader {
  read(): Promise<ExecutionActivitySignal | null>;
}

export const DEFAULT_EXECUTION_WINDOW_MS = 300_000;

export function deriveExecutionStatus(s: ExecutionActivitySignal): OpsHealthStatus {
  const errs = s.recentRejected + s.recentTransientErrors;
  if (errs === 0) return 'ok';
  return errs >= s.recentTotal ? 'down' : 'degraded';
}

const EXEC_SQL =
  `SELECT max(inserted_at_ms)::text AS last_event_ms,
          count(*) FILTER (WHERE event_type = 'execution_rejected')        AS rejected,
          count(*) FILTER (WHERE event_type = 'execution_transient_error') AS transient_errors,
          count(*)                                                          AS total
   FROM canonical.operational_event
   WHERE event_type LIKE 'execution_%' AND inserted_at_ms >= $1`;

export function createPgExecutionHealthReader(
  pool: Pool,
  now: () => number = () => Date.now(),
  windowMs: number = DEFAULT_EXECUTION_WINDOW_MS,
): ExecutionHealthReader {
  return {
    async read(): Promise<ExecutionActivitySignal | null> {
      const { rows } = await pool.query<{ last_event_ms: string | null; rejected: string; transient_errors: string; total: string }>(
        EXEC_SQL, [now() - windowMs],
      );
      const r = rows[0];
      const total = Number(r?.total ?? 0);
      if (total === 0) return null; // honest "no recent execution activity"
      return {
        lastEventMs: r.last_event_ms === null ? null : Number(r.last_event_ms),
        recentRejected: Number(r.rejected),
        recentTransientErrors: Number(r.transient_errors),
        recentTotal: total,
      };
    },
  };
}
```

- [ ] **Step 5: Create the handler** `src/operations/handlers/get-execution-health.ts`

```ts
import type { ExecutionActivityHealthSnapshot, OpsError } from '../dto.js';
import type { OperationsReadService, OpsReadContext } from '../read-service.js';
import { deriveExecutionStatus, type ExecutionHealthReader } from '../sources/execution-health-reader.js';

export async function getExecutionHealth(
  svc: OperationsReadService,
  _args: Record<string, never>,
  ctx: OpsReadContext,
): Promise<ExecutionActivityHealthSnapshot | OpsError> {
  return svc.execute<ExecutionActivityHealthSnapshot>('execution-health', 'get', ctx, async () => {
    const reader = svc.deps.readers.executionHealth as ExecutionHealthReader | undefined;
    let sig = null;
    try { sig = reader ? await reader.read() : null; } catch { sig = null; }
    if (sig === null) {
      return { status: 'down', lastEventMs: null, recentRejected: 0, recentTransientErrors: 0, recentTotal: 0, availability: 'unavailable', asOf: svc.asOf() };
    }
    return { status: deriveExecutionStatus(sig), lastEventMs: sig.lastEventMs, recentRejected: sig.recentRejected, recentTransientErrors: sig.recentTransientErrors, recentTotal: sig.recentTotal, availability: 'available', asOf: svc.asOf() };
  });
}
```

- [ ] **Step 6: Register** — `dispatch.ts`, `discover.ts`, `index.ts`, bin

- In `src/operations/dispatch.ts`, import `getExecutionHealth` and add to `OPS_READ_HANDLERS`: `'execution-health': getExecutionHealth,`.
- In `src/operations/handlers/discover.ts`, add to `OPS_RESOURCE_CATALOG`: `{ name: 'execution-health', supportedFilters: [], pagination: null, fields: ['status', 'lastEventMs', 'recentRejected', 'recentTransientErrors', 'recentTotal', 'availability', 'asOf'] },`.
- In `src/operations/index.ts`, add: `export * from './sources/execution-health-reader.js';` and `export * from './handlers/get-execution-health.js';` (the `dto.ts` and `handlers/discover.ts` are already barreled).
- In `src/operations/bin/start-ops-read.ts`, import `createPgExecutionHealthReader` and add `executionHealth: createPgExecutionHealthReader(pool),` to the `readers` object.

- [ ] **Step 7: Build + run, expect OK**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_execution_health.mjs`
Expected: `verify_4a_execution_health: OK (...)`

- [ ] **Step 8: Commit**

```bash
git add src/operations/ scripts/verify_4a_execution_health.mjs
git commit -m "feat(ops-read): execution-health activity-proxy resource (4a M1)"
```

---

# Milestone M2 — market half (gated sink)

## Task 8: `HealthSnapshotSink` port + noop (market core, no pg)

**Files:**
- Create: `src/market/health/health_snapshot_sink.ts`
- Test: `scripts/verify_4a_sink_port.mjs`

- [ ] **Step 1: Write the failing gate** (noop no-ops; and the market source tree imports no `pg`)

`scripts/verify_4a_sink_port.mjs`:
```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { distUrl, makeChecker } from './_033_harness.mjs';

const { noopHealthSnapshotSink } = await import(distUrl('market/health/health_snapshot_sink.js'));
const c = makeChecker('verify_4a_sink_port');

c.check('noop publishMarket is a no-op', noopHealthSnapshotSink.publishMarket({ capturedAtMs: 1, diagnostics: {}, streamAgeMs: null }) === undefined);
c.check('noop publishCoverage is a no-op', noopHealthSnapshotSink.publishCoverage({ capturedAtMs: 1, signals: [] }) === undefined);

// boundary guard: nothing under src/market/** imports pg / canonical writers
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const offenders = [];
const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) { const s = readFileSync(p, 'utf8'); if (/from ['"][^'"]*\/pg\/pool|from ['"]pg['"]|canonical\/writers/.test(s)) offenders.push(p); } } };
walk(resolve(REPO, 'src/market'));
c.check(`src/market has no pg/canonical-writer import (offenders: ${offenders.join(', ')})`, offenders.length === 0);

c.finish('sink port noop + market core DB-free');
```

- [ ] **Step 2: Build + run, expect FAIL** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_sink_port.mjs`

- [ ] **Step 3: Implement the port** `src/market/health/health_snapshot_sink.ts`

```ts
export interface MarketHealthInput {
  readonly capturedAtMs: number;
  readonly diagnostics: Record<string, unknown>;
  readonly streamAgeMs: number | null;
}
export interface CoverageSignal {
  readonly source: string;
  readonly kind: string;
  readonly supported: boolean;
  readonly lastSeenMs: number | null;
}
export interface CoverageRollupInput {
  readonly capturedAtMs: number;
  readonly signals: readonly CoverageSignal[];
}
export interface HealthSnapshotSink {
  publishMarket(input: MarketHealthInput): void;
  publishCoverage(input: CoverageRollupInput): void;
}

export const noopHealthSnapshotSink: HealthSnapshotSink = {
  publishMarket() {},
  publishCoverage() {},
};
```

- [ ] **Step 4: Build + run, expect OK** — same command → `verify_4a_sink_port: OK (...)`

- [ ] **Step 5: Commit**

```bash
git add src/market/health/health_snapshot_sink.ts scripts/verify_4a_sink_port.mjs
git commit -m "feat(market): HealthSnapshotSink port + noop (DB-free core) (4a M2)"
```

## Task 9: `PgHealthSnapshotSink` + `makeHealthSnapshotSink` (composition boundary)

**Files:**
- Create: `src/canonical/adapter/pg_health_snapshot_sink.ts`
- Test: `scripts/verify_4a_pg_sink.mjs`

- [ ] **Step 1: Write the failing gate** (injected fake pool; throttle; swallow-on-error; env gating returns the exact noop)

`scripts/verify_4a_pg_sink.mjs`:
```js
import { distUrl, makeChecker } from './_033_harness.mjs';

const { createPgHealthSnapshotSink, makeHealthSnapshotSink } = await import(distUrl('canonical/adapter/pg_health_snapshot_sink.js'));
const { noopHealthSnapshotSink } = await import(distUrl('market/health/health_snapshot_sink.js'));
const c = makeChecker('verify_4a_pg_sink');

let clock = 0;
const calls = [];
const fakePool = { async query(sql, params) { calls.push(params); return { rows: [] }; } };
const log = { event() {} };
const sink = createPgHealthSnapshotSink({ pool: fakePool, errorLogger: log, minIntervalMs: 1000, now: () => clock });

sink.publishMarket({ capturedAtMs: 10, diagnostics: { a: 1 }, streamAgeMs: 50 });
await new Promise((r) => setImmediate(r));
c.check('first market publish writes', calls.length === 1 && calls[0][0] === 'market');

sink.publishMarket({ capturedAtMs: 20, diagnostics: {}, streamAgeMs: 60 });
await new Promise((r) => setImmediate(r));
c.check('throttled within minInterval ⇒ no second write', calls.length === 1);

clock = 2000;
sink.publishCoverage({ capturedAtMs: 2000, signals: [{ source: 'bybit', kind: 'taker', supported: true, lastSeenMs: 1900 }] });
await new Promise((r) => setImmediate(r));
c.check('coverage after interval writes', calls.length === 2 && calls[1][0] === 'coverage');

// swallow-on-error: pool throws ⇒ no throw to caller
const boomSink = createPgHealthSnapshotSink({ pool: { async query() { throw new Error('db down'); } }, errorLogger: log, minIntervalMs: 0, now: () => clock });
let threw = false;
try { boomSink.publishMarket({ capturedAtMs: 1, diagnostics: {}, streamAgeMs: null }); await new Promise((r) => setImmediate(r)); } catch { threw = true; }
c.check('write failure never throws to caller', threw === false);

// env gating
c.check('no DATABASE_URL ⇒ exact noop', makeHealthSnapshotSink({}, log) === noopHealthSnapshotSink);
c.check('DATABASE_URL but flag off ⇒ noop', makeHealthSnapshotSink({ DATABASE_URL: 'x' }, log) === noopHealthSnapshotSink);

c.finish('pg sink: write, throttle, swallow, env gating');
```

- [ ] **Step 2: Build + run, expect FAIL** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_pg_sink.mjs`

- [ ] **Step 3: Implement** `src/canonical/adapter/pg_health_snapshot_sink.ts`

```ts
import { createPool, type Pool } from '../pg/pool.js';
import { createPlatformHealthSnapshotWriter, type PlatformHealthDomain } from '../writers/platform_health_snapshot_writer.js';
import { noopHealthSnapshotSink, type HealthSnapshotSink } from '../../market/health/health_snapshot_sink.js';

export interface PgHealthSnapshotSinkDeps {
  readonly pool?: Pool;
  readonly errorLogger: { event(type: string, payload?: object): void };
  readonly minIntervalMs?: number;
  readonly now?: () => number;
}

export function createPgHealthSnapshotSink(deps: PgHealthSnapshotSinkDeps): HealthSnapshotSink {
  const pool = deps.pool ?? createPool({ max: 1, connTimeoutMs: 2000 });
  const writer = createPlatformHealthSnapshotWriter(pool);
  const now = deps.now ?? (() => Date.now());
  const minInterval = deps.minIntervalMs ?? Number(process.env.PLATFORM_HEALTH_SNAPSHOT_INTERVAL_MS ?? 30_000);
  const lastAt: Partial<Record<PlatformHealthDomain, number>> = {};

  const fire = (domain: PlatformHealthDomain, payload: Record<string, unknown>, capturedAtMs: number): void => {
    const t = now();
    if (t - (lastAt[domain] ?? -Infinity) < minInterval) return;
    lastAt[domain] = t;
    void writer
      .writeSnapshot({ domain, source: 'market-service', schemaVersion: 1, capturedAtMs, payload })
      .catch((err) => deps.errorLogger.event('platform_health_sink_error', { domain, error: err instanceof Error ? err.message : String(err) }));
  };

  return {
    publishMarket(input) { fire('market', { diagnostics: input.diagnostics, streamAgeMs: input.streamAgeMs }, input.capturedAtMs); },
    publishCoverage(input) { fire('coverage', { signals: input.signals }, input.capturedAtMs); },
  };
}

export function makeHealthSnapshotSink(
  env: NodeJS.ProcessEnv,
  errorLogger: { event(type: string, payload?: object): void },
): HealthSnapshotSink {
  const enabled = !!env.DATABASE_URL && /^(1|true|on|yes)$/i.test(env.MARKET_HEALTH_PERSIST ?? '');
  if (!enabled) {
    errorLogger.event('platform_health_sink_disabled', { reason: !env.DATABASE_URL ? 'no DATABASE_URL' : 'MARKET_HEALTH_PERSIST off' });
    return noopHealthSnapshotSink;
  }
  return createPgHealthSnapshotSink({ errorLogger });
}
```
> Confirm `createPool` accepts `{ connTimeoutMs }` (the extractor reported `PoolOptions` has `connTimeoutMs`, structurally accepted though not exported). If the field name differs, match `pool.ts`.

- [ ] **Step 4: Build + run, expect OK** — same command → `verify_4a_pg_sink: OK (...)`

- [ ] **Step 5: Commit**

```bash
git add src/canonical/adapter/pg_health_snapshot_sink.ts scripts/verify_4a_pg_sink.mjs
git commit -m "feat(canonical): PgHealthSnapshotSink + env-gated factory (4a M2)"
```

## Task 10: Publish market health from `startHeartbeat`

**Files:**
- Modify: `src/market/service/market_data_service.ts`
- Test: `scripts/verify_4a_market_publish.mjs` (test the small mapping helper, not the whole service)

- [ ] **Step 1: Write the failing gate** — extract + test a pure mapper `buildMarketHealthInput(heartbeat, capturedAtMs)` (maps `ageMs`→`streamAgeMs`)

`scripts/verify_4a_market_publish.mjs`:
```js
import { distUrl, makeChecker } from './_033_harness.mjs';
const { buildMarketHealthInput } = await import(distUrl('market/health/build_market_health_input.js'));
const c = makeChecker('verify_4a_market_publish');

const hb = { ageMs: 73, serviceDiagnostics: { clientsEverConnected: 2 } };
const input = buildMarketHealthInput(hb, 555);
c.check('maps ageMs ⇒ streamAgeMs', input.streamAgeMs === 73);
c.check('carries diagnostics', input.diagnostics.clientsEverConnected === 2);
c.check('capturedAtMs passed through', input.capturedAtMs === 555);

const hbNull = { ageMs: null, serviceDiagnostics: {} };
c.check('null ageMs ⇒ null streamAgeMs', buildMarketHealthInput(hbNull, 1).streamAgeMs === null);
c.finish('buildMarketHealthInput maps heartbeat → MarketHealthInput');
```

- [ ] **Step 2: Build + run, expect FAIL** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_market_publish.mjs`

- [ ] **Step 3: Create the mapper** `src/market/health/build_market_health_input.ts`

```ts
import type { MarketHealthInput } from './health_snapshot_sink.js';

export function buildMarketHealthInput(
  heartbeat: { ageMs: number | null; serviceDiagnostics?: Record<string, unknown> },
  capturedAtMs: number,
): MarketHealthInput {
  return {
    capturedAtMs,
    diagnostics: heartbeat.serviceDiagnostics ?? {},
    streamAgeMs: heartbeat.ageMs ?? null,
  };
}
```

- [ ] **Step 4: Wire into `MarketDataService`** — accept an optional sink; publish in the heartbeat loop

- Add to the constructor param: `constructor({ cfg, sink = noopHealthSnapshotSink }: { cfg: MarketServiceConfigInternal; sink?: HealthSnapshotSink })` and store `this.sink = sink;` (import `noopHealthSnapshotSink`, `HealthSnapshotSink` from `../health/health_snapshot_sink.js`, and `buildMarketHealthInput` from `../health/build_market_health_input.js`). This adds **no pg import** to the service.
- In `startHeartbeat`, right after `this.emit(heartbeat);`:
```ts
this.sink.publishMarket(buildMarketHealthInput(heartbeat, Date.now()));
```

- [ ] **Step 5: Build + run, expect OK** — same command → `verify_4a_market_publish: OK (...)`. Then `npm run build` confirms the service still type-checks and `verify_4a_sink_port.mjs` still passes (market core still imports no pg).

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && node scripts/verify_4a_sink_port.mjs`
Expected: still `OK` (the port + mapper live under `src/market/health` and import no pg).

- [ ] **Step 6: Commit**

```bash
git add src/market/health/build_market_health_input.ts src/market/service/market_data_service.ts scripts/verify_4a_market_publish.mjs
git commit -m "feat(market): publish market health snapshot from heartbeat via sink (4a M2)"
```

## Task 11: Publish coverage rollup from `flushSummary`

**Files:**
- Modify: `src/market/service/finalization/coverage_emitter.ts`, `src/market/service/market_data_service.ts` (pass sink to the emitter)
- Test: `scripts/verify_4a_coverage_publish.mjs`

- [ ] **Step 1: Write the failing gate** — test a pure `buildCoverageSignals(perMinuteStats)` mapper (aggregated per (source,kind), not per-symbol)

`scripts/verify_4a_coverage_publish.mjs`:
```js
import { distUrl, makeChecker } from './_033_harness.mjs';
const { buildCoverageSignals } = await import(distUrl('market/service/finalization/coverage_signals.js'));
const c = makeChecker('verify_4a_coverage_publish');

const stats = {
  takerSourceStates: { bybit: { available: 3, missing: 1 }, okx: { unsupported: 4 } },
  fundingSourceStates: { bybit: { available: 2 } },
};
const signals = buildCoverageSignals(stats, 9000);
c.check('one signal per (source,kind), not per-symbol', signals.length === 3);
const bybitTaker = signals.find((s) => s.source === 'bybit' && s.kind === 'taker');
c.check('bybit taker supported (had available)', bybitTaker.supported === true);
const okxTaker = signals.find((s) => s.source === 'okx' && s.kind === 'taker');
c.check('okx taker unsupported ⇒ supported false', okxTaker.supported === false);
c.finish('buildCoverageSignals aggregates per (source,kind)');
```

- [ ] **Step 2: Build + run, expect FAIL** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_coverage_publish.mjs`

- [ ] **Step 3: Create the mapper** `src/market/service/finalization/coverage_signals.ts`

```ts
import type { CoverageSignal } from '../../health/health_snapshot_sink.js';

type SourceStates = Record<string, Record<string, number>>;

function toSignals(states: SourceStates | undefined, kind: string, lastSeenMs: number | null): CoverageSignal[] {
  if (!states) return [];
  return Object.entries(states).map(([source, counts]) => ({
    source,
    kind,
    supported: (counts.available ?? 0) > 0 || (counts.stale ?? 0) > 0 || (counts.missing ?? 0) > 0, // any non-unsupported tally
    lastSeenMs,
  }));
}

export function buildCoverageSignals(
  stats: { takerSourceStates?: SourceStates; fundingSourceStates?: SourceStates },
  lastSeenMs: number | null,
): CoverageSignal[] {
  return [
    ...toSignals(stats.takerSourceStates, 'taker', lastSeenMs),
    ...toSignals(stats.fundingSourceStates, 'funding', lastSeenMs),
  ];
}
```
> Confirm the exact `supported` rule against `FundingSourceState`/`TakerSourceState` semantics during M2 (extractor: states are `available|stale|missing|unsupported`). The rule above treats `unsupported`-only sources as `supported:false`, everything else `true` — the ops reader's `deriveCoverageState` then maps freshness.

- [ ] **Step 4: Wire into `CoverageEmitter`** — accept the sink; publish in `flushSummary`

- `CoverageEmitter` constructor gains an optional `sink: HealthSnapshotSink` (default `noopHealthSnapshotSink`); `MarketDataService` passes `this.sink` when it constructs the emitter (the `historicalStorage` block).
- In `flushSummary(minuteTs)`, after the existing summary emit, add:
```ts
this.sink.publishCoverage({ capturedAtMs: Date.now(), signals: buildCoverageSignals(stats, minuteTs) });
```
(where `stats` is the `PerMinuteStats` being flushed; `minuteTs` as `lastSeenMs`).

- [ ] **Step 5: Build + run, expect OK** — `node scripts/verify_4a_coverage_publish.mjs` → `OK`; re-run `verify_4a_sink_port.mjs` → still `OK` (coverage_signals imports only the port).

- [ ] **Step 6: Commit**

```bash
git add src/market/service/finalization/ src/market/service/market_data_service.ts scripts/verify_4a_coverage_publish.mjs
git commit -m "feat(market): publish coverage rollup from flushSummary via sink (4a M2)"
```

## Task 12: Wire the gated sink at the market-service bin

**Files:**
- Modify: `src/app/run_market_data_service.ts`

- [ ] **Step 1: Add the wiring** (env-gated; `makeHealthSnapshotSink` already gate-tested in Task 9)

```ts
import { makeHealthSnapshotSink } from '../canonical/adapter/pg_health_snapshot_sink.js';
// inside main(), replacing `const service = new MarketDataService({ cfg });`
const sink = makeHealthSnapshotSink(process.env, {
  event: (type, payload) => console.log(`[health-sink] ${type}`, payload ?? {}),
});
const service = new MarketDataService({ cfg, sink });
```

- [ ] **Step 2: Build, expect clean typecheck** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/app/run_market_data_service.ts
git commit -m "feat(market): wire gated PgHealthSnapshotSink at market-service bin (4a M2)"
```

## Task 13: `createPgMarketHealthReader` + `createPgSourceCoverageReader` + un-stub

**Files:**
- Modify: `src/operations/sources/market-health-reader.ts`, `src/operations/sources/source-coverage-reader.ts`, `src/operations/bin/start-ops-read.ts`
- Test: `scripts/verify_4a_market_coverage_readers.mjs`

- [ ] **Step 1: Write the failing gate**

`scripts/verify_4a_market_coverage_readers.mjs`:
```js
import { distUrl, loadModules, makeOpsHarness, makeChecker } from './_033_harness.mjs';
const { createPgMarketHealthReader } = await import(distUrl('operations/sources/market-health-reader.js'));
const { createPgSourceCoverageReader } = await import(distUrl('operations/sources/source-coverage-reader.js'));
const { ops } = await loadModules();
const c = makeChecker('verify_4a_market_coverage_readers');
const now = () => 100_000;

const mPool = { async query() { return { rows: [{ captured_at_ms: '99000', schema_version: 1, payload: { diagnostics: { x: 1 }, streamAgeMs: 50 } }] }; } };
const mSig = await createPgMarketHealthReader(mPool, now, 120_000).read();
c.check('market reader returns signal', mSig && mSig.streamAgeMs === 50 && mSig.diagnostics.x === 1);

const mStale = { async query() { return { rows: [{ captured_at_ms: '1000', schema_version: 1, payload: { diagnostics: {}, streamAgeMs: 1 } }] }; } };
c.check('stale market row ⇒ null', (await createPgMarketHealthReader(mStale, now, 120_000).read()) === null);

const cvPool = { async query() { return { rows: [{ captured_at_ms: '99000', schema_version: 1, payload: { signals: [{ source: 'bybit', kind: 'taker', supported: true, lastSeenMs: 98000 }] } }] }; } };
const sigs = await createPgSourceCoverageReader(cvPool, now, 120_000).signals();
c.check('coverage reader returns signals', Array.isArray(sigs) && sigs[0].source === 'bybit' && sigs[0].supported === true);

// handlers map null ⇒ unavailable
const h = makeOpsHarness({ ops }, { startClock: 100_000, readers: { marketHealth: createPgMarketHealthReader(mStale, now, 120_000), sourceCoverage: createPgSourceCoverageReader({ async query(){return {rows:[]};} }, now, 120_000) } });
c.check('market handler null ⇒ unavailable', (await ops.getMarketHealth(h.service, {}, h.ctx)).availability === 'unavailable');
c.check('coverage handler null ⇒ unavailable', (await ops.getSourceCoverage(h.service, {}, h.ctx)).availability === 'unavailable');
c.finish('market + coverage PG readers: signal, staleness, handler unavailable');
```

- [ ] **Step 2: Build + run, expect FAIL** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_market_coverage_readers.mjs`

- [ ] **Step 3: Add `createPgMarketHealthReader`** to `src/operations/sources/market-health-reader.ts`

```ts
import type { Pool } from '../../canonical/pg/pool.js';

interface MarketRow { readonly captured_at_ms: string; readonly schema_version: number; readonly payload: MarketHealthSignal; }
const MARKET_SELECT_SQL =
  `SELECT captured_at_ms, schema_version, payload FROM canonical.platform_health_snapshot
   WHERE domain = 'market' AND source = 'market-service'`;

export function createPgMarketHealthReader(
  pool: Pool,
  now: () => number = () => Date.now(),
  staleMs: number = Number(process.env.PLATFORM_HEALTH_STALENESS_MS ?? 120_000),
): MarketHealthReader {
  return {
    async read(): Promise<MarketHealthSignal | null> {
      const { rows } = await pool.query<MarketRow>(MARKET_SELECT_SQL);
      const r = rows[0];
      if (!r || r.schema_version !== 1 || now() - Number(r.captured_at_ms) > staleMs) return null;
      return { diagnostics: r.payload.diagnostics ?? {}, streamAgeMs: r.payload.streamAgeMs ?? null };
    },
  };
}
```

- [ ] **Step 4: Add `createPgSourceCoverageReader`** to `src/operations/sources/source-coverage-reader.ts`

```ts
import type { Pool } from '../../canonical/pg/pool.js';

interface CoverageRow { readonly captured_at_ms: string; readonly schema_version: number; readonly payload: { signals: SourceFreshnessSignal[] }; }
const COVERAGE_SELECT_SQL =
  `SELECT captured_at_ms, schema_version, payload FROM canonical.platform_health_snapshot
   WHERE domain = 'coverage' AND source = 'market-service'`;

export function createPgSourceCoverageReader(
  pool: Pool,
  now: () => number = () => Date.now(),
  staleMs: number = Number(process.env.PLATFORM_HEALTH_STALENESS_MS ?? 120_000),
): SourceCoverageReader {
  return {
    async signals(): Promise<readonly SourceFreshnessSignal[] | null> {
      const { rows } = await pool.query<CoverageRow>(COVERAGE_SELECT_SQL);
      const r = rows[0];
      if (!r || r.schema_version !== 1 || now() - Number(r.captured_at_ms) > staleMs) return null;
      return (r.payload.signals ?? []).map((s) => ({ source: s.source, kind: s.kind, supported: !!s.supported, lastSeenMs: s.lastSeenMs ?? null }));
    },
  };
}
```
> `SourceFreshnessSignal.kind` is typed `OpsMarketDataKind`; the payload `kind` strings (`taker`/`funding`/…) are cast on read. Confirm the `kind` values written by `buildCoverageSignals` are within `OpsMarketDataKind` during M2 (extractor: `openInterest|liquidations|funding|taker`).

- [ ] **Step 5: Un-stub in the bin** — in `src/operations/bin/start-ops-read.ts`, import both factories and replace `marketHealth: unavailableMarketHealth,` → `marketHealth: createPgMarketHealthReader(pool),` and `sourceCoverage: unavailableSourceCoverage,` → `sourceCoverage: createPgSourceCoverageReader(pool),`.

- [ ] **Step 6: Build + run, expect OK** — same command → `verify_4a_market_coverage_readers: OK (...)`

- [ ] **Step 7: Commit**

```bash
git add src/operations/sources/market-health-reader.ts src/operations/sources/source-coverage-reader.ts src/operations/bin/start-ops-read.ts scripts/verify_4a_market_coverage_readers.mjs
git commit -m "feat(ops-read): PG market-health + source-coverage readers (4a M2)"
```

---

# Milestone M3 — discover, integration, hardening

## Task 14: `/ops/discover` reflects the backed resources

**Files:**
- Test: `scripts/verify_4a_discover.mjs` (no code change — `execution-health` was added to the catalog in Task 7; this locks the contract)

- [ ] **Step 1: Write the gate**

`scripts/verify_4a_discover.mjs`:
```js
import { loadModules, makeChecker } from './_033_harness.mjs';
const { ops } = await loadModules();
const c = makeChecker('verify_4a_discover');
const d = ops.discover();
const names = d.resources.map((r) => r.name);
for (const n of ['runtime-health', 'market-health', 'source-coverage', 'execution-health']) c.check(`discover lists ${n}`, names.includes(n));
c.check('capabilities stay read-only (no execution/mutation)', d.capabilities.readOnly === true && d.capabilities.execution === false && d.capabilities.mutation === false);
c.finish('discover advertises all four health resources, read-only');
```

- [ ] **Step 2: Build + run, expect OK** (if FAIL on `execution-health`, revisit Task 7 step 6) — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_discover.mjs`

- [ ] **Step 3: Commit**

```bash
git add scripts/verify_4a_discover.mjs
git commit -m "test(ops-read): lock /ops/discover health resource contract (4a M3)"
```

## Task 15: Integration gate (real PG round-trip) — DATABASE_URL-gated

**Files:**
- Test: `scripts/verify_4a_integration.mjs`

- [ ] **Step 1: Write the integration gate** (skips cleanly without a test DB; applies the migration, round-trips writer→reader)

`scripts/verify_4a_integration.mjs`:
```js
import { execSync } from 'node:child_process';
import { distUrl, makeChecker } from './_033_harness.mjs';

const c = makeChecker('verify_4a_integration');
if (!process.env.DATABASE_URL) { console.log('verify_4a_integration: SKIP (no DATABASE_URL)'); process.exit(0); }

execSync('node dist/scripts/db/migrate.js', { stdio: 'inherit', env: process.env });

const { getDefaultPool } = await import(distUrl('canonical/pg/pool.js'));
const { createPlatformHealthSnapshotWriter } = await import(distUrl('canonical/writers/platform_health_snapshot_writer.js'));
const { createPgMarketHealthReader } = await import(distUrl('operations/sources/market-health-reader.js'));
const pool = getDefaultPool();
const writer = createPlatformHealthSnapshotWriter(pool);

const t = Date.now();
await writer.writeSnapshot({ domain: 'market', source: 'market-service', schemaVersion: 1, capturedAtMs: t, payload: { diagnostics: { x: 1 }, streamAgeMs: 42 } });
const fresh = await createPgMarketHealthReader(pool, () => t + 1000, 120_000).read();
c.check('round-trip: fresh row read back', fresh && fresh.streamAgeMs === 42);

// upsert keeps ONE row
await writer.writeSnapshot({ domain: 'market', source: 'market-service', schemaVersion: 1, capturedAtMs: t + 1, payload: { diagnostics: {}, streamAgeMs: 7 } });
const { rows } = await pool.query("SELECT count(*)::int AS n FROM canonical.platform_health_snapshot WHERE domain='market' AND source='market-service'");
c.check('upsert keeps one row per (domain,source)', rows[0].n === 1);

// staleness
const stale = await createPgMarketHealthReader(pool, () => t + 10_000_000, 120_000).read();
c.check('old row ⇒ null (stale)', stale === null);

c.finish('real-PG migrate + writer/reader round-trip + upsert + staleness', () => pool.query("DELETE FROM canonical.platform_health_snapshot WHERE source='market-service'"));
```

- [ ] **Step 2: Run without DB, expect SKIP** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_integration.mjs` → `SKIP`.

- [ ] **Step 3: Run with a test DB, expect OK** — `DATABASE_URL=postgres://…/test DATABASE_URL_MIGRATOR=postgres://…/test node scripts/verify_4a_integration.mjs` → `OK`.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_4a_integration.mjs
git commit -m "test(canonical): real-PG integration gate for health channel (4a M3)"
```

## Task 16: Register `gates:4a` + final honesty conformance

**Files:**
- Modify: `package.json`
- Test: `scripts/verify_4a_honesty.mjs`

- [ ] **Step 1: Write the honesty conformance gate** (persistence-off path; stale; unknown schema_version — all surface as unavailable, never fabricated)

`scripts/verify_4a_honesty.mjs`:
```js
import { distUrl, loadModules, makeOpsHarness, makeChecker } from './_033_harness.mjs';
const { makeHealthSnapshotSink } = await import(distUrl('canonical/adapter/pg_health_snapshot_sink.js'));
const { noopHealthSnapshotSink } = await import(distUrl('market/health/health_snapshot_sink.js'));
const { createPgMarketHealthReader } = await import(distUrl('operations/sources/market-health-reader.js'));
const { ops } = await loadModules();
const c = makeChecker('verify_4a_honesty');

// persistence off ⇒ exact noop ⇒ no writes possible
c.check('persistence off ⇒ noop sink', makeHealthSnapshotSink({ DATABASE_URL: 'x', MARKET_HEALTH_PERSIST: '' }, { event(){} }) === noopHealthSnapshotSink);

// unknown schema_version ⇒ reader null ⇒ handler unavailable (never fabricated ok)
const poolV9 = { async query() { return { rows: [{ captured_at_ms: String(Date.now()), schema_version: 9, payload: { diagnostics: {}, streamAgeMs: 1 } }] }; } };
const h = makeOpsHarness({ ops }, { startClock: Date.now(), readers: { marketHealth: createPgMarketHealthReader(poolV9, () => Date.now(), 120_000) } });
const snap = await ops.getMarketHealth(h.service, {}, h.ctx);
c.check('unknown schema_version ⇒ unavailable (no fabricated data)', snap.availability === 'unavailable' && snap.status === 'down');
c.finish('honesty: off⇒noop, unknown-version⇒unavailable, never fabricated');
```

- [ ] **Step 2: Build + run, expect OK** — `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && node scripts/verify_4a_honesty.mjs`

- [ ] **Step 3: Add `gates:4a` to `package.json`** (chain every 4a gate; mirror the `gates:033` style)

```json
"gates:4a": "node scripts/verify_4a_migration.mjs && node scripts/verify_4a_writer.mjs && node scripts/verify_4a_gate_parity.mjs && node scripts/verify_4a_snapshotter.mjs && node scripts/verify_4a_runtime_reader.mjs && node scripts/verify_4a_execution_health.mjs && node scripts/verify_4a_sink_port.mjs && node scripts/verify_4a_pg_sink.mjs && node scripts/verify_4a_market_publish.mjs && node scripts/verify_4a_coverage_publish.mjs && node scripts/verify_4a_market_coverage_readers.mjs && node scripts/verify_4a_discover.mjs && node scripts/verify_4a_honesty.mjs && node scripts/verify_4a_integration.mjs"
```

- [ ] **Step 4: Run the whole suite, expect OK (integration SKIPs without DB)**

Run: `cd /home/alexxxnikolskiy/projects/trading-platform && npm run build && npm run gates:4a`
Expected: every gate prints `OK` (integration `SKIP` if no `DATABASE_URL`).

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/verify_4a_honesty.mjs
git commit -m "test(4a): honesty conformance + gates:4a suite (4a M3)"
```

---

## Self-Review notes (already reconciled)

- **Spec coverage:** channel (T1–2); runtime-health A1 — gate extraction (T3), snapshotter+bounded read (T4), bins (T5), PG reader (T6); execution-health (T7); market-service DB-free gated sink — port/noop (T8), pg sink+factory (T9), heartbeat publish (T10), coverage publish (T11), bin wiring (T12); market+coverage readers (T13); discover (T14); integration (T15); lightweight constraints (`max:1` T9, 30s throttle T9, compact payloads T2/T10/T11, aggregated coverage T11); honesty (T16). All spec In-scope items map to a task; Out-of-scope (true broker health, office, mutations, host-tail) is untouched.
- **Type consistency:** `RuntimeHealthIndicators`, `MarketHealthSignal`, `SourceFreshnessSignal`, `SourceAvailability`, `OpsHealthStatus` used as defined in `dto.ts`; `HealthSnapshotSink.{publishMarket,publishCoverage}` consistent across T8–T13; `PlatformHealthSnapshotInput` consistent across T2/T4/T9; reader staleness env `PLATFORM_HEALTH_STALENESS_MS` and interval `PLATFORM_HEALTH_SNAPSHOT_INTERVAL_MS` consistent.
- **Calibration carry-overs flagged inline (confirm during M1/M2):** exact `CheckArgs` for `buildChecks`; `analyzeEvents` line-core factoring; `createPool` option name `connTimeoutMs`; `buildCoverageSignals` `supported` rule + `kind` ∈ `OpsMarketDataKind`; `registerShutdownHandler` cleanup API (else rely on `.unref()`).
