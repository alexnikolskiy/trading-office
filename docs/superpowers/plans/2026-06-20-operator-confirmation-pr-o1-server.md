# PR-O1: office server — assistant_message + structured confirm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the trading-office server about the lab's `assistant_message` proposal (so the chat stops hanging on THINKING) and add the structured confirm round-trip (`POST /api/office/operator/confirm` → lab `POST /chat/confirm`), surfacing the proposal text + evidence + actions over the existing WS event model.

**Architecture:** The lab's chat reply is consumed async over the office WS `OfficeEventBus` (`operator_message_accepted → progress → completed/failed`). PR-L (merged, lab `2ee5aa4`) gave the lab a `POST /chat/confirm` endpoint. This PR (1) adds the `assistant_message` variant to the hand-mirrored `LabChatResponse` + a `runTurn` case that emits it as a terminal `completed` reply carrying evidence/actions/pendingInteractionId/sessionId; (2) adds `TradingLabChatConnector.confirm()`; (3) adds an office `operator/confirm` route + a confirm responder that maps the lab response through the SAME response→events mapper `runTurn` uses, so `task_created` still starts the Slice-3 `ConversationFollower`.

**Tech Stack:** TypeScript, Hono, Zod, Vitest. The office server is **transpiled** (not `--experimental-strip-types`) — TS parameter properties ARE allowed here (`TradingLabChatConnector` already uses `constructor(private readonly deps)`).

## Global Constraints

