# PR2b PR2 (office) — Downstream backtest surfacing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each per-hypothesis `backtest.completed` result into the operator chat as a proactive assistant message, incrementally, after a `research.run_cycle` turn has completed — via a new `operator_assistant_message` office event, a long-lived `DownstreamBacktestWatcher`, and a new `assistant_turn` web transcript turn.

**Architecture:** A process-lifetime `DownstreamBacktestWatcher` subscribes to the always-on `StreamBridge`, is told (by the operator responder) the run_cycle turn's `taskId` + `conversationId`, resolves the lab `correlationId` via the existing bootstrap-poll pattern, and on each `backtest.result_ready` event (matching that correlationId, deduped by taskId) fetches the completion-summary with bounded retry, renders it, and publishes a proactive `operator_assistant_message`. The web reducer gains an `assistant_turn` action that creates an assistant-only turn; `ChatTurn` renders it without a user bubble.

**Tech Stack:** TypeScript, Zod (office-gateway schemas), Vitest. npm workspaces: `@trading-office/server` (apps/server), `@trading-office/web` (apps/web), `office-gateway` (packages/office-gateway).

## Global Constraints

- **npm workspaces, NOT pnpm.** Run server tests with `npm run test -w @trading-office/server -- <file>`; web with `npm run test -w @trading-office/web -- <file>`; typecheck with `npm run typecheck -w @trading-office/<pkg>`. Build a package with `npm run build -w @trading-office/<pkg>`.
- **trading-office is transpiled — TS parameter properties ARE allowed** (unlike trading-lab). Match the surrounding file's style.
- **apps/web has NO component-test harness by convention** — no jsdom/RTL, zero `.test.tsx`. `.tsx` changes are verified by `npm run typecheck -w @trading-office/web` + `npm run build -w @trading-office/web`. All web *logic* tests live at the reducer/pure-function level.
- **Do NOT weaken the Q4 reducer invariant**: `mapById` and `pendingCompleted` in `operatorTranscript.ts` stay exactly as they are. `assistant_turn` is a NEW, separate action.
- **Audit-safe**: the proactive reply carries only the `completion-summary` projection (ids/metrics/decision/reasons) — never raw strategy text.
- **gortex may serve STALE office content** — read the actual on-disk file before editing; cross-check any cited symbol.
- Feature flag `OPERATOR_DOWNSTREAM_BACKTESTS` (default **false**) gates watcher construction; when off, nothing is wired and behavior is unchanged.

---

### Task 1: Add the `operator_assistant_message` event to the gateway schema

**Files:**
- Modify: `packages/office-gateway/src/schemas.ts` (the `officeEventSchema` discriminated union, ~`:127-139`)
- Test: `packages/office-gateway/src/schemas.test.ts` (create if absent; otherwise add to the existing schema test file)

**Interfaces:**
- Consumes: `operatorReplySchema` (`schemas.ts:112-122` — requires `replyMessageId`, `operatorMessageId`, `conversationId`, `text`, `ts`; optional `evidence`, `actions`, `pendingInteractionId`, `sessionId`).
- Produces: a new `OfficeEvent` member `{ type: 'operator_assistant_message'; ts: string; operatorMessageId: string; conversationId: string; reply: OperatorReply }`. Consumed by Tasks 2–4.

- [ ] **Step 1: Write the failing test**

In `packages/office-gateway/src/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { officeEventSchema } from './schemas';

describe('operator_assistant_message event', () => {
  const valid = {
    type: 'operator_assistant_message',
    ts: '2026-06-22T00:00:00.000Z',
    operatorMessageId: 'om-1',
    conversationId: 'cv-1',
    reply: {
      replyMessageId: 'rm-1',
      operatorMessageId: 'om-1',
      conversationId: 'cv-1',
      text: 'PASS: «idea» · netPnl +12%.',
      ts: '2026-06-22T00:00:00.000Z',
    },
  };

  it('parses a valid proactive assistant message', () => {
    const r = officeEventSchema.parse(valid);
    expect(r.type).toBe('operator_assistant_message');
  });

  it('rejects when reply is missing', () => {
    const { reply, ...noReply } = valid;
    expect(() => officeEventSchema.parse(noReply)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w office-gateway -- schemas.test.ts`
