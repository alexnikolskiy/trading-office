# Operator confirmation UI — follow-up fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three issues in the shipped operator confirmation UI: the confirm outcome overwriting the proposal turn (Q1, real bug), the interpretation rendered twice (Q3), and the transcript reducer dropping an out-of-order `completed` (Q4 hardening).

**Architecture:** Q1 + Q3 are office-server changes in `apps/server/src/operator/TradingLabOperatorResponder.ts` (globally-unique IDs; filter the redundant `interpretation` evidence card). Q4 is an office-web change in `apps/web/src/floor/panels/operatorTranscript.ts` (buffer a `completed` whose turn doesn't exist yet, flush it on `accepted`). All three are additive and behaviour-preserving outside the named defect.

**Tech Stack:** TypeScript, Vitest, Node `crypto`. Office server is transpiled; office web is Vite + React (no component-test harness).

## Global Constraints

- **npm workspaces, NOT pnpm.** Server tests: `npm run test -w @trading-office/server`; server typecheck: `npm run typecheck -w @trading-office/server`. Web tests: `npm run test -w @trading-office/web -- <file>`; web typecheck: `npm run typecheck -w @trading-office/web`.
- **Web has NO component-test harness — by design** (no jsdom/RTL, zero `.test.tsx`). Q4 is verified by **reducer-level unit tests only**.
- **Hand-mirrored DTOs / no trading-lab import; audit-safe projection** (badges carry kind/label/sourceId only); `assertNoExecutionAuthority` unchanged. Changes are additive — the WS event shape is unchanged.
- **Q2 is OUT OF SCOPE** (`strategy.onboard` confirm "Done." fallback — needs a live trace; tracked separately).

---

### Task 1: Q1 — globally-unique IDs in `defaultNewIds` (office-server)

**Files:**
- Modify: `apps/server/src/operator/TradingLabOperatorResponder.ts` (the `defaultNewIds` function, currently lines 14-17, and a new `node:crypto` import)
- Test: `apps/server/src/operator/TradingLabOperatorResponder.test.ts` (add a collision-guard test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `defaultNewIds(): () => FollowerIds` now returns UUID-valued ids; `FollowerIds` shape (`{ operatorMessageId: string; conversationId: string; replyMessageId: string }`) is unchanged.

- [ ] **Step 1: Write the failing collision-guard test**

In `apps/server/src/operator/TradingLabOperatorResponder.test.ts`, add (ensure `defaultNewIds` is in the import from `./TradingLabOperatorResponder`):

```ts
it('defaultNewIds: two independent instances never collide on operatorMessageId (Q1 regression)', () => {
  const a = defaultNewIds();
  const b = defaultNewIds();
  const a1 = a();
  const b1 = b();
  expect(a1.operatorMessageId).not.toBe(b1.operatorMessageId);
  // each call is also unique within an instance
  expect(a().operatorMessageId).not.toBe(a1.operatorMessageId);
  // all three id fields are distinct, non-empty strings
  expect(new Set([a1.operatorMessageId, a1.conversationId, a1.replyMessageId]).size).toBe(3);
  expect(a1.operatorMessageId.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -w @trading-office/server -- TradingLabOperatorResponder.test.ts`
Expected: FAIL — with the current counter, `a().operatorMessageId === b().operatorMessageId === 'm1'`, so `expect(a1.operatorMessageId).not.toBe(b1.operatorMessageId)` fails.

- [ ] **Step 3: Implement UUID ids**

In `apps/server/src/operator/TradingLabOperatorResponder.ts`, add the import at the top (with the other imports):

```ts
import { randomUUID } from 'node:crypto';
```

Replace the `defaultNewIds` function (currently):

```ts
export function defaultNewIds(): () => FollowerIds {
  let c = 0;
  return () => { c += 1; return { operatorMessageId: `m${c}`, conversationId: `c${c}`, replyMessageId: `r${c}` }; };
}
```

with:

```ts
export function defaultNewIds(): () => FollowerIds {
  return () => ({ operatorMessageId: randomUUID(), conversationId: randomUUID(), replyMessageId: randomUUID() });
}
```

- [ ] **Step 4: Run the test — expect PASS, then full server suite + typecheck**

Run: `npm run test -w @trading-office/server -- TradingLabOperatorResponder.test.ts` → PASS.
Run: `npm run test -w @trading-office/server` → all green (existing responder/route/app tests pass their own `deps.newIds`, so they are unaffected).
Run: `npm run typecheck -w @trading-office/server` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/operator/TradingLabOperatorResponder.ts apps/server/src/operator/TradingLabOperatorResponder.test.ts
git commit -m "fix(office): globally-unique operator ids — confirm no longer collides with proposal turn (Q1)"
```

---

### Task 2: Q3 — drop the redundant interpretation evidence card (office-server)

**Files:**
- Modify: `apps/server/src/operator/TradingLabOperatorResponder.ts` (the `toBadges` function, currently lines 39-41)
- Test: `apps/server/src/operator/TradingLabOperatorResponder.test.ts` (assert the published proposal's evidence excludes `interpretation`)

**Interfaces:**
- Consumes: the existing `makeTradingLabOperatorResponder` test harness (fake bus + fake chat) already used in this file's `runTurn assistant_message` test.
- Produces: `toBadges` filters `kind:'interpretation'` cards; the `operator_message_completed` reply's `evidence` no longer contains an interpretation badge.

- [ ] **Step 1: Write the failing test (behavior via the published event)**

In `apps/server/src/operator/TradingLabOperatorResponder.test.ts`, add a test mirroring the existing `runTurn assistant_message proposal` test's harness (fake bus collecting events, fake `chat.send` returning an `assistant_message`). The lab response carries an `interpretation` card plus a real `exact_duplicate` card:

```ts
it('runTurn drops the interpretation evidence card from the proposal badges (Q3)', async () => {
  const chat = {
    send: async () => ({
      kind: 'assistant_message',
      sessionId: 's1',
      message: 'Вижу стратегию. Подтвердите запуск анализа.',
      evidence: [
        { kind: 'interpretation', text: 'Вижу стратегию. Подтвердите запуск анализа.' },
        { kind: 'exact_duplicate', text: 'dup', sourceId: 'pf1' },
      ],
      actions: [{ id: 'confirm', label: 'Подтвердить', style: 'primary' }],
      pendingInteractionId: 'p1',
    }),
    confirm: async () => { throw new Error('unused'); },
  };
  const respond = makeTradingLabOperatorResponder(depsWith(chat)); // existing helper in this file
  respond({ text: 'analyse X', source: 'web', target: 'orchestrator', floorId: 'trading-lab' }, bus); // existing bus
  await flush(); // existing helper
  const done = events.find((e) => e.type === 'operator_message_completed');
  const badges = done.reply.evidence;
  expect(badges).toHaveLength(1);
  expect(badges[0].kind).toBe('exact_duplicate');
  expect(badges.some((b) => b.kind === 'interpretation')).toBe(false);
  // the interpretation is still the message text:
  expect(done.reply.text).toBe('Вижу стратегию. Подтвердите запуск анализа.');
});
```

(Adapt `depsWith` / `bus` / `events` / `flush` to the file's real helpers — they already exist from the PR-O1 Task 3 tests.)

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -w @trading-office/server -- TradingLabOperatorResponder.test.ts`
Expected: FAIL — today `toBadges` maps the interpretation card too, so `badges` has length 2 (interpretation + exact_duplicate).

- [ ] **Step 3: Implement the filter**

In `apps/server/src/operator/TradingLabOperatorResponder.ts`, replace `toBadges` (currently):

```ts
function toBadges(cards: LabEvidenceCard[]): OperatorEvidenceBadge[] {
  return cards.map((c) => ({ kind: c.kind, label: c.kind === 'interpretation' ? c.text : badgeLabel(c), sourceId: c.sourceId }));
}
```

with:

```ts
function toBadges(cards: LabEvidenceCard[]): OperatorEvidenceBadge[] {
  return cards
    .filter((c) => c.kind !== 'interpretation')
    .map((c) => ({ kind: c.kind, label: badgeLabel(c), sourceId: c.sourceId }));
}
```

(Leave `badgeLabel` untouched — its `interpretation` fallthrough is now unreachable from this path but harmless; do not refactor it.)

- [ ] **Step 4: Run the test — expect PASS, then full server suite + typecheck**

Run: `npm run test -w @trading-office/server -- TradingLabOperatorResponder.test.ts` → PASS.
Run: `npm run test -w @trading-office/server` → all green. Run: `npm run typecheck -w @trading-office/server` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/operator/TradingLabOperatorResponder.ts apps/server/src/operator/TradingLabOperatorResponder.test.ts
git commit -m "fix(office): drop redundant interpretation evidence card from proposal badges (Q3)"
```

---

### Task 3: Q4 — buffer `completed`-without-turn in the transcript reducer (office-web)

**Files:**
- Modify: `apps/web/src/floor/panels/operatorTranscript.ts`
- Test: `apps/web/src/floor/panels/operatorTranscript.test.ts`

**Interfaces:**
- Consumes: `OfficeEvent` (already imported).
- Produces: `OperatorTranscriptState` gains `pendingCompleted: Record<string, CompletedReply>`; `emptyTranscript` initializes it to `{}`. Behaviour: a `operator_message_completed` whose `operatorMessageId` has no turn is buffered and applied when the matching `accepted` binds the turn.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/floor/panels/operatorTranscript.test.ts`, add:

```ts
it('completed arriving BEFORE accepted is buffered and applied (Q4)', () => {
  // submit (turn has operatorMessageId=null) → completed for mX arrives first → accepted binds localId→mX
  let s = transcriptReducer(emptyTranscript, { kind: 'submit', localId: 'L1', text: 'go' });
  s = transcriptReducer(s, {
    kind: 'event',
    event: { type: 'operator_message_completed', ts: 't', operatorMessageId: 'mX', conversationId: 'cX', replyMessageId: 'rX',
      reply: { replyMessageId: 'rX', operatorMessageId: 'mX', conversationId: 'cX', text: 'outcome', ts: 't' } },
  });
  // not dropped — held in pendingCompleted, turn still pending
  expect(s.turns[0]!.status).toBe('pending');
  expect(s.pendingCompleted['mX']).toBeDefined();
  s = transcriptReducer(s, { kind: 'accepted', localId: 'L1', operatorMessageId: 'mX', conversationId: 'cX' });
  // applied on accepted; buffer cleared
  expect(s.turns[0]!.status).toBe('completed');
  expect(s.turns[0]!.replyText).toBe('outcome');
  expect(s.pendingCompleted['mX']).toBeUndefined();
});

it('in-order submit → accepted → completed is unchanged (Q4 no regression)', () => {
  let s = transcriptReducer(emptyTranscript, { kind: 'submit', localId: 'L1', text: 'go' });
  s = transcriptReducer(s, { kind: 'accepted', localId: 'L1', operatorMessageId: 'mY', conversationId: 'cY' });
  s = transcriptReducer(s, {
    kind: 'event',
    event: { type: 'operator_message_completed', ts: 't', operatorMessageId: 'mY', conversationId: 'cY', replyMessageId: 'rY',
      reply: { replyMessageId: 'rY', operatorMessageId: 'mY', conversationId: 'cY', text: 'hi', ts: 't' } },
  });
  expect(s.turns[0]!.status).toBe('completed');
  expect(s.turns[0]!.replyText).toBe('hi');
  expect(Object.keys(s.pendingCompleted)).toHaveLength(0);
});
```

- [ ] **Step 2: Run them — expect FAIL**

Run: `npm run test -w @trading-office/web -- operatorTranscript.test.ts`
Expected: FAIL — `s.pendingCompleted` is `undefined` (property doesn't exist), and the out-of-order completed is currently dropped (turn stays `pending` with empty `replyText` after `accepted`).

- [ ] **Step 3: Add the state field, the helper, and the buffer/flush logic**

In `apps/web/src/floor/panels/operatorTranscript.ts`:

(a) Add a reply-type alias after the imports:

```ts
type CompletedReply = Extract<OfficeEvent, { type: 'operator_message_completed' }>['reply'];
```

(b) Extend the state interface + `emptyTranscript`:

```ts
export interface OperatorTranscriptState {
  turns: OperatorTurn[];
  pendingCompleted: Record<string, CompletedReply>;
}

export const emptyTranscript: OperatorTranscriptState = { turns: [], pendingCompleted: {} };
```

(c) Add a shared apply helper at module scope (above `transcriptReducer`):

```ts
function withCompleted(turn: OperatorTurn, reply: CompletedReply): OperatorTurn {
  return {
    ...turn,
    replyText: reply.text,
    status: 'completed',
    evidence: reply.evidence,
    actions: reply.actions,
    pendingInteractionId: reply.pendingInteractionId,
    sessionId: reply.sessionId,
  };
}
```

(d) Make `mapById` preserve the rest of the state (it currently returns `{ turns }`, which would drop `pendingCompleted`):

```ts
function mapById(
  state: OperatorTranscriptState,
  operatorMessageId: string,
  fn: (t: OperatorTurn) => OperatorTurn,
): OperatorTranscriptState {
  if (!state.turns.some((t) => t.operatorMessageId === operatorMessageId)) return state;
  return { ...state, turns: state.turns.map((t) => (t.operatorMessageId === operatorMessageId ? fn(t) : t)) };
}
```

(e) Preserve `pendingCompleted` in the `submit` and `submit_failed` cases (they currently return `{ turns: … }`):

```ts
    case 'submit':
      return {
        ...state,
        turns: [
          ...state.turns,
          { localId: action.localId, operatorMessageId: null, conversationId: null, userText: action.text, replyText: '', status: 'pending' },
        ],
      };
```

```ts
    case 'submit_failed':
      return {
        ...state,
        turns: state.turns.map((t) =>
          t.localId === action.localId ? { ...t, status: 'failed', error: action.error } : t,
        ),
      };
```

(f) Replace the `accepted` case to bind the turn AND flush any buffered completed for that id:

```ts
    case 'accepted': {
      const turns = state.turns.map((t) =>
        t.localId === action.localId
          ? { ...t, operatorMessageId: action.operatorMessageId, conversationId: action.conversationId, status: 'streaming' as const }
          : t,
      );
      const buffered = state.pendingCompleted[action.operatorMessageId];
      if (!buffered) return { ...state, turns };
      const { [action.operatorMessageId]: _applied, ...restPending } = state.pendingCompleted;
      return {
        ...state,
        turns: turns.map((t) => (t.operatorMessageId === action.operatorMessageId ? withCompleted(t, buffered) : t)),
        pendingCompleted: restPending,
      };
    }
```

(g) Replace the `operator_message_completed` arm in the `event` case to buffer-or-apply, and route the delta/failed arms (unchanged) plus the completed arm. Replace the existing completed `if` block:

```ts
      if (e.type === 'operator_message_completed') {
        const hasTurn = state.turns.some((t) => t.operatorMessageId === e.operatorMessageId);
        if (!hasTurn) {
          return { ...state, pendingCompleted: { ...state.pendingCompleted, [e.operatorMessageId]: e.reply } };
        }
        return mapById(state, e.operatorMessageId, (t) => withCompleted(t, e.reply));
      }
```

(The `operator_message_delta` and `operator_message_failed` arms already go through `mapById`, which now preserves `pendingCompleted` — no change needed to them. The `resolve` case already uses `mapById` — no change needed.)

- [ ] **Step 4: Run the tests — expect PASS, then full web suite + typecheck**

Run: `npm run test -w @trading-office/web -- operatorTranscript.test.ts` → PASS (both new tests + the existing reducer/helper tests).
Run: `npm run test -w @trading-office/web` → all green. Run: `npm run typecheck -w @trading-office/web` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/floor/panels/operatorTranscript.ts apps/web/src/floor/panels/operatorTranscript.test.ts
git commit -m "fix(office-web): buffer out-of-order completed in transcript reducer (Q4)"
```

---

## Self-Review

- **Spec coverage:** Q1 (UUID `defaultNewIds`) = Task 1 ✓; Q3 (`toBadges` filters interpretation) = Task 2 ✓; Q4 (reducer buffers completed-without-turn) = Task 3 ✓. Q2 explicitly out of scope (no task) — matches the spec.
- **Placeholder scan:** none — every code step carries the actual code. The Task 2 test's `depsWith`/`bus`/`events`/`flush` are the file's existing PR-O1 Task 3 helpers (named in the step), not unwritten placeholders.
- **Type consistency:** `FollowerIds` (Task 1) shape unchanged; `CompletedReply` (Task 3) defined once and used in `withCompleted` + state + `accepted` + completed arm; `OperatorTranscriptState.pendingCompleted` is the same name across `emptyTranscript`, `mapById`, all cases, and the tests; `withCompleted` carries exactly the field set the existing inline completed arm carried (replyText/status/evidence/actions/pendingInteractionId/sessionId).
- **Constraint check:** npm-workspace commands throughout; Q4 verified at the reducer level only (no `.tsx` test / no jsdom); no trading-lab import added; badges stay kind/label/sourceId; WS event shape unchanged; `assertNoExecutionAuthority` untouched.
- **Behaviour-preservation:** Task 1 changes only id *values* (tests inject their own ids); Task 2 only removes interpretation badges (real evidence order preserved); Task 3's in-order path is asserted unchanged and `pendingCompleted` is proven not to leak.

## Execution Handoff

Three independent tasks. Use subagent-driven TDD: fresh implementer per task + spec & code-quality review, then a final whole-PR review. Do not push/PR without the user's go-ahead. Q2 (onboard "Done." fallback) is a separate future task needing a live event/HTTP trace.