- **Hand-mirrored DTOs:** `apps/server/src/connector/tradinglab/labDtos.ts` declares only the fields the office reads; **never import a trading-lab package.**
- **No execution authority:** `assertNoExecutionAuthority` continues to apply on every operator entry point; confirm only reaches the lab's research enqueue.
- **Audit-safe projection:** office evidence badges carry kind + label + optional `sourceId` only — never strategy text or embeddings. (Lab evidence cards already carry only IDs/labels/codes.)
- **Lab confirm outcome mapping (verified against shipped PR-L):** the lab returns a graceful **`assistant_message`** for `not_found` / `expired` / `cancel` — **NOT** a `rejected` kind. Treat an `assistant_message` with no `actions` as **terminal → `completed(text)`**; never await a `rejected` that won't arrive.
- **WS event reuse:** the proposal arrives as `operator_message_completed` with an extended `reply`. Do not invent a new event type.
- Vitest: `pnpm --filter @trading-office/server test <path>` (or the repo's documented test command — match what `apps/server` uses); typecheck via the repo's `typecheck` script must stay clean.

---

### Task 1: office-gateway wire additions (schemas + OFFICE_API + dto exports)

**Files:**
- Modify: `packages/office-gateway/src/schemas.ts` (extend `operatorReplySchema`; add `operatorConfirmSchema`, `operatorEvidenceBadgeSchema`, `operatorActionSchema`)
- Modify: `packages/office-gateway/src/http.ts` (add `operatorConfirm` to `OFFICE_API`)
- Modify: `packages/office-gateway/src/dto.ts` (export the new inferred types)
- Test: `packages/office-gateway/src/schemas.test.ts` (create if absent; otherwise add cases)

**Interfaces:**
- Produces: `operatorConfirmSchema` = `{ pendingInteractionId: string; sessionId: string; decision: 'confirm'|'cancel' }`; `OperatorConfirm` type; `OperatorEvidenceBadge` = `{ kind: 'interpretation'|'exact_duplicate'|'similar'|'warning'; label: string; sourceId?: string }`; `OperatorAction` = `{ id: 'confirm'|'cancel'; label: string; style: 'primary'|'secondary' }`; extended `OperatorReply` with optional `evidence`, `actions`, `pendingInteractionId`, `sessionId`; `OFFICE_API.operatorConfirm = '/api/office/operator/confirm'`.

- [ ] **Step 1: Write the failing schema test**

In `packages/office-gateway/src/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { operatorReplySchema, operatorConfirmSchema } from './schemas';

describe('operator confirm wire', () => {
  it('operatorReplySchema accepts an evidence/actions proposal reply', () => {
    const r = operatorReplySchema.parse({
      replyMessageId: 'r1', operatorMessageId: 'm1', conversationId: 'c1', text: 'proposal', ts: 't',
      evidence: [{ kind: 'exact_duplicate', label: '⚠ точный дубликат', sourceId: 'p1' }],
      actions: [{ id: 'confirm', label: 'Подтвердить', style: 'primary' }],
      pendingInteractionId: 'p1', sessionId: 's1',
    });
    expect(r.actions?.[0].id).toBe('confirm');
    expect(r.evidence?.[0].sourceId).toBe('p1');
  });

  it('operatorReplySchema still accepts a plain text reply (back-compat)', () => {
    const r = operatorReplySchema.parse({ replyMessageId: 'r', operatorMessageId: 'm', conversationId: 'c', text: 'hi', ts: 't' });
    expect(r.actions).toBeUndefined();
  });

  it('operatorConfirmSchema validates a confirm request', () => {
    const v = operatorConfirmSchema.parse({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' });
    expect(v.decision).toBe('confirm');
    expect(() => operatorConfirmSchema.parse({ pendingInteractionId: 'p', sessionId: 's', decision: 'maybe' })).toThrow();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`operatorConfirmSchema` undefined; reply schema rejects extra fields)

Run: `pnpm --filter @trading-office/office-gateway test schemas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the schema additions**

In `packages/office-gateway/src/schemas.ts`, add before `operatorReplySchema`:

```ts
export const operatorEvidenceBadgeSchema = z.object({
  kind: z.enum(['interpretation', 'exact_duplicate', 'similar', 'warning']),
  label: z.string(),
  sourceId: z.string().optional(),
});
export const operatorActionSchema = z.object({
  id: z.enum(['confirm', 'cancel']),
  label: z.string(),
  style: z.enum(['primary', 'secondary']),
});
export const operatorConfirmSchema = z.object({
  pendingInteractionId: z.string(),
  sessionId: z.string(),
  decision: z.enum(['confirm', 'cancel']),
});
```

Replace `operatorReplySchema` with the extended version (the four new fields are **optional**, preserving back-compat + the discriminated `officeEventSchema` `operator_message_completed` arm that embeds it):

```ts
export const operatorReplySchema = z.object({
  replyMessageId: z.string(),
  operatorMessageId: z.string(),
  conversationId: z.string(),
  text: z.string(),
  ts: z.string(),
  evidence: z.array(operatorEvidenceBadgeSchema).optional(),
  actions: z.array(operatorActionSchema).optional(),
  pendingInteractionId: z.string().optional(),
  sessionId: z.string().optional(),
});
```

- [ ] **Step 4: Add the OFFICE_API path**

In `packages/office-gateway/src/http.ts`, add inside `OFFICE_API` (after `operatorMessages`):

```ts
  operatorConfirm: '/api/office/operator/confirm',
```

- [ ] **Step 5: Export the new types**

In `packages/office-gateway/src/dto.ts`, add to the schema imports `operatorConfirmSchema, operatorEvidenceBadgeSchema, operatorActionSchema`, and append:

```ts
export type OperatorConfirm = z.infer<typeof operatorConfirmSchema>;
export type OperatorEvidenceBadge = z.infer<typeof operatorEvidenceBadgeSchema>;
export type OperatorAction = z.infer<typeof operatorActionSchema>;
```

- [ ] **Step 6: Run the test — expect PASS, then typecheck**

Run: `pnpm --filter @trading-office/office-gateway test schemas.test.ts`
Expected: PASS.
Run the repo typecheck script; expect clean (the optional fields don't break the existing `officeEventSchema`).

- [ ] **Step 7: Commit**

```bash
git add packages/office-gateway/src/schemas.ts packages/office-gateway/src/http.ts packages/office-gateway/src/dto.ts packages/office-gateway/src/schemas.test.ts
git commit -m "feat(office-gateway): operator confirm wire — evidence/actions on reply + confirm schema + route const"
```

---

### Task 2: labDtos `assistant_message` variant + `TradingLabChatConnector.confirm()`

**Files:**
- Modify: `apps/server/src/connector/tradinglab/labDtos.ts` (add `assistant_message` to `LabChatResponse`; add `LabEvidenceCard`, `LabAction`)
- Modify: `apps/server/src/operator/TradingLabChatConnector.ts` (add `confirm()`)
- Test: `apps/server/src/operator/TradingLabChatConnector.test.ts` (add confirm cases; create if absent)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LabChatResponse` gains `{ kind: 'assistant_message'; sessionId: string; message: string; evidence: LabEvidenceCard[]; actions: LabAction[]; pendingInteractionId?: string }`; `LabEvidenceCard = { kind: 'interpretation'|'exact_duplicate'|'similar'|'warning'; text: string; sourceId?: string }`; `LabAction = { id: 'confirm'|'cancel'; label: string; style: 'primary'|'secondary' }`. `TradingLabChatConnector.confirm(input: { pendingInteractionId: string; sessionId: string; decision: 'confirm'|'cancel' }): Promise<LabChatResponse>`.

- [ ] **Step 1: Add the DTO variant**

In `apps/server/src/connector/tradinglab/labDtos.ts`, add the two interfaces above the `LabChatResponse` union, then add the variant as the first member of the union:

```ts
export interface LabEvidenceCard { kind: 'interpretation' | 'exact_duplicate' | 'similar' | 'warning'; text: string; sourceId?: string }
export interface LabAction { id: 'confirm' | 'cancel'; label: string; style: 'primary' | 'secondary' }

export type LabChatResponse =
  | { kind: 'assistant_message'; sessionId: string; message: string; evidence: LabEvidenceCard[]; actions: LabAction[]; pendingInteractionId?: string }
  | { kind: 'task_created'; sessionId: string; taskId: string; taskType: string; status: LabTaskStatus; plannedNextStep?: { taskType: string; after: string } }
  // ...rest of the existing union unchanged...
```

- [ ] **Step 2: Write the failing connector test**

In `apps/server/src/operator/TradingLabChatConnector.test.ts` (mirror the existing `send()` test wiring — a `fetchImpl` stub returning a `Response`):

```ts
it('confirm() POSTs to /chat/confirm with bearer + body and returns the lab response', async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new Response(JSON.stringify({ kind: 'task_created', sessionId: 's1', taskId: 't1', taskType: 'strategy.onboard', status: 'queued' }), { status: 200 });
  }) as unknown as typeof fetch;
  const c = new TradingLabChatConnector({ chatUrl: 'http://lab:3000', chatToken: 'tok', requestTimeoutMs: 1000, fetchImpl });

  const res = await c.confirm({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' });

  expect(captured!.url).toBe('http://lab:3000/chat/confirm');
  expect((captured!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  expect(JSON.parse(captured!.init.body as string)).toEqual({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' });
  expect(res.kind).toBe('task_created');
});

it('confirm() maps a 401 to upstream_unauthorized', async () => {
  const fetchImpl = (async () => new Response('', { status: 401 })) as unknown as typeof fetch;
  const c = new TradingLabChatConnector({ chatUrl: 'http://lab:3000', chatToken: 'tok', requestTimeoutMs: 1000, fetchImpl });
  await expect(c.confirm({ pendingInteractionId: 'p', sessionId: 's', decision: 'confirm' })).rejects.toMatchObject({ office: { code: 'upstream_unauthorized' } });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`confirm` is not a function)

Run: `pnpm --filter @trading-office/server test TradingLabChatConnector.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `confirm()`**

In `TradingLabChatConnector.ts`, add the input type near `ChatSendInput`:

```ts
export interface ChatConfirmInput {
  pendingInteractionId: string;
  sessionId: string;
  decision: 'confirm' | 'cancel';
}
```

and the method inside the class (mirror `send()`'s timeout + error mapping exactly; only the path + body differ):

```ts
  async confirm(input: ChatConfirmInput): Promise<LabChatResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.deps.requestTimeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.deps.chatUrl}/chat/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${this.deps.chatToken}` },
        body: JSON.stringify({ pendingInteractionId: input.pendingInteractionId, sessionId: input.sessionId, decision: input.decision }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw makeErr('upstream_unavailable', `chat confirm request failed: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw makeErr('upstream_unauthorized', `chat confirm returned ${res.status}`);
    if (res.status === 503) throw makeErr('upstream_unavailable', 'chat ingress not configured');
    if (res.status >= 500) throw makeErr('upstream_unavailable', `chat confirm returned ${res.status}`);
    if (res.status >= 400) throw makeErr('upstream_bad_request', `chat confirm returned ${res.status}`);
    return (await res.json()) as LabChatResponse;
  }
```

- [ ] **Step 5: Run the test — expect PASS, then typecheck**

Run: `pnpm --filter @trading-office/server test TradingLabChatConnector.test.ts`; expect PASS. Run the repo typecheck; expect clean.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/connector/tradinglab/labDtos.ts apps/server/src/operator/TradingLabChatConnector.ts apps/server/src/operator/TradingLabChatConnector.test.ts
git commit -m "feat(office): labDtos assistant_message variant + TradingLabChatConnector.confirm()"
```

---

### Task 3: responder — `assistant_message` case + shared mapper + confirm responder

**Files:**
- Modify: `apps/server/src/operator/TradingLabOperatorResponder.ts`
- Test: `apps/server/src/operator/TradingLabOperatorResponder.test.ts` (extend)

**Interfaces:**
- Consumes: `TradingLabChatConnector.confirm` (Task 2), the extended `OperatorReply` (Task 1), `LabChatResponse.assistant_message` (Task 2).
- Produces: `runTurn` handles `assistant_message`; a shared `emitFromLabResponse(resp, ids, emit, deps, now, startFollow)` used by both turn + confirm; `makeTradingLabOperatorResponder` (or a sibling) also returns an `OperatorConfirmResponder = (confirm: OperatorConfirm, bus: OfficeEventBus) => OperatorMessageAccepted`.

- [ ] **Step 1: Extend `completed` + add the evidence/action projection helper**

In `runTurn`, replace the `completed` closure so it can carry the proposal payload, and add a lab→office badge mapper at module scope:

```ts
// module scope:
function toBadges(cards: LabEvidenceCard[]): OperatorEvidenceBadge[] {
  return cards.map((c) => ({ kind: c.kind, label: c.kind === 'interpretation' ? c.text : badgeLabel(c), sourceId: c.sourceId }));
}
function badgeLabel(c: LabEvidenceCard): string {
  if (c.kind === 'exact_duplicate') return '⚠ точный дубликат';
  if (c.kind === 'similar') return 'похожая стратегия';
  if (c.kind === 'warning') return c.text; // a stable code
  return c.text;
}

// inside runTurn, the completed closure (extended signature):
const completed = (text: string, extra?: { evidence?: OperatorEvidenceBadge[]; actions?: OperatorAction[]; pendingInteractionId?: string; sessionId?: string }): void => {
  const reply: OperatorReply = {
    replyMessageId: ids.replyMessageId, operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId,
    text, ts: now(), ...extra,
  };
  emit({ type: 'operator_message_completed', ts: now(), operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId, replyMessageId: ids.replyMessageId, reply });
};
```

(Import `OperatorEvidenceBadge`, `OperatorAction`, `OperatorReply` from `@trading-office/office-gateway`; `LabEvidenceCard` from the labDtos module.)

- [ ] **Step 2: Extract the response→events mapper and add the `assistant_message` case**

Replace the body of `runTurn`'s `switch (resp.kind)` so the mapping lives in a shared function both turn + confirm call. Add at module scope:

```ts
function emitFromLabResponse(
  resp: LabChatResponse,
  ids: FollowerIds,
  emit: (e: OfficeEvent) => void,
  completed: (text: string, extra?: { evidence?: OperatorEvidenceBadge[]; actions?: OperatorAction[]; pendingInteractionId?: string; sessionId?: string }) => void,
  failed: (code: string, message: string) => void,
  progress: (stage: string, note: string) => void,
  startFollow: (args: StartFollowArgs) => void,
): void {
  switch (resp.kind) {
    case 'assistant_message':
      // turn-1 proposal carries actions; the lab's not_found/expired/cancel terminal carries none — both are terminal completes.
      completed(resp.message, { evidence: toBadges(resp.evidence), actions: resp.actions, pendingInteractionId: resp.pendingInteractionId, sessionId: resp.sessionId });
      return;
    case 'needs_clarification': completed(resp.question); return;
    case 'out_of_scope': completed(resp.message); return;
    case 'help': completed(resp.supportedIntents.length ? `${resp.message} (${resp.supportedIntents.join(', ')})` : resp.message); return;
    case 'capability_not_available': completed(resp.message); return;
    case 'rejected': failed('rejected', resp.reason); return;
    case 'error': failed('error', resp.message); return;
    case 'task_created':
      progress('task_created', `${resp.taskType} · ${resp.taskId}`);
      startFollow({ ids, taskId: resp.taskId, taskType: resp.taskType, nextTaskType: resp.plannedNextStep?.taskType, emit });
      return;
    case 'task_status':
      if (resp.status === 'completed') { completed(`Task ${resp.taskId} completed`); return; }
      if (resp.status === 'failed' || resp.status === 'rejected') { failed('task_failed', `Task ${resp.taskId} ${resp.status}`); return; }
      completed(`Task ${resp.taskId} is ${resp.status}`); return;
  }
}
```

Then in `runTurn`, after `resp = await deps.chat.send(...)`, replace the inline switch with:

```ts
  emitFromLabResponse(resp, ids, emit, completed, failed, progress, startFollow);
```

(Argument order matches the `emitFromLabResponse` definition exactly: `resp, ids, emit, completed, failed, progress, startFollow`. Use the existing `progress`/`failed`/`completed` closures + the `startFollow` arg already threaded into `runTurn`. Keep the existing `assertNoExecutionAuthority`, accepted-event emission, and `chat.send` try/catch unchanged.)

- [ ] **Step 3: Add the confirm responder from the factory**

In `makeTradingLabOperatorResponder`, after building `startFollow`, also expose a confirm responder. Add a second returned function (change the factory to return `{ respond, respondConfirm }`, OR add a sibling factory `makeTradingLabOperatorConfirmResponder(deps)`; pick whichever the wiring in Task 4 consumes — this plan uses a sibling factory to avoid changing the existing `OperatorResponder` return contract):

```ts
export type OperatorConfirmResponder = (confirm: OperatorConfirm, bus: OfficeEventBus) => OperatorMessageAccepted;

export function makeTradingLabOperatorConfirmResponder(deps: TradingLabOperatorResponderDeps): OperatorConfirmResponder {
  const now = deps.now ?? (() => new Date().toISOString());
  const newIds = deps.newIds ?? defaultNewIds();
  const startFollow = deps.startFollow ?? ((args: StartFollowArgs) => {
    void new ConversationFollower({
      ids: args.ids, taskId: args.taskId, taskType: args.taskType, nextTaskType: args.nextTaskType, emit: args.emit,
      client: deps.client, bridge: deps.bridge, guards: deps.guards, completionSummaryEnabled: deps.completionSummaryEnabled,
    }).run();
  });

  return (confirm, bus) => {
    const ids = newIds();
    const emit = (e: OfficeEvent): void => bus.publish(e);
    emit({ type: 'operator_message_accepted', ts: now(), operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId });
    void runConfirmTurn(confirm, ids, emit, deps, now, startFollow);
    return { operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId, status: 'accepted' };
  };
}

async function runConfirmTurn(
  confirm: OperatorConfirm,
  ids: FollowerIds,
  emit: (e: OfficeEvent) => void,
  deps: TradingLabOperatorResponderDeps,
  now: () => string,
  startFollow: (args: StartFollowArgs) => void,
): Promise<void> {
  const progress = (stage: string, note: string): void =>
    emit({ type: 'operator_message_progress', ts: now(), operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId, replyMessageId: ids.replyMessageId, stage, note });
  const completed = (text: string, extra?: { evidence?: OperatorEvidenceBadge[]; actions?: OperatorAction[]; pendingInteractionId?: string; sessionId?: string }): void => {
    const reply: OperatorReply = { replyMessageId: ids.replyMessageId, operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId, text, ts: now(), ...extra };
    emit({ type: 'operator_message_completed', ts: now(), operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId, replyMessageId: ids.replyMessageId, reply });
  };
  const failed = (code: string, message: string): void =>
    emit({ type: 'operator_message_failed', ts: now(), operatorMessageId: ids.operatorMessageId, conversationId: ids.conversationId, replyMessageId: ids.replyMessageId, error: { code, message } });

  let resp: LabChatResponse;
  try {
    resp = await deps.chat.confirm({ pendingInteractionId: confirm.pendingInteractionId, sessionId: confirm.sessionId, decision: confirm.decision });
  } catch (e) {
    const err = e as { office?: { code: string }; message?: string };
    failed(err.office?.code ?? 'chat_error', err.message ?? 'chat confirm error');
    return;
  }
  emitFromLabResponse(resp, ids, emit, completed, failed, progress, startFollow);
}
```

(Add `confirm` to the `chat` Pick in `TradingLabOperatorResponderDeps`: `chat: Pick<TradingLabChatConnector, 'send' | 'confirm'>`. Import `OperatorConfirm`.)

- [ ] **Step 4: Write the failing responder tests**

In `TradingLabOperatorResponder.test.ts`, add (use the existing fake-bus + fake-chat harness in that file; assert on the published events):

```ts
it('runTurn assistant_message proposal -> completed carrying actions + evidence + ids', async () => {
  const events = collectBusEvents(); // existing helper pattern in the file
  const chat = { send: async () => ({ kind: 'assistant_message', sessionId: 's1', message: 'Подтвердите запуск анализа.', evidence: [{ kind: 'exact_duplicate', text: 'dup', sourceId: 'pf1' }], actions: [{ id: 'confirm', label: 'Подтвердить', style: 'primary' }], pendingInteractionId: 'p1' }), confirm: async () => { throw new Error('unused'); } };
  const respond = makeTradingLabOperatorResponder(depsWith(chat));
  respond({ text: 'analyse X', source: 'web', target: 'orchestrator', floorId: 'trading-lab' }, bus);
  await flush();
  const done = events.find((e) => e.type === 'operator_message_completed');
  expect(done.reply.actions[0].id).toBe('confirm');
  expect(done.reply.pendingInteractionId).toBe('p1');
  expect(done.reply.evidence[0].sourceId).toBe('pf1');
});

it('confirm responder: assistant_message terminal (not_found) -> completed with NO actions', async () => {
  const chat = { send: async () => { throw new Error('unused'); }, confirm: async () => ({ kind: 'assistant_message', sessionId: 's1', message: 'Не нашёл активного подтверждения. Пришлите запрос заново.', evidence: [], actions: [] }) };
  const respondConfirm = makeTradingLabOperatorConfirmResponder(depsWith(chat));
  respondConfirm({ pendingInteractionId: 'gone', sessionId: 's1', decision: 'confirm' }, bus);
  await flush();
  const done = events.find((e) => e.type === 'operator_message_completed');
  expect(done.reply.text).toContain('Не нашёл');
  expect(done.reply.actions ?? []).toHaveLength(0);
});

it('confirm responder: task_created -> progress + startFollow', async () => {
  const startFollow = vi.fn();
  const chat = { send: async () => { throw new Error('unused'); }, confirm: async () => ({ kind: 'task_created', sessionId: 's1', taskId: 't9', taskType: 'strategy.onboard', status: 'queued' }) };
  const respondConfirm = makeTradingLabOperatorConfirmResponder({ ...depsWith(chat), startFollow });
  respondConfirm({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' }, bus);
  await flush();
  expect(startFollow).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't9' }));
});
```

(Adapt `collectBusEvents`/`flush`/`depsWith` to the test file's existing helpers.)

- [ ] **Step 5: Run — expect FAIL then implement → PASS**

Run: `pnpm --filter @trading-office/server test TradingLabOperatorResponder.test.ts`
Expected: FAIL first (no `assistant_message` case / no confirm responder), PASS after Steps 1-3. Then run the repo typecheck; expect clean.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/operator/TradingLabOperatorResponder.ts apps/server/src/operator/TradingLabOperatorResponder.test.ts
git commit -m "feat(office): runTurn assistant_message case + shared lab-response mapper + confirm responder"
```

---

### Task 4: confirm route + index wiring

**Files:**
- Modify: `apps/server/src/app.ts` (add the `operatorConfirm` route + `operatorConfirmResponder` to `OfficeAppDeps`)
- Modify: `apps/server/src/index.ts` (build + pass the confirm responder)
- Test: `apps/server/src/app.test.ts` (add a confirm-route case)

**Interfaces:**
- Consumes: `makeTradingLabOperatorConfirmResponder` (Task 3), `OFFICE_API.operatorConfirm` + `operatorConfirmSchema` (Task 1).
- Produces: `POST /api/office/operator/confirm` → `operatorConfirmResponder(parsed, bus)` → 200 `OperatorMessageAccepted`; bad body → 400.

- [ ] **Step 1: Write the failing route test**

In `apps/server/src/app.test.ts` (mirror the existing `operatorMessages` route test):

```ts
it('POST /api/office/operator/confirm invokes the confirm responder and returns accepted', async () => {
  const calls: unknown[] = [];
  const operatorConfirmResponder = (c: unknown) => { calls.push(c); return { operatorMessageId: 'm1', conversationId: 'c1', status: 'accepted' as const }; };
  const { app } = createOfficeApp({ ...fixtureDeps(), operatorConfirmResponder });
  const res = await app.request(OFFICE_API.operatorConfirm, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' }),
  });
  expect(res.status).toBe(200);
  expect(calls).toHaveLength(1);
});

it('POST /api/office/operator/confirm with a bad body -> 400', async () => {
  const { app } = createOfficeApp(fixtureDeps());
  const res = await app.request(OFFICE_API.operatorConfirm, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'maybe' }) });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run — expect FAIL** (route 404 / responder unused)

Run: `pnpm --filter @trading-office/server test app.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the route + dep**

In `apps/server/src/app.ts`: import `operatorConfirmSchema` (and the existing `OFFICE_API`); add to `OfficeAppDeps`:

```ts
  operatorConfirmResponder?: OperatorConfirmResponder;
```

(import the type from `./operator/TradingLabOperatorResponder`). After the `operatorMessages` route:

```ts
  app.post(OFFICE_API.operatorConfirm, async (c) => {
    const parsed = operatorConfirmSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: 'bad_request', message: 'invalid operator confirm' } }, 400);
    }
    if (!deps.operatorConfirmResponder) {
      return c.json({ error: { code: 'not_configured', message: 'operator confirm not configured' } }, 503);
    }
    return c.json(deps.operatorConfirmResponder(parsed.data, deps.bus));
  });