Expected: FAIL — `operator_assistant_message` is not a member of the union, so `parse` throws on the valid object.

(If the package name differs, use the name in `packages/office-gateway/package.json`'s `name` field.)

- [ ] **Step 3: Add the union member**

In `packages/office-gateway/src/schemas.ts`, add to the `officeEventSchema` `z.discriminatedUnion('type', [ … ])` array (place it next to the other `operator_message_*` members):

```ts
  z.object({
    type: z.literal('operator_assistant_message'),
    ts: z.string(),
    operatorMessageId: z.string(),
    conversationId: z.string(),
    reply: operatorReplySchema,
  }),
```

`events.ts` re-exports the inferred `OfficeEvent` type, so no change is needed there.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w office-gateway -- schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck -w office-gateway`
Expected: clean.

```bash
git add packages/office-gateway/src/schemas.ts packages/office-gateway/src/schemas.test.ts
git commit -m "feat(gateway): add operator_assistant_message office event variant"
```

---

### Task 2: `assistant_turn` reducer action in the web transcript

**Files:**
- Modify: `apps/web/src/floor/panels/operatorTranscript.ts` (the `OperatorTurn` type, the `TranscriptAction` union, and the reducer switch)
- Test: `apps/web/src/floor/panels/operatorTranscript.test.ts` (existing — has the Q4 `pendingCompleted` tests; add a new describe block)

**Interfaces:**
- Consumes: `OfficeEvent` (from office-gateway, already imported in this file); the existing `OperatorTurn`, `OperatorTranscriptState`, `emptyTranscript`, and `transcriptReducer` exports.
- Produces: a new action `{ type: 'assistant_turn'; operatorMessageId: string; conversationId: string; reply: AssistantReply }` where `AssistantReply = Extract<OfficeEvent, { type: 'operator_assistant_message' }>['reply']`; `OperatorTurn` gains optional `kind?: 'user' | 'assistant'`. Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/floor/panels/operatorTranscript.test.ts`. Match the file's existing import of `transcriptReducer` / `emptyTranscript`:

```ts
describe('assistant_turn (proactive assistant message)', () => {
  const reply = {
    replyMessageId: 'rm-1',
    operatorMessageId: 'om-A',
    conversationId: 'cv-1',
    text: 'PASS: «idea» · netPnl +12%.',
    ts: '2026-06-22T00:00:00.000Z',
  };

  it('appends a completed assistant-only turn', () => {
    const s = transcriptReducer(emptyTranscript, {
      type: 'assistant_turn', operatorMessageId: 'om-A', conversationId: 'cv-1', reply,
    });
    expect(s.turns).toHaveLength(1);
    const t = s.turns[0];
    expect(t.kind).toBe('assistant');
    expect(t.operatorMessageId).toBe('om-A');
    expect(t.userText).toBe('');
    expect(t.replyText).toBe(reply.text);
    expect(t.status).toBe('completed');
  });

  it('does not disturb existing turns or the pendingCompleted buffer (Q4 intact)', () => {
    const seeded = { ...emptyTranscript, pendingCompleted: { 'om-X': { foo: 1 } as never } };
    const s = transcriptReducer(seeded, {
      type: 'assistant_turn', operatorMessageId: 'om-A', conversationId: 'cv-1', reply,
    });
    expect(s.pendingCompleted).toEqual(seeded.pendingCompleted);
  });

  it('two assistant_turns append in arrival order', () => {
    let s = transcriptReducer(emptyTranscript, { type: 'assistant_turn', operatorMessageId: 'om-A', conversationId: 'cv-1', reply });
    s = transcriptReducer(s, { type: 'assistant_turn', operatorMessageId: 'om-B', conversationId: 'cv-1', reply: { ...reply, operatorMessageId: 'om-B', text: 'FAIL.' } });
    expect(s.turns.map((t) => t.operatorMessageId)).toEqual(['om-A', 'om-B']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -w @trading-office/web -- operatorTranscript.test.ts`
Expected: FAIL — `assistant_turn` is not handled (TS may also error on the unknown action type; that still counts as red).

- [ ] **Step 3: Extend the type, the action union, and the reducer**

In `apps/web/src/floor/panels/operatorTranscript.ts`:

1. Add the optional discriminator to `OperatorTurn` (next to the existing fields):

```ts
  kind?: 'user' | 'assistant';
```

2. Add the action to the `TranscriptAction` union (define the reply alias near the top, beside the existing `CompletedReply` type):

```ts
type AssistantReply = Extract<OfficeEvent, { type: 'operator_assistant_message' }>['reply'];
```
```ts
  | { type: 'assistant_turn'; operatorMessageId: string; conversationId: string; reply: AssistantReply }
```

3. Add the case to the reducer switch (do NOT touch `mapById` or the `event`/`accepted` arms):

```ts
    case 'assistant_turn': {
      const turn: OperatorTurn = {
        localId: action.operatorMessageId,
        operatorMessageId: action.operatorMessageId,
        conversationId: action.conversationId,
        userText: '',
        replyText: action.reply.text,
        status: 'completed',
        evidence: action.reply.evidence,
        actions: action.reply.actions,
        pendingInteractionId: action.reply.pendingInteractionId,
        sessionId: action.reply.sessionId,
        resolved: true,
        kind: 'assistant',
      };
      return { ...state, turns: [...state.turns, turn] };
    }
```

If `OperatorTurn` has required fields not set above (e.g. a required `resolved` already covered), match the exact field set the file defines — read the current `OperatorTurn` and fill every required field (the assistant turn is terminal: `status: 'completed'`, `resolved: true`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -w @trading-office/web -- operatorTranscript.test.ts`
Expected: PASS (new block green; the existing Q4 tests still green).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck -w @trading-office/web`
Expected: clean.

```bash
git add apps/web/src/floor/panels/operatorTranscript.ts apps/web/src/floor/panels/operatorTranscript.test.ts
git commit -m "feat(web): assistant_turn transcript action for proactive assistant messages"
```

---

### Task 3: Render the assistant turn + dispatch the event into the reducer

**Files:**
- Modify: `apps/web/src/floor/.../ChatTurn.tsx` (the turn renderer — find it: search `apps/web/src` for the component rendering `userText` / a turn's user bubble)
- Modify: the WS-event → transcript dispatch site (find it: search `apps/web/src` for `dispatch(` calls with `type: 'event'` / where `OfficeEvent`s are routed into `transcriptReducer`)
- No unit test (web `.tsx` convention) — verified by typecheck + build.

**Interfaces:**
- Consumes: the `assistant_turn` action (Task 2); the `operator_assistant_message` event (Task 1).
- Produces: UI rendering of assistant-only turns; the event→action mapping.

- [ ] **Step 1: Gate the user bubble on `kind` in `ChatTurn.tsx`**

In the turn renderer, render the user bubble only for non-assistant turns. Wrap the existing user-bubble JSX:

```tsx
{turn.kind !== 'assistant' && (
  /* existing user bubble JSX, unchanged */
)}
```

The assistant reply (`replyText`) renders as it does today for a completed turn (reuse the existing completed-reply markdown rendering path — do not add a new renderer). An assistant turn has `userText: ''` and `kind: 'assistant'`, so only the reply shows.

- [ ] **Step 2: Map the event to the action at the dispatch site**

Where `OfficeEvent`s are routed into the transcript reducer, add a branch BEFORE the generic `operator_message_*` handling:

```ts
if (e.type === 'operator_assistant_message') {
  dispatch({ type: 'assistant_turn', operatorMessageId: e.operatorMessageId, conversationId: e.conversationId, reply: e.reply });
  return;
}
```

(Adapt `dispatch` / `e` to the names used at that site. Keep it a pure pass-through — no other logic.)

- [ ] **Step 3: Typecheck + build to verify**

Run: `npm run typecheck -w @trading-office/web && npm run build -w @trading-office/web`
Expected: both clean (the discriminated union makes `e.reply` available only inside the `operator_assistant_message` branch; the reducer accepts the new action).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/floor
git commit -m "feat(web): render proactive assistant turns and dispatch operator_assistant_message"
```

---

### Task 4: `DownstreamBacktestWatcher` core (server)

**Files:**
- Create: `apps/server/src/operator/DownstreamBacktestWatcher.ts`
- Test: `apps/server/src/operator/DownstreamBacktestWatcher.test.ts`

**Interfaces:**
- Consumes:
  - `bridge.subscribeAppended(cb: (e: LabAgentEvent) => void): () => void` (`connector/tradinglab/TradingLabStreamBridge.ts:68`)
  - `client.getAgentEvents(q: { taskId: string }): Promise<LabAgentEvent[]>` and `client.getCompletionSummary(taskId: string): Promise<LabCompletionSummary | null>` (`connector/tradinglab/TradingLabHttpClient.ts:50,68`)
  - `LabAgentEvent` (`connector/tradinglab/labDtos.ts:7-16`: `{ id, ts, type, taskId, correlationId?, level, summary, payloadSummary? }`)
  - `renderCompletionSummary(s: LabCompletionSummary): string` (`operator/completionSummaryRender.ts:23`)
  - `OfficeEvent` (office-gateway) and a `bus.publish(e: OfficeEvent): void`
- Produces:
  - `createDownstreamBacktestWatcher(deps): DownstreamBacktestWatcher`
  - `interface DownstreamBacktestWatcher { register(runCycleTaskId: string, conversationId: string): void; stop(): void }`
  - `interface BacktestWatchGuards { idleMs; maxMs; bootstrapRetries; bootstrapIntervalMs; summaryRetries; summaryIntervalMs }` (all `number`)

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/operator/DownstreamBacktestWatcher.test.ts`. The fakes make bootstrap and summary succeed on attempt 0, so the logic tests need NO timers:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createDownstreamBacktestWatcher } from './DownstreamBacktestWatcher';
import type { LabAgentEvent } from '../connector/tradinglab/labDtos';

const GUARDS = { idleMs: 10_000, maxMs: 60_000, bootstrapRetries: 3, bootstrapIntervalMs: 1, summaryRetries: 2, summaryIntervalMs: 1 };

function ev(partial: Partial<LabAgentEvent>): LabAgentEvent {
  return { id: 'e', ts: 't', type: 'x', taskId: 'tk', level: 'info', summary: '', ...partial };
}

function harness(overrides: { summary?: unknown } = {}) {
  let emit!: (e: LabAgentEvent) => void;
  const bridge = { subscribeAppended: (cb: (e: LabAgentEvent) => void) => { emit = cb; return () => {}; } };
  const published: any[] = [];
  const bus = { publish: (e: any) => published.push(e) };
  const client = {
    getAgentEvents: vi.fn(async (_q: { taskId: string }) => [ev({ taskId: 'rc-1', correlationId: 'corr-1' })]),
    getCompletionSummary: vi.fn(async (_id: string) => (overrides.summary === undefined ? { kind: 'backtest.completed' } : overrides.summary)),
  };
  let ids = 0;
  const newIds = () => ({ operatorMessageId: `om-${++ids}`, replyMessageId: `rm-${ids}` });
  const render = (_s: any) => 'RENDERED';
  const watcher = createDownstreamBacktestWatcher({ bridge: bridge as any, client: client as any, bus, newIds, render, guards: GUARDS });
  return { watcher, get emit() { return emit; }, published, client };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('DownstreamBacktestWatcher', () => {
  it('publishes one operator_assistant_message per backtest.result_ready', async () => {
    const h = harness();
    h.watcher.register('rc-1', 'cv-1');
    await flush(); // bootstrap resolves corr-1
    h.emit(ev({ type: 'backtest.result_ready', taskId: 'bt-1', correlationId: 'corr-1' }));
    await flush();
    expect(h.published).toHaveLength(1);
    expect(h.published[0].type).toBe('operator_assistant_message');
    expect(h.published[0].conversationId).toBe('cv-1');
    expect(h.published[0].reply.text).toBe('RENDERED');
  });

  it('dedupes a replayed taskId', async () => {
    const h = harness();
    h.watcher.register('rc-1', 'cv-1');
    await flush();
    h.emit(ev({ type: 'backtest.result_ready', taskId: 'bt-1', correlationId: 'corr-1' }));
    await flush();
    h.emit(ev({ type: 'backtest.result_ready', taskId: 'bt-1', correlationId: 'corr-1' }));
    await flush();
    expect(h.published).toHaveLength(1);
  });

  it('ignores a foreign correlationId', async () => {
    const h = harness();
    h.watcher.register('rc-1', 'cv-1');
    await flush();
    h.emit(ev({ type: 'backtest.result_ready', taskId: 'bt-9', correlationId: 'other' }));
    await flush();
    expect(h.published).toHaveLength(0);
  });

  it('ignores non-backtest event types', async () => {
    const h = harness();
    h.watcher.register('rc-1', 'cv-1');
    await flush();
    h.emit(ev({ type: 'hypothesis.passed', taskId: 'bt-1', correlationId: 'corr-1' }));
    await flush();
    expect(h.published).toHaveLength(0);
  });

  it('falls back to a generic text when the summary stays null', async () => {
    const h = harness({ summary: null });
    h.watcher.register('rc-1', 'cv-1');
    await flush();
    h.emit(ev({ type: 'backtest.result_ready', taskId: 'bt-1', correlationId: 'corr-1' }));
    await flush(); await flush();
    expect(h.published).toHaveLength(1);
    expect(h.published[0].reply.text).toContain('Бэктест');
  });

  it('tears down a registration after idleMs (no publish for late events)', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.watcher.register('rc-1', 'cv-1');
      await vi.advanceTimersByTimeAsync(0); // bootstrap
      await vi.advanceTimersByTimeAsync(GUARDS.idleMs + 1); // idle teardown
      h.emit(ev({ type: 'backtest.result_ready', taskId: 'bt-1', correlationId: 'corr-1' }));
      await vi.advanceTimersByTimeAsync(0);
      expect(h.published).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -w @trading-office/server -- DownstreamBacktestWatcher.test.ts`
Expected: FAIL — module `./DownstreamBacktestWatcher` does not exist.

- [ ] **Step 3: Implement the watcher**

Create `apps/server/src/operator/DownstreamBacktestWatcher.ts`:

```ts
import type { LabAgentEvent, LabCompletionSummary } from '../connector/tradinglab/labDtos';
import type { OfficeEvent } from 'office-gateway';

const FALLBACK_TEXT = 'Бэктест гипотезы завершён.';

export interface BacktestWatchGuards {
  idleMs: number;
  maxMs: number;
  bootstrapRetries: number;
  bootstrapIntervalMs: number;
  summaryRetries: number;
  summaryIntervalMs: number;
}

export interface DownstreamBacktestWatcherDeps {
  bridge: { subscribeAppended(cb: (e: LabAgentEvent) => void): () => void };
  client: {
    getAgentEvents(q: { taskId: string }): Promise<LabAgentEvent[]>;
    getCompletionSummary(taskId: string): Promise<LabCompletionSummary | null>;
  };
  bus: { publish(e: OfficeEvent): void };
  newIds: () => { operatorMessageId: string; replyMessageId: string };
  render: (s: LabCompletionSummary) => string;
  guards: BacktestWatchGuards;
}

export interface DownstreamBacktestWatcher {
  register(runCycleTaskId: string, conversationId: string): void;
  stop(): void;
}

interface Registration {
  conversationId: string;
  correlationId?: string;
  seen: Set<string>;
  idleTimer?: ReturnType<typeof setTimeout>;
  maxTimer?: ReturnType<typeof setTimeout>;
  done: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createDownstreamBacktestWatcher(deps: DownstreamBacktestWatcherDeps): DownstreamBacktestWatcher {
  const { guards } = deps;
  const regs = new Map<string, Registration>();
  const unsub = deps.bridge.subscribeAppended(onEvent);

  function teardown(taskId: string): void {
    const reg = regs.get(taskId);
    if (!reg) return;
    reg.done = true;
    if (reg.idleTimer) clearTimeout(reg.idleTimer);
    if (reg.maxTimer) clearTimeout(reg.maxTimer);
    regs.delete(taskId);
  }

  function armIdle(taskId: string, reg: Registration): void {
    if (reg.idleTimer) clearTimeout(reg.idleTimer);
    reg.idleTimer = setTimeout(() => teardown(taskId), guards.idleMs);
  }

  function register(runCycleTaskId: string, conversationId: string): void {
    if (regs.has(runCycleTaskId)) return;
    const reg: Registration = { conversationId, seen: new Set(), done: false };
    reg.maxTimer = setTimeout(() => teardown(runCycleTaskId), guards.maxMs);
    armIdle(runCycleTaskId, reg);
    regs.set(runCycleTaskId, reg);
    void bootstrap(runCycleTaskId, reg);
  }

  async function bootstrap(taskId: string, reg: Registration): Promise<void> {
    for (let i = 0; i <= guards.bootstrapRetries && !reg.done; i++) {
      const events = await deps.client.getAgentEvents({ taskId }).catch(() => []);
      const cid = events.find((e) => e.correlationId)?.correlationId;
      if (cid) { reg.correlationId = cid; return; }
      if (i < guards.bootstrapRetries) await sleep(guards.bootstrapIntervalMs);
    }
  }

  function onEvent(e: LabAgentEvent): void {
    if (e.type !== 'backtest.result_ready' || !e.correlationId) return;
    for (const [taskId, reg] of regs) {
      if (reg.done || reg.correlationId !== e.correlationId) continue;
      if (reg.seen.has(e.taskId)) return;
      reg.seen.add(e.taskId);
      armIdle(taskId, reg);
      void surface(reg, e).catch(() => {});
      return;
    }
  }

  async function fetchSummary(taskId: string): Promise<LabCompletionSummary | null> {
    for (let i = 0; i <= guards.summaryRetries; i++) {
      const s = await deps.client.getCompletionSummary(taskId);
      if (s) return s;
      if (i < guards.summaryRetries) await sleep(guards.summaryIntervalMs);
    }
    return null;
  }

  async function surface(reg: Registration, e: LabAgentEvent): Promise<void> {
    const summary = await fetchSummary(e.taskId);
    const text = summary ? deps.render(summary) : FALLBACK_TEXT;
    const { operatorMessageId, replyMessageId } = deps.newIds();
    const ts = new Date().toISOString();
    deps.bus.publish({
      type: 'operator_assistant_message',
      ts,
      operatorMessageId,
      conversationId: reg.conversationId,
      reply: { replyMessageId, operatorMessageId, conversationId: reg.conversationId, text, ts },
    });
  }

  function stop(): void {
    for (const taskId of [...regs.keys()]) teardown(taskId);
    unsub();
  }

  return { register, stop };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -w @trading-office/server -- DownstreamBacktestWatcher.test.ts`
Expected: PASS (all six cases).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck -w @trading-office/server`
Expected: clean. (If `OfficeEvent` is not importable from `office-gateway` at the package root, import it from the path the rest of `apps/server` uses — grep an existing server file for `OfficeEvent`.)

```bash
git add apps/server/src/operator/DownstreamBacktestWatcher.ts apps/server/src/operator/DownstreamBacktestWatcher.test.ts
git commit -m "feat(server): DownstreamBacktestWatcher surfaces backtest results as proactive messages"
```

---

### Task 5: Wire the watcher (config flag + responder hook + index.ts)

**Files:**
- Modify: `apps/server/src/config.ts` (add the flag + guards to `OfficeServerConfig` / `loadConfig`)
- Modify: `apps/server/src/operator/TradingLabOperatorResponder.ts` (call an `onRunCycleTask` hook in the `task_created` case, `:64-67`)
- Modify: `apps/server/src/index.ts` (construct the watcher when the flag is on; pass `register` as the responder's `onRunCycleTask`; call `watcher.stop()` in the shutdown path)
- Test: `apps/server/src/config.test.ts` (or the existing config test file) and `apps/server/src/operator/TradingLabOperatorResponder.test.ts`

**Interfaces:**
- Consumes: `createDownstreamBacktestWatcher` (Task 4); `loadConfig`; the responder factory.
- Produces: `config.downstreamBacktests: { enabled: boolean } & BacktestWatchGuards`; an optional `onRunCycleTask?: (runCycleTaskId: string, conversationId: string) => void` responder dep.

- [ ] **Step 1: Write the failing responder-hook test**

In `apps/server/src/operator/TradingLabOperatorResponder.test.ts`, add a test asserting the hook fires for a run_cycle `task_created` and not otherwise. Mirror the file's existing way of invoking the responder with a fake chat response; the key assertion:

```ts
it('calls onRunCycleTask for a research.run_cycle task_created', async () => {
  const onRunCycleTask = vi.fn();
  // Build the responder with deps including onRunCycleTask (mirror the existing
  // makeTradingLabOperatorResponder construction used by sibling tests), with a
  // fake chat returning { kind: 'task_created', sessionId: 's', taskId: 'rc-1',
  //   taskType: 'research.run_cycle', status: 'queued' }.
  await respond(/* the message input the sibling tests use */, bus);
  expect(onRunCycleTask).toHaveBeenCalledWith('rc-1', expect.any(String)); // (taskId, conversationId)
});

it('does NOT call onRunCycleTask for a strategy.onboard task_created without a run_cycle next step', async () => {
  const onRunCycleTask = vi.fn();
  // fake chat returns { kind: 'task_created', ..., taskType: 'strategy.onboard', status: 'queued' } (no plannedNextStep)
  await respond(/* ... */, bus);
  expect(onRunCycleTask).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -w @trading-office/server -- TradingLabOperatorResponder.test.ts`
Expected: FAIL — `onRunCycleTask` is never called (the dep does not exist yet).

- [ ] **Step 3: Add the responder hook**

In `apps/server/src/operator/TradingLabOperatorResponder.ts`: thread an optional `onRunCycleTask?: (runCycleTaskId: string, conversationId: string) => void` through the responder deps the same way `startFollow` is already threaded into `emitFromLabResponse`. In the `task_created` case (`:64-67`), after the existing `startFollow(...)` call, add:

```ts
      if (resp.taskType === 'research.run_cycle' || resp.plannedNextStep?.taskType === 'research.run_cycle') {
        onRunCycleTask?.(resp.taskId, ids.conversationId);
      }
```

Both `makeTradingLabOperatorResponder` and `makeTradingLabOperatorConfirmResponder` should forward `onRunCycleTask` from their deps (so a confirmed run_cycle also registers).

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -w @trading-office/server -- TradingLabOperatorResponder.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing config test**

In `apps/server/src/config.test.ts` (mirror the existing config-test style):

```ts
it('downstream-backtests flag defaults off; on when OPERATOR_DOWNSTREAM_BACKTESTS=true', () => {
  expect(loadConfig({ ...baseEnv }).downstreamBacktests.enabled).toBe(false);
  expect(loadConfig({ ...baseEnv, OPERATOR_DOWNSTREAM_BACKTESTS: 'true' }).downstreamBacktests.enabled).toBe(true);
});
```

(`baseEnv` = whatever minimal env the existing config tests use for `trading-lab` mode; reuse it.)

- [ ] **Step 6: Run to verify it fails**

Run: `npm run test -w @trading-office/server -- config.test.ts`
Expected: FAIL — `downstreamBacktests` is not on the config.

- [ ] **Step 7: Add config + guards**

In `apps/server/src/config.ts`, add to `OfficeServerConfig`:

```ts
  downstreamBacktests: {
    enabled: boolean;
    idleMs: number;
    maxMs: number;
    bootstrapRetries: number;
    bootstrapIntervalMs: number;
    summaryRetries: number;
    summaryIntervalMs: number;
  };
```

and in `loadConfig`'s returned object (reuse the existing `num` / `str` helpers and the `chatFollow` bootstrap values where sensible):

```ts
    downstreamBacktests: {
      enabled: env.OPERATOR_DOWNSTREAM_BACKTESTS === 'true' && connectorMode === 'trading-lab',
      idleMs: num(env, 'OFFICE_BACKTEST_WATCH_IDLE_MS', 120000),
      maxMs: num(env, 'OFFICE_BACKTEST_WATCH_MAX_MS', 900000),
      bootstrapRetries: num(env, 'OFFICE_CHAT_BOOTSTRAP_RETRIES', 8),
      bootstrapIntervalMs: num(env, 'OFFICE_CHAT_BOOTSTRAP_INTERVAL_MS', 750),
      summaryRetries: num(env, 'OFFICE_BACKTEST_SUMMARY_RETRIES', 5),
      summaryIntervalMs: num(env, 'OFFICE_BACKTEST_SUMMARY_INTERVAL_MS', 500),
    },
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm run test -w @trading-office/server -- config.test.ts`
Expected: PASS.

- [ ] **Step 9: Construct + wire the watcher in `index.ts`**

In `apps/server/src/index.ts`, in the `chatToken`-set branch (where `responderDeps` is built and the responders are made), when `config.downstreamBacktests.enabled` is true:

```ts
    const backtestWatcher = config.downstreamBacktests.enabled
      ? createDownstreamBacktestWatcher({
          bridge: wiring.bridge,
          client: wiring.client,
          bus,
          newIds: () => { const { operatorMessageId, replyMessageId } = defaultNewIds()(); return { operatorMessageId, replyMessageId }; },
          render: renderCompletionSummary,
          guards: config.downstreamBacktests,
        })
      : undefined;
```

Add `onRunCycleTask: backtestWatcher ? (taskId, cid) => backtestWatcher.register(taskId, cid) : undefined` to `responderDeps`. In the `shutdown()` path (`index.ts:47-51`), add `backtestWatcher?.stop();`.

(`bus` must be in scope where the responders are wired; if it is created later, move the watcher construction next to it. `defaultNewIds` is exported from `TradingLabOperatorResponder.ts`; `renderCompletionSummary` from `operator/completionSummaryRender.ts`.)

- [ ] **Step 10: Full server suite + typecheck + web build**

Run:
```
npm run test -w @trading-office/server
npm run typecheck -w @trading-office/server
npm run typecheck -w @trading-office/web && npm run build -w @trading-office/web
```
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add apps/server/src/config.ts apps/server/src/config.test.ts apps/server/src/operator/TradingLabOperatorResponder.ts apps/server/src/operator/TradingLabOperatorResponder.test.ts apps/server/src/index.ts
git commit -m "feat(server): wire DownstreamBacktestWatcher behind OPERATOR_DOWNSTREAM_BACKTESTS"
```

---

## Self-review notes

- **Spec coverage:** Task 1 → spec §"Change 2" (DTO); Tasks 2–3 → §"Change 4" (web); Task 4 → §"Change 3" core (watcher, bootstrap correlationId, dedup, bounded-retry summary, idle/max teardown, fallback); Task 5 → §"Change 3" wiring + flag + registration hook. Error handling (null-summary fallback, dedup-on-replay, idle/max teardown, per-event swallow, flag-off no-op) is covered in Task 4 tests + Task 5 flag test.
- **Type consistency:** `operatorReplySchema` reused everywhere; `AssistantReply` = the event's `reply`; watcher `newIds()` returns `{operatorMessageId, replyMessageId}` and reuses the registration's `conversationId` (NOT a fresh one) — matches the spec's "same conversation, fresh message id".
- **Race:** `fetchSummary` bounded retry absorbs the lab status-flip race; on persistent null, the fallback fires (no silence).
- **Q4:** `assistant_turn` is additive; `mapById`/`pendingCompleted` untouched (asserted in Task 2's second test).
- **Known-limitation honesty:** bus broadcast (proactive turn appears in all tabs) and best-effort in-memory registry are accepted per the spec — no task attempts to fix them.

## Definition of Done

Both PRs (lab PR1 + this) green and merged → live-verify on the demo stack (a confirmed `run_cycle` yields a visible proactive assistant message per backtest result) → flip `OPERATOR_DOWNSTREAM_BACKTESTS=true` (or record an explicit decision to leave it off). The slice is not closed until the live-verify + flag step is done.
