# PR-O2: trading-office web — operator confirmation UI (badges + confirm buttons + left-dock evidence panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the conversational-operator proposal in the trading-office web chat — compact clickable evidence badges + Подтвердить/Отмена buttons — and wire the structured confirm round-trip (`gateway.confirmAction` → `POST /api/office/operator/confirm`), with badge-click opening an evidence-detail panel in the existing **left dock**.

**Architecture:** The office server (PR-O1, shipped `da1ceb1`) now returns the lab's proposal as an `operator_message_completed` event whose `reply` carries optional `evidence`/`actions`/`pendingInteractionId`/`sessionId`, and exposes `POST /api/office/operator/confirm` returning `OperatorMessageAccepted`. PR-O2 surfaces this in the browser: (1) the `transcriptReducer` carries the proposal fields onto the `OperatorTurn` and gains a `resolve` action; (2) `OperatorChatPanel`/`ChatTurn` render the proposal and run the confirm flow by **reusing the existing submit→accepted→events wire model** (a confirm is just another accepted interaction whose events stream back); (3) the office gateway gains `confirmAction`; (4) badge-click opens a new `operator-evidence` panel in the **left dock**, driven by **local FloorScreen UI state** (no router — dock state here is already local, per `FloorScreen.tsx:48`).

**Tech Stack:** TypeScript, React, Vite, Vitest, Zod (via the shared `@trading-office/office-gateway` package).

## Global Constraints

- **No component-test harness — by design.** `apps/web` runs `vitest run` with **no jsdom / happy-dom / @testing-library** and **zero `.test.tsx`**. Existing tests are pure-logic (`operatorTranscript.test.ts`, `panelRegistry.test.ts`, `HttpOfficeGateway.test.ts`, `MockOfficeGateway.test.ts`). **Do NOT add jsdom/RTL.** Push behavior into pure, tested functions (reducer, predicates, mappers, gateway, registry); verify `.tsx` wiring with **typecheck only** (`npm run typecheck -w @trading-office/web` → `tsc --noEmit`).
- **npm workspaces, NOT pnpm.** Tests: `npm run test -w @trading-office/web -- <file>` (web) / `npm run test -w @trading-office/office-gateway -- <file>` (gateway). Typecheck: `npm run typecheck -w @trading-office/web` / `-w @trading-office/office-gateway`.
- **Inert / no execution authority.** `confirmAction` is a research enqueue request to the office; the browser never executes. Keep the gateway doc-comment's "INERT" framing.
- **Audit-safe rendering.** Evidence badges/detail show only `kind` + `label` + optional `sourceId` — never strategy text or embeddings. (The office already projects audit-safe; the web must not invent richer fields.)
- **Reuse the wire model.** A confirm is NOT a new transport: dispatch the existing `submit` + `accepted`/`submit_failed` actions for the new interaction so its `accepted → completed/failed` events render exactly like a typed message. Only **new** reducer surface is the `resolve` action + carrying the proposal fields on `completed`.
- **No routing for the evidence panel.** Dock state in `FloorScreen.tsx` is already local UI state (`leftSel`, `chatOpen`). The evidence panel is driven by a new local `evidenceView` state, threaded chat→FloorScreen via an `onShowEvidence` callback prop. `resolvePanel` (route resolution) is **untouched** — `operator-evidence` is set directly, never resolved from a `RouteSelection`.
- **Types come from the package.** `OperatorEvidenceBadge`, `OperatorAction`, `OperatorConfirm`, `OperatorMessageAccepted` are exported from `@trading-office/office-gateway` (`export type * from './dto'`). Import from there; never hand-redeclare.

---

### Task 1: gateway `confirmAction` — interface + HTTP + Mock

**Files:**
- Modify: `packages/office-gateway/src/gateway.ts` (add `confirmAction` to the `OfficeGateway` interface)
- Modify: `apps/web/src/runtime/HttpOfficeGateway.ts` (implement `confirmAction`)
- Modify: `apps/web/src/runtime/MockOfficeGateway.ts` (implement `confirmAction`)
- Test: `apps/web/src/runtime/HttpOfficeGateway.test.ts` (add a confirm case)
- Test: `apps/web/src/runtime/MockOfficeGateway.test.ts` (add a confirm case)

**Interfaces:**
- Consumes: `OperatorConfirm`, `OperatorMessageAccepted`, `OFFICE_API.operatorConfirm` (all from `@trading-office/office-gateway`, shipped in PR-O1).
- Produces: `OfficeGateway.confirmAction(input: OperatorConfirm): Promise<OperatorMessageAccepted>`; both web implementations satisfy it.

- [ ] **Step 1: Add `confirmAction` to the interface**