```

- [ ] **Step 4: Wire it in `index.ts`**

Where `operatorResponder = makeTradingLabOperatorResponder({...})` is built, build the sibling and pass it into `createOfficeApp`:

```ts
    const operatorConfirmResponder = makeTradingLabOperatorConfirmResponder({ chat, client: wiring.client, bridge: wiring.bridge, guards: config.chatFollow, completionSummaryEnabled: config.chatFollow.completionSummaryEnabled });
```

and add `operatorConfirmResponder` to the `createOfficeApp({ ... })` deps. (Use the same `chat`/`wiring`/`config` values already in scope for `operatorResponder`.)

- [ ] **Step 5: Run — expect PASS, then full server suite + typecheck**

Run: `pnpm --filter @trading-office/server test app.test.ts`; expect PASS.
Run the full server test suite + repo typecheck; expect green (the new route is additive; existing routes untouched).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/app.ts apps/server/src/index.ts apps/server/src/app.test.ts
git commit -m "feat(office): POST /api/office/operator/confirm route + index wiring"
```

---

## Self-Review

- **Spec coverage (§4 Part B):** `labDtos.assistant_message` + `LabEvidenceCard`/`LabAction` (Task 2) ✓; `connector.confirm` (Task 2) ✓; `OperatorReply`/`operator_message_completed` extension (Task 1) ✓; `runTurn` `assistant_message` case (Task 3) ✓; `operatorConfirm` route + bus method → `connector.confirm` → `task_created` mapped like the existing arm (startFollow → Slice-3 follower) (Tasks 3-4) ✓; `assertNoExecutionAuthority` unchanged on the message path, and confirm reaches only the lab enqueue ✓.
- **Carry-forward constraint:** `not_found`/`expired`/`cancel` → `assistant_message` with no actions → terminal `completed` (Task 3 `emitFromLabResponse` `assistant_message` arm + the explicit confirm-responder test) ✓ — never awaits `rejected`.
- **Placeholder scan:** none — every step carries real code. The only "adapt to existing helpers" notes are for test-harness fixtures that already exist in the named test files (the asserted behaviour is fully specified).
- **Type consistency:** `OperatorEvidenceBadge`/`OperatorAction`/`OperatorConfirm` (Task 1) are the names imported in Tasks 3-4; `LabEvidenceCard`/`LabAction` (Task 2) are the lab-side names mapped via `toBadges`; `emitFromLabResponse` signature is identical at its definition (Task 3 Step 2) and both call sites (turn + confirm); `makeTradingLabOperatorConfirmResponder` name matches across Tasks 3-4.
- **Constraint check:** office is transpiled → parameter properties allowed (no strip-types guard here); hand-mirrored DTO (no trading-lab import); audit-safe badges (kind/label/sourceId only); WS event reused (extended `reply`, no new event type).
- **assertNoExecutionAuthority on confirm:** the confirm path carries no `OperatorMessage` (it's an `OperatorConfirm`), so the guard isn't applicable to it; the guard remains on the message path. Confirm reaching only the lab enqueue is the safety property, preserved because the office never executes — it calls the lab confirm endpoint. (Noted for the reviewer; if the reviewer wants a guard on confirm too, that's a one-line add.)

## Execution Handoff

PR-O1 follows PR-L (shipped). PR-O2 (web) is planned after PR-O1 ships, binding to the real extended `OperatorReply` + `operatorConfirm` route. Use subagent-driven TDD: fresh implementer per task + spec & code-quality review, then a final whole-PR review. Do not push/PR without the user's go-ahead.