In `packages/office-gateway/src/gateway.ts`: add `OperatorConfirm` to the type import from `./dto`, and add the method to the interface after `sendOperatorMessage`:

```ts
  sendOperatorMessage(msg: OperatorMessage): Promise<OperatorMessageAccepted>;
  /** Structured confirm/cancel of a pending proposal — INERT: a research enqueue request, never an execution action. */
  confirmAction(input: OperatorConfirm): Promise<OperatorMessageAccepted>;
  subscribeOfficeEvents?(cb: (e: OfficeEvent) => void): () => void;
```

(Required, not optional — like `sendOperatorMessage`. This forces every implementer to provide it; typecheck will surface any stub that doesn't.)

- [ ] **Step 2: Run the gateway typecheck — expect FAIL**

Run: `npm run typecheck -w @trading-office/office-gateway`
Expected: clean for the package itself (no implementers live here). Then `npm run typecheck -w @trading-office/web` → FAIL: `HttpOfficeGateway`/`MockOfficeGateway` no longer satisfy `OfficeGateway` (`confirmAction` missing). This is the RED signal for Steps 3-4.

- [ ] **Step 3: Write the failing HTTP gateway test**

In `apps/web/src/runtime/HttpOfficeGateway.test.ts`, add (mirror the existing `sendOperatorMessage` test's `fetchImpl` stub + `OFFICE_API` import):

```ts
it('confirmAction POSTs to operatorConfirm and returns accepted', async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    captured = { url, init };
    return new Response(JSON.stringify({ operatorMessageId: 'm9', conversationId: 'c9', status: 'accepted' }), { status: 200 });
  };
  const gw = new HttpOfficeGateway({ baseUrl: 'http://office', fetchImpl });
  const accepted = await gw.confirmAction({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' });
  expect(captured!.url).toBe('http://office' + OFFICE_API.operatorConfirm);
  expect(captured!.init!.method).toBe('POST');
  expect(JSON.parse(captured!.init!.body as string)).toEqual({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' });
  expect(accepted.operatorMessageId).toBe('m9');
});

it('confirmAction throws on a non-ok response', async () => {
  const fetchImpl = async () => new Response('', { status: 503 });
  const gw = new HttpOfficeGateway({ baseUrl: 'http://office', fetchImpl });
  await expect(gw.confirmAction({ pendingInteractionId: 'p', sessionId: 's', decision: 'cancel' })).rejects.toThrow();
});
```

(If `OFFICE_API` is not already imported in this test file, add it to the existing `@trading-office/office-gateway` import.)

- [ ] **Step 4: Implement `HttpOfficeGateway.confirmAction`**

In `HttpOfficeGateway.ts`, add `OperatorConfirm` to the type import, then add the method right after `sendOperatorMessage` (mirror it exactly — only path + body type differ):

```ts
  async confirmAction(input: OperatorConfirm): Promise<OperatorMessageAccepted> {
    const res = await this.fetchImpl(this.baseUrl + OFFICE_API.operatorConfirm, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`operator confirm rejected: ${res.status}`);
    return (await res.json()) as OperatorMessageAccepted;
  }
```

- [ ] **Step 5: Write the failing Mock gateway test**

In `apps/web/src/runtime/MockOfficeGateway.test.ts`, add (mirror how the file captures emitted events from `subscribeOfficeEvents`):

```ts
it('confirmAction emits accepted + completed and returns accepted', async () => {
  const gw = new MockOfficeGateway({ latencyMs: 0 });
  const events: OfficeEvent[] = [];
  gw.subscribeOfficeEvents((e) => events.push(e));
  const accepted = await gw.confirmAction({ pendingInteractionId: 'p1', sessionId: 's1', decision: 'confirm' });
  await new Promise((r) => setTimeout(r, 10));
  const completed = events.find((e) => e.type === 'operator_message_completed');
  expect(accepted.status).toBe('accepted');
  expect(completed && completed.type === 'operator_message_completed' && completed.operatorMessageId).toBe(accepted.operatorMessageId);
});
```

(Use the file's existing `OfficeEvent` import; if absent, add it to the `@trading-office/office-gateway` type import.)

- [ ] **Step 6: Implement `MockOfficeGateway.confirmAction`**

In `MockOfficeGateway.ts`, add `OperatorConfirm` to the `./types` type import, then add after `sendOperatorMessage`:

```ts
  confirmAction(input: OperatorConfirm): Promise<OperatorMessageAccepted> {
    const k = ++this.counter;
    const operatorMessageId = `m${k}`;
    const conversationId = `c${k}`;
    const replyMessageId = `r${k}`;
    const text = input.decision === 'confirm' ? 'Запрос отправлен в исследование.' : 'Отменено.';
    this.emit({ type: 'operator_message_accepted', ts: nowIso(), operatorMessageId, conversationId });
    setTimeout(() => {
      this.emit({ type: 'operator_message_completed', ts: nowIso(), operatorMessageId, conversationId, replyMessageId, reply: { replyMessageId, operatorMessageId, conversationId, text, ts: nowIso() } });
    }, 60);
    return this.delay({ operatorMessageId, conversationId, status: 'accepted' });
  }
```

(`OperatorConfirm` is exported by `@trading-office/office-gateway`; the file's `./types` re-exports the package types — if `OperatorConfirm` is not in `./types`, import it directly from `@trading-office/office-gateway` instead.)

- [ ] **Step 7: Run both gateway tests + typecheck — expect PASS / clean**

Run: `npm run test -w @trading-office/web -- HttpOfficeGateway.test.ts MockOfficeGateway.test.ts` → PASS.
Run: `npm run typecheck -w @trading-office/web` and `npm run typecheck -w @trading-office/office-gateway` → clean (both implementers now satisfy the interface).

- [ ] **Step 8: Commit**

```bash
git add packages/office-gateway/src/gateway.ts apps/web/src/runtime/HttpOfficeGateway.ts apps/web/src/runtime/MockOfficeGateway.ts apps/web/src/runtime/HttpOfficeGateway.test.ts apps/web/src/runtime/MockOfficeGateway.test.ts
git commit -m "feat(office-web): OfficeGateway.confirmAction (HTTP POST /operator/confirm + mock)"
```

---

### Task 2: transcript reducer — carry proposal fields, `resolve` action, pure proposal helpers

**Files:**
- Modify: `apps/web/src/floor/panels/operatorTranscript.ts`
- Test: `apps/web/src/floor/panels/operatorTranscript.test.ts`

**Interfaces:**
- Consumes: `OperatorEvidenceBadge`, `OperatorAction` from `@trading-office/office-gateway`; the extended `operator_message_completed` event (`e.reply.{evidence,actions,pendingInteractionId,sessionId}`).
- Produces: `OperatorTurn` gains optional `evidence?: OperatorEvidenceBadge[]`, `actions?: OperatorAction[]`, `pendingInteractionId?: string`, `sessionId?: string`, `resolved?: boolean`; a new `{ kind: 'resolve'; operatorMessageId: string }` action; `OperatorEvidenceView` interface; pure `isProposalTurn(turn): boolean` and `turnEvidenceView(turn): OperatorEvidenceView`.

- [ ] **Step 1: Write the failing reducer/helper tests**

In `operatorTranscript.test.ts`, add:

```ts
import { transcriptReducer, emptyTranscript, isProposalTurn, turnEvidenceView, type OperatorTurn } from './operatorTranscript';

function withProposal(): ReturnType<typeof transcriptReducer> {
  let s = transcriptReducer(emptyTranscript, { kind: 'submit', localId: 'L1', text: 'analyse X' });
  s = transcriptReducer(s, { kind: 'accepted', localId: 'L1', operatorMessageId: 'm1', conversationId: 'c1' });
  return transcriptReducer(s, {
    kind: 'event',
    event: { type: 'operator_message_completed', ts: 't', operatorMessageId: 'm1', conversationId: 'c1', replyMessageId: 'r1',
      reply: { replyMessageId: 'r1', operatorMessageId: 'm1', conversationId: 'c1', text: 'Подтвердите запуск анализа.', ts: 't',
        evidence: [{ kind: 'exact_duplicate', label: '⚠ точный дубликат', sourceId: 'pf1' }],
        actions: [{ id: 'confirm', label: 'Подтвердить', style: 'primary' }, { id: 'cancel', label: 'Отмена', style: 'secondary' }],
        pendingInteractionId: 'p1', sessionId: 's1' } },
  });
}

it('completed event carries the proposal fields onto the turn', () => {
  const turn = withProposal().turns[0]!;
  expect(turn.status).toBe('completed');
  expect(turn.replyText).toBe('Подтвердите запуск анализа.');
  expect(turn.actions?.[0]?.id).toBe('confirm');
  expect(turn.evidence?.[0]?.sourceId).toBe('pf1');
  expect(turn.pendingInteractionId).toBe('p1');
  expect(turn.sessionId).toBe('s1');
  expect(turn.resolved).toBeFalsy();
});

it('isProposalTurn is true for an unresolved completed turn with actions', () => {
  const turn = withProposal().turns[0]!;
  expect(isProposalTurn(turn)).toBe(true);
});

it('resolve marks the proposal turn resolved (false-y → true) so buttons hide', () => {
  const s = transcriptReducer(withProposal(), { kind: 'resolve', operatorMessageId: 'm1' });
  const turn = s.turns[0]!;
  expect(turn.resolved).toBe(true);
  expect(isProposalTurn(turn)).toBe(false);
});

it('a completed terminal with empty actions is NOT a proposal (lab not_found/expired/cancel)', () => {
  const turn: OperatorTurn = { localId: 'L', operatorMessageId: 'm', conversationId: 'c', userText: 'u', replyText: 'Не нашёл активного подтверждения.', status: 'completed', actions: [] };
  expect(isProposalTurn(turn)).toBe(false);
});

it('turnEvidenceView projects the reply text + badges (audit-safe)', () => {
  const turn = withProposal().turns[0]!;
  const view = turnEvidenceView(turn);
  expect(view.text).toBe('Подтвердите запуск анализа.');
  expect(view.badges).toHaveLength(1);
  expect(view.badges[0]?.kind).toBe('exact_duplicate');
});
```

- [ ] **Step 2: Run — expect FAIL** (`isProposalTurn`/`turnEvidenceView` undefined; `resolve` not handled; fields not carried)

Run: `npm run test -w @trading-office/web -- operatorTranscript.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend the types + reducer**

In `operatorTranscript.ts`:

Add to the imports:

```ts
import type { OfficeEvent, OperatorEvidenceBadge, OperatorAction } from '@trading-office/office-gateway';
```

Extend `OperatorTurn` (append the optional fields):

```ts
export interface OperatorTurn {
  localId: string;
  operatorMessageId: string | null;
  conversationId: string | null;
  userText: string;
  replyText: string;
  status: 'pending' | 'streaming' | 'completed' | 'failed';
  error?: string;
  evidence?: OperatorEvidenceBadge[];
  actions?: OperatorAction[];
  pendingInteractionId?: string;
  sessionId?: string;
  resolved?: boolean;
}
```

Add the `resolve` action to the `TranscriptAction` union:

```ts
  | { kind: 'resolve'; operatorMessageId: string }
```

In the `completed` event branch, carry the proposal fields (replace the existing line):

```ts
      if (e.type === 'operator_message_completed')
        return mapById(state, e.operatorMessageId, (t) => ({
          ...t,
          replyText: e.reply.text,
          status: 'completed',
          evidence: e.reply.evidence,
          actions: e.reply.actions,
          pendingInteractionId: e.reply.pendingInteractionId,
          sessionId: e.reply.sessionId,
        }));
```

Add the `resolve` case (alongside the other top-level cases in `transcriptReducer`'s switch):

```ts
    case 'resolve':
      return mapById(state, action.operatorMessageId, (t) => ({ ...t, resolved: true }));
```

Add the pure helpers + view type at module scope (after the reducer):

```ts
export interface OperatorEvidenceView {
  text: string;
  badges: OperatorEvidenceBadge[];
}

/** A completed turn that still offers actions and hasn't been acted on — render confirm/cancel + badges. */
export function isProposalTurn(turn: OperatorTurn): boolean {
  return turn.status === 'completed' && !!turn.actions && turn.actions.length > 0 && !turn.resolved;
}

/** Audit-safe projection for the left-dock evidence panel — reply text + the turn's badges, no network. */
export function turnEvidenceView(turn: OperatorTurn): OperatorEvidenceView {
  return { text: turn.replyText, badges: turn.evidence ?? [] };
}
```

- [ ] **Step 4: Run — expect PASS, then typecheck**

Run: `npm run test -w @trading-office/web -- operatorTranscript.test.ts` → PASS.
Run: `npm run typecheck -w @trading-office/web` → clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/floor/panels/operatorTranscript.ts apps/web/src/floor/panels/operatorTranscript.test.ts
git commit -m "feat(office-web): transcript carries proposal fields + resolve action + proposal helpers"
```

---

### Task 3: `OperatorChatPanel` / `ChatTurn` — render proposal, confirm flow, `onShowEvidence`

**Files:**
- Modify: `apps/web/src/floor/panels/OperatorChatPanel.tsx`
- (Styles) Modify: the chat stylesheet that defines `chat__*` classes (locate via the existing `chat__bubble` class — likely `apps/web/src/**/*.css`); add minimal classes for badges/buttons. CSS is not type-checked; keep it small and follow the existing BEM-ish `chat__*` naming.

**Interfaces:**
- Consumes: `isProposalTurn`, `turnEvidenceView`, `OperatorEvidenceView`, `OperatorTurn` (Task 2); `gateway.confirmAction` (Task 1); `OperatorAction`, `OperatorEvidenceBadge` from the package.
- Produces: `OperatorChatPanel` accepts a new optional prop `onShowEvidence?: (view: OperatorEvidenceView) => void`; `ChatTurn` renders the proposal block (clickable badges + Подтвердить/Отмена) and calls confirm via the reused wire model. No new reducer surface.

> **Testing note (Global Constraint):** there is no component-test harness. The behavioral logic for this task already lives in the Task 2 pure functions (`isProposalTurn`, `turnEvidenceView`) which ARE unit-tested. This task is `.tsx` glue — verify with **typecheck** (`npm run typecheck -w @trading-office/web`) and do NOT add jsdom/RTL. There is no RED/GREEN test step here by design.

- [ ] **Step 1: Add the confirm handler + `onShowEvidence` prop**

In `OperatorChatPanel.tsx`:

Update the import from `./operatorTranscript`:

```ts
import { emptyTranscript, transcriptReducer, isProposalTurn, turnEvidenceView, type OperatorTurn, type OperatorEvidenceView } from './operatorTranscript';
```

Change the component signature to accept `onShowEvidence`:

```ts
export function OperatorChatPanel({ onClose, onShowEvidence }: { onClose: () => void; onShowEvidence?: (view: OperatorEvidenceView) => void }) {
```

Add a `confirm` handler next to `send()` (reuses the existing wire model — `resolve` the proposal, then run the confirm as a fresh submit→accepted interaction):

```ts
  async function confirm(turn: OperatorTurn, decision: 'confirm' | 'cancel') {
    if (!turn.operatorMessageId || !turn.pendingInteractionId || !turn.sessionId) return;
    dispatch({ kind: 'resolve', operatorMessageId: turn.operatorMessageId });
    const localId = `L${(localSeq.current += 1)}`;
    dispatch({ kind: 'submit', localId, text: decision === 'confirm' ? 'Подтвердить' : 'Отмена' });
    try {
      const accepted = await gateway.confirmAction({
        pendingInteractionId: turn.pendingInteractionId,
        sessionId: turn.sessionId,
        decision,
      });
      dispatch({ kind: 'accepted', localId, operatorMessageId: accepted.operatorMessageId, conversationId: accepted.conversationId });
    } catch (err) {
      dispatch({ kind: 'submit_failed', localId, error: err instanceof Error ? err.message : 'confirm failed' });
    }
  }
```

- [ ] **Step 2: Thread the callbacks into `ChatTurn`**

Change the list render to pass the handlers:

```tsx
              {state.turns.map((turn) => (
                <ChatTurn key={turn.localId} turn={turn} onConfirm={confirm} onShowEvidence={onShowEvidence} />
              ))}
```

- [ ] **Step 3: Render the proposal block in `ChatTurn`**

Update `ChatTurn`'s signature and its non-typing/non-failed assistant branch. Replace the function with:

```tsx
function ChatTurn({
  turn,
  onConfirm,
  onShowEvidence,
}: {
  turn: OperatorTurn;
  onConfirm: (turn: OperatorTurn, decision: 'confirm' | 'cancel') => void;
  onShowEvidence?: (view: OperatorEvidenceView) => void;
}) {
  const typing = (turn.status === 'pending' || turn.status === 'streaming') && !turn.replyText;
  const proposal = isProposalTurn(turn);
  return (
    <li className="chat__turn">
      <div className="chat__msg chat__msg--user">
        <div className="chat__bubble">{turn.userText}</div>
      </div>

      {turn.status === 'failed' ? (
        <div className="chat__msg chat__msg--assistant">
          <span className="chat__avatar" aria-hidden="true">◆</span>
          <div className="chat__bubble chat__bubble--error">⚠ {turn.error ?? 'failed'}</div>
        </div>
      ) : typing ? (
        <div className="chat__msg chat__msg--assistant">
          <span className="chat__avatar" aria-hidden="true">◆</span>
          <div className="chat__bubble chat__bubble--typing">
            <span className="chat__status">{turn.status === 'pending' ? 'connecting' : 'thinking'}</span>
            <span className="chat__dots" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
      ) : (
        <div className="chat__msg chat__msg--assistant">
          <span className="chat__avatar" aria-hidden="true">◆</span>
          <div className="chat__bubble">
            {turn.replyText}
            {turn.status === 'streaming' && <span className="chat__caret" aria-hidden="true" />}
            {turn.evidence && turn.evidence.length > 0 && (
              <div className="chat__badges">
                {turn.evidence.map((b, i) => (
                  <button
                    key={`${b.kind}:${b.sourceId ?? i}`}
                    type="button"
                    className="chat__badge"
                    data-kind={b.kind}
                    onClick={() => onShowEvidence?.(turnEvidenceView(turn))}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
            {proposal && (
              <div className="chat__actions">
                {turn.actions!.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="chat__action"
                    data-style={a.style}
                    onClick={() => onConfirm(turn, a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
```

(Badges render whenever evidence is present — even after the turn is resolved, so the user can still inspect — but the action **buttons** render only while `isProposalTurn` is true, i.e. they disappear once `resolve` fires.)

- [ ] **Step 4: Add minimal styles**

Locate the stylesheet defining `chat__bubble` (search the web `src` for `chat__bubble`). Add compact rules near the other `chat__*` selectors — small, following existing conventions:

```css
.chat__badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chat__badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid currentColor; background: transparent; cursor: pointer; opacity: 0.85; }
.chat__badge:hover { opacity: 1; }
.chat__actions { display: flex; gap: 8px; margin-top: 10px; }
.chat__action { font-size: 13px; padding: 4px 12px; border-radius: 8px; cursor: pointer; }
.chat__action[data-style="primary"] { font-weight: 600; }
```

(Exact palette/spacing should match the surrounding chat styles — adapt values to the file's existing scale rather than copying these verbatim if the file uses CSS variables.)

- [ ] **Step 5: Typecheck — expect clean**

Run: `npm run typecheck -w @trading-office/web`
Expected: clean. (No unit test — see the Testing note. The reused reducer path is already covered by Task 2.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/floor/panels/OperatorChatPanel.tsx
git add -A apps/web/src   # include the touched stylesheet
git commit -m "feat(office-web): render proposal badges + confirm/cancel buttons + confirm flow"
```

---

### Task 4: left-dock evidence panel — `OperatorEvidencePanel` + registry + `PanelDock` + `FloorScreen`

**Files:**
- Create: `apps/web/src/floor/panels/OperatorEvidencePanel.tsx`
- Modify: `apps/web/src/floor/panelRegistry.ts` (add the `operator-evidence` `PanelKind`)
- Modify: `apps/web/src/floor/PanelDock.tsx` (render `operator-evidence`; thread `onShowEvidence` to operator-chat)
- Modify: `apps/web/src/floor/FloorScreen.tsx` (local `evidenceView` state + dock wiring)
- Test: `apps/web/src/floor/panelRegistry.test.ts` (cover the new kind)

**Interfaces:**
- Consumes: `OperatorEvidenceView` (Task 2); `OperatorEvidenceBadge` from the package; the existing `PanelChrome`.
- Produces: `PanelKind` gains `| { kind: 'operator-evidence' }`; `opensDock` returns `true` for it; `panelContentKey` returns `'operator-evidence'`; `PanelDock` accepts optional `evidenceView?: OperatorEvidenceView | null` and `onShowEvidence?: (view: OperatorEvidenceView) => void`; `FloorScreen` owns `evidenceView` local state.

- [ ] **Step 1: Write the failing registry test**

In `panelRegistry.test.ts`, add (mirror existing `opensDock`/`resolvePanel` test style):

```ts
it('opensDock is true for operator-evidence', () => {
  expect(opensDock({ kind: 'operator-evidence' })).toBe(true);
});

it('resolvePanel never produces operator-evidence (it is set directly, not route-resolved)', () => {
  // operator-evidence is local UI state in FloorScreen, never derived from a RouteSelection.
  expect(resolvePanel({ operator: true }, []).kind).toBe('operator-chat');
  expect(resolvePanel({}, []).kind).toBe('none');
});
```

(Ensure `opensDock` is imported in the test file; add it to the existing `./panelRegistry` import if needed.)

- [ ] **Step 2: Run — expect FAIL** (`operator-evidence` not assignable to `PanelKind`)

Run: `npm run test -w @trading-office/web -- panelRegistry.test.ts`
Expected: FAIL (type error / `opensDock` returns false).

- [ ] **Step 3: Extend the registry**

In `panelRegistry.ts`:

Add the variant to `PanelKind`:

```ts
export type PanelKind =
  | { kind: 'operator-chat' }
  | { kind: 'operator-evidence' }
  | { kind: 'agent-activity'; agentId: string }
  | { kind: 'object'; panelTarget: ObjectPanelTarget }
  | { kind: 'exit' }
  | { kind: 'none' }
  | { kind: 'unknown'; key: string };
```

Add it to `opensDock`:

```ts
export function opensDock(kind: PanelKind): boolean {
  return (
    kind.kind === 'operator-chat' ||
    kind.kind === 'operator-evidence' ||
    kind.kind === 'agent-activity' ||
    kind.kind === 'object' ||
    kind.kind === 'unknown'
  );
}
```

(`resolvePanel` and `selectedEntityId` are unchanged — `operator-evidence` is never route-resolved and selects no scene entity, so it correctly falls through `selectedEntityId`'s `default → null`.)

- [ ] **Step 4: Run the registry test — expect PASS**

Run: `npm run test -w @trading-office/web -- panelRegistry.test.ts` → PASS.

- [ ] **Step 5: Create `OperatorEvidencePanel.tsx`**

`apps/web/src/floor/panels/OperatorEvidencePanel.tsx`:

```tsx
import { PanelChrome } from './PanelChrome';
import type { OperatorEvidenceView } from './operatorTranscript';

const KIND_LABEL: Record<string, string> = {
  interpretation: 'Интерпретация',
  exact_duplicate: 'Точный дубликат',
  similar: 'Похожая стратегия',
  warning: 'Предупреждение',
};

/**
 * Left-dock detail for a proposal's evidence. Audit-safe: shows only the
 * reply text + each badge's kind/label/sourceId. No network call.
 */
export function OperatorEvidencePanel({ view, onClose }: { view: OperatorEvidenceView; onClose: () => void }) {
  return (
    <PanelChrome title="Доказательства" onClose={onClose}>
      <div className="evidence">
        <p className="evidence__summary">{view.text}</p>
        {view.badges.length === 0 ? (
          <p className="evidence__empty">Нет деталей.</p>
        ) : (
          <ul className="evidence__list">
            {view.badges.map((b, i) => (
              <li key={`${b.kind}:${b.sourceId ?? i}`} className="evidence__item" data-kind={b.kind}>
                <span className="evidence__kind">{KIND_LABEL[b.kind] ?? b.kind}</span>
                <span className="evidence__label">{b.label}</span>
                {b.sourceId && <code className="evidence__src">{b.sourceId}</code>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelChrome>
  );
}
```

(Confirm `PanelChrome`'s prop shape against a sibling panel, e.g. `HypothesisPanel.tsx`, and match it — `title` + `onClose` are used by `OperatorChatPanel`, but verify whether `flush` or other props are expected.)

- [ ] **Step 6: Render it from `PanelDock`**

In `PanelDock.tsx`:

Add imports:

```ts
import { OperatorEvidencePanel } from './panels/OperatorEvidencePanel';
import type { OperatorEvidenceView } from './panels/operatorTranscript';
```

Extend `renderPanel` to take the new data + callback, and handle both operator kinds:

```tsx
function renderPanel(
  panelKind: PanelKind,
  onClose: () => void,
  evidenceView: OperatorEvidenceView | null | undefined,
  onShowEvidence: ((view: OperatorEvidenceView) => void) | undefined,
) {
  switch (panelKind.kind) {
    case 'operator-chat':
      return <OperatorChatPanel onClose={onClose} onShowEvidence={onShowEvidence} />;
    case 'operator-evidence':
      return evidenceView ? <OperatorEvidencePanel view={evidenceView} onClose={onClose} /> : null;
    case 'agent-activity':
      return <AgentActivityPanel agentId={panelKind.agentId} onClose={onClose} />;
    case 'object':
      return OBJECT_PANELS[panelKind.panelTarget](onClose);
    case 'unknown':
      return <UnknownPanel panelKey={panelKind.key} onClose={onClose} />;
    default:
      return null;
  }
}
```

Add `operator-evidence` to `panelContentKey`:

```ts
    case 'operator-evidence': return 'operator-evidence';
```

Extend the `PanelDock` props + pass-through:

```tsx
export function PanelDock({
  open,
  side,
  panelKind,
  onClose,
  evidenceView,
  onShowEvidence,
}: {
  open: boolean;
  side: 'left' | 'right';
  panelKind: PanelKind;
  onClose: () => void;
  evidenceView?: OperatorEvidenceView | null;
  onShowEvidence?: (view: OperatorEvidenceView) => void;
}) {
  return (
    <aside className="dock" data-side={side} data-open={open} aria-hidden={!open}>
      {open && (
        <div key={panelContentKey(panelKind)} className="dock__content">
          {renderPanel(panelKind, onClose, evidenceView, onShowEvidence)}
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 7: Wire `FloorScreen`**

In `FloorScreen.tsx`:

Add to the imports from `./panels/operatorTranscript`:

```ts
import type { OperatorEvidenceView } from './panels/operatorTranscript';
```

Add the constant near `OPERATOR_CHAT`:

```ts
const OPERATOR_EVIDENCE = { kind: 'operator-evidence' } as const;
```

Add local state next to the other dock state (after `const [chatOpen, setChatOpen] = useState(false);`):

```ts
  const [evidenceView, setEvidenceView] = useState<OperatorEvidenceView | null>(null);
```

Make the evidence panel take over the left dock when set (replace the `leftKind` memo):

```ts
  const leftKind = useMemo(
    () => (evidenceView ? OPERATOR_EVIDENCE : leftSel ? resolvePanel(leftSel, agentInfos) : NONE),
    [evidenceView, leftSel, agentInfos],
  );
```

Update the left-dock close handler to clear evidence first (so closing the evidence panel reveals any underlying agent/object selection):

```ts
  const closeLeft = useCallback(() => {
    if (evidenceView) { setEvidenceView(null); return; }
    setLeftSel(null);
  }, [evidenceView]);
```

Update the two `PanelDock` renders:

```tsx
      <PanelDock side="left" open={leftOpen} panelKind={leftKind} evidenceView={evidenceView} onClose={closeLeft} />
      <PanelDock side="right" open={chatOpen} panelKind={OPERATOR_CHAT} onClose={() => setChatOpen(false)} onShowEvidence={setEvidenceView} />
```

(`leftOpen = opensDock(leftKind)` already returns `true` when `leftKind` is `operator-evidence` after Step 3 — no change to the `leftOpen` line. Keep the existing `selectedEntityId` effect; it returns `null` for `operator-evidence`, so the scene de-selects, which is correct.)

- [ ] **Step 8: Typecheck + full web suite — expect clean / green**

Run: `npm run typecheck -w @trading-office/web` → clean.
Run: `npm run test -w @trading-office/web` → all green (the new logic is covered by Tasks 1, 2, and the registry test; `.tsx` is glue).
Run: `npm run build -w @trading-office/web` → succeeds (vite build catches any JSX/import error the bare typecheck might miss).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/floor/panels/OperatorEvidencePanel.tsx apps/web/src/floor/panelRegistry.ts apps/web/src/floor/panelRegistry.test.ts apps/web/src/floor/PanelDock.tsx apps/web/src/floor/FloorScreen.tsx
git add -A apps/web/src   # include any evidence__* styles added to the stylesheet
git commit -m "feat(office-web): left-dock evidence panel + badge-click wiring (no router)"
```

---

## Self-Review

- **Spec coverage (§4 Part C):** `operatorTranscript` carries `evidence`/`actions`/`pendingInteractionId`/`sessionId`/`resolved` (Task 2) ✓; `ChatTurn` renders proposal text + clickable badges + Подтвердить/Отмена when actions present and unresolved (Task 3) ✓; badge click → left-sidebar evidence panel, no network (Task 4) ✓; confirm/cancel → `gateway.confirmAction` + mark resolved + outcome renders as the next assistant line via the reused wire model (Tasks 1-3) ✓; gateway `confirmAction` HTTP + mock (Task 1) ✓.
- **Placeholder scan:** none — every code step is concrete. The only "adapt to existing" notes are (a) CSS values to match the existing scale, and (b) `PanelChrome` prop confirmation — both are verify-against-sibling instructions, not unwritten logic.
- **Type consistency:** `OperatorEvidenceView` defined once (Task 2), imported by `OperatorChatPanel` (Task 3), `PanelDock`, `OperatorEvidencePanel`, `FloorScreen` (Task 4). `isProposalTurn`/`turnEvidenceView` names match across Tasks 2-3. `confirmAction(input: OperatorConfirm): Promise<OperatorMessageAccepted>` identical at the interface (Task 1) and both call/impl sites. `PanelKind` `operator-evidence` added in Task 4 and consumed by `PanelDock`/`FloorScreen` in the same task.
- **Constraint check:** no jsdom/RTL added (component parts verified by typecheck/build); npm-workspace commands throughout; `confirmAction` kept INERT in the interface doc-comment; badges/detail are audit-safe (kind/label/sourceId only); no router touched (`resolvePanel` unchanged; `operator-evidence` is local state); types imported from `@trading-office/office-gateway`.
- **Wire-model reuse:** the confirm path dispatches `resolve` + the existing `submit`/`accepted`/`submit_failed` actions (Task 3) — the only new reducer surface is `resolve` and the extra fields on `completed` (Task 2), exactly as the Global Constraints require.
- **Interface-addition risk:** making `confirmAction` required (not optional) forces both `HttpOfficeGateway` and `MockOfficeGateway` to implement it; Task 1 Step 2 deliberately runs the web typecheck to surface this as the RED signal. No other `OfficeGateway` implementers exist (`grep "implements OfficeGateway"` → only those two).

## Execution Handoff

PR-O2 follows PR-O1 (shipped, office `da1ceb1`). After this ships, the conversational operator's two-turn proposal/confirm flow is fully usable in the browser. Fast-follow (out of scope, needs a new lab read endpoint): rich profile-by-id detail in the evidence panel. Use subagent-driven TDD: fresh implementer per task + spec & code-quality review, then a final whole-PR review. Do not push/PR without the user's go-ahead.
