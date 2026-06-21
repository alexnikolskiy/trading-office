# Operator confirmation UI — follow-up fixes — Design

**Status:** Approved (brainstorm 2026-06-21)
**Repo:** trading-office (single PR; office-server + office-web)
**Source:** follow-ups surfaced by the 2026-06-21 live end-to-end browser verification of the operator confirmation UI slice (PR-L `2ee5aa4` + PR-O1 `da1ceb1` + PR-O2 `b30ff51`). Recorded in trading-lab roadmap PR #62 (`004ae88`).

## Goal

Fix three defects/hardenings in the just-shipped two-turn proposal/confirm UI. The headline is a real correctness bug (Q1): the confirm outcome overwrites the original proposal turn in the chat. Q3 removes a visible redundancy; Q4 hardens the reducer against an event-ordering contract violation. **Q2 (`strategy.onboard` confirm fell back to "Done." instead of a domain `CompletionSummary`) is OUT OF SCOPE** — its root cause is ambiguous without a live event/HTTP trace and may be lab-side; it gets its own investigation.

## Background (root causes, from code investigation)

- **Q1 — operatorMessageId collision.** `defaultNewIds()` (`apps/server/src/operator/TradingLabOperatorResponder.ts:14-17`) returns a closure with a counter starting at `m1`. The message responder and the confirm responder are each built resolving `deps.newIds ?? defaultNewIds()`, and the production wiring `apps/server/src/index.ts` passes a `responderDeps` with **no `newIds`** — so each responder gets its **own** counter, both restarting at `m1`. The first proposal turn gets `operatorMessageId = "m1"` and the first confirm turn also gets `"m1"`. The web reducer keys turns by `operatorMessageId` (the `mapById` helper in `apps/web/src/floor/panels/operatorTranscript.ts`), so the confirm-path completion lands on the proposal turn and overwrites its `replyText`/`evidence`/`actions`. Unit tests pass a shared deterministic `newIds`, which makes counters monotonic and hides the collision — only the real wiring triggers it.
- **Q3 — interpretation rendered twice.** The lab returns the interpretation both as `assistant_message.message` AND as an evidence card `kind:'interpretation'` whose text equals the message. `toBadges` (`TradingLabOperatorResponder.ts:39-41`) maps that card with `label: c.text`, so the chat shows the interpretation as a sentence and again as a wide clickable pill (and the evidence panel shows it a third time under its own message-text header).
- **Q4 — reducer ordering contract.** `mapById` (in `operatorTranscript.ts`) is a no-op when no turn matches the event's `operatorMessageId`, so a `operator_message_completed` arriving before the `accepted` action has set the turn's id is silently dropped. The real office flow (sync HTTP `accepted` resolves before the async WS `completed`) honors the ordering, so with Q1 fixed there is no live failure today — this is defense-in-depth against any gateway/fake that emits `completed` first.

## Changes

### Q1 — globally-unique IDs in `defaultNewIds` (office-server)

Replace the per-instance counter with `crypto.randomUUID()` so two independently-built responders cannot collide, with no wiring change required.

`apps/server/src/operator/TradingLabOperatorResponder.ts:14-17`:

```ts
import { randomUUID } from 'node:crypto';

export function defaultNewIds(): () => FollowerIds {
  return () => ({ operatorMessageId: randomUUID(), conversationId: randomUUID(), replyMessageId: randomUUID() });
}
```

- `FollowerIds` shape is unchanged (three string fields); only the values change from `m1/c1/r1` to UUIDs.
- No `index.ts` change needed: the two responders each call `defaultNewIds()`, but UUIDs never collide.
- Tests that need deterministic ids continue to pass their own `deps.newIds` — unaffected. `defaultNewIds()` itself is not used by existing unit tests.

**Acceptance:** two separate `defaultNewIds()` instances each produce a first id whose `operatorMessageId` values differ (regression guard for the collision). Existing responder/route/app suites stay green.

### Q3 — drop the interpretation evidence card in `toBadges` (office-server)

The interpretation is already the proposal `message`; as an evidence "badge" it is pure redundancy. Filter it out so it appears neither in the chat badge row nor in the left-dock evidence panel. Real evidence (`exact_duplicate` / `similar` / `warning`) is unaffected.

`apps/server/src/operator/TradingLabOperatorResponder.ts:39-41`:

```ts
function toBadges(cards: LabEvidenceCard[]): OperatorEvidenceBadge[] {
  return cards
    .filter((c) => c.kind !== 'interpretation')
    .map((c) => ({ kind: c.kind, label: badgeLabel(c), sourceId: c.sourceId }));
}
```

- `badgeLabel` no longer needs the `interpretation` branch path at the call site (the `interpretation` cards are filtered before `.map`); `badgeLabel`'s own `interpretation` fallthrough can stay as-is (dead for this path, harmless) — do not expand scope to refactor it.
- A proposal whose only evidence was the interpretation card now yields an **empty** `evidence` array → the web renders no badge row and the evidence panel has no cards (its header still shows the proposal text). `isProposalTurn` is unaffected (it gates on `actions`, not `evidence`), so the confirm/cancel buttons still render.

**Acceptance:** `toBadges` given `[{kind:'interpretation',text:'…'}, {kind:'exact_duplicate',…}, {kind:'similar',…}]` returns only the non-interpretation badges, in order, with their labels from `badgeLabel`.

### Q4 — buffer `completed`-without-turn in the transcript reducer (office-web)

Make the reducer order-independent: a `operator_message_completed` whose `operatorMessageId` has no turn yet is held, and applied when the matching `accepted` action later creates/binds the turn.

`apps/web/src/floor/panels/operatorTranscript.ts`:

- Extend `OperatorTranscriptState` with `pendingCompleted: Record<string, Extract<OfficeEvent, { type: 'operator_message_completed' }>>` (keyed by `operatorMessageId`). `emptyTranscript` initializes it to `{}`.
- In the `event` branch, for `operator_message_completed`: if `mapById` would not match any turn (no turn has that `operatorMessageId`), store the event in `pendingCompleted[operatorMessageId]` instead of dropping it; otherwise apply as today (carry `replyText`/`status:'completed'`/`evidence`/`actions`/`pendingInteractionId`/`sessionId`).
- In the `accepted` action: after setting the matched turn's `operatorMessageId`, if `pendingCompleted[operatorMessageId]` exists, apply its `reply` to that turn (same field-carry as the completed branch) and delete the entry from `pendingCompleted`.
- Scope to `operator_message_completed` only (the outcome-bearing event). Early `operator_message_delta`s before `accepted` remain best-effort (the final `completed` carries the full text) — do not buffer deltas.

**Acceptance:** dispatching `submit` → `event(operator_message_completed for mX)` → `accepted(localId→mX)` yields a turn whose `status === 'completed'` and `replyText` equals the completed event's text (the out-of-order completed is not lost). The in-order path (submit → accepted → completed) is unchanged. `pendingCompleted` does not leak (entry removed on apply).

## Testing

- **Q1, Q3:** office-server vitest (`npm run test -w @trading-office/server`) — a `defaultNewIds` collision-guard test and a `toBadges` filter test; both assert real return values. Run the full server suite + typecheck.
- **Q4:** office-web vitest (`npm run test -w @trading-office/web -- operatorTranscript.test.ts`) — pure reducer tests for the out-of-order and in-order paths. The web package has **no component-test harness by convention** (no jsdom/RTL) — keep all assertions at the reducer level; no `.tsx` test. Run the full web suite + typecheck.
- No new test infrastructure. npm workspaces (not pnpm).

## Invariants preserved

- Hand-mirrored DTOs (no trading-lab import); audit-safe projection (badges carry kind/label/sourceId only); `assertNoExecutionAuthority` unchanged; confirm reaches only the lab enqueue. Additive: Q1/Q3 change values/filtering, not the event contract; Q4 only adds reducer state. The WS event shape is unchanged.

## Out of scope

- **Q2** — `strategy.onboard` confirm completion fell back to "Done.". Needs a live event/HTTP trace (success-terminal type match + `getCompletionSummary` 404/null path in `ConversationFollower.ts:147-153`); may require a lab-side fix. Tracked separately in the roadmap.
- No refactor of `badgeLabel`, the responder factories, `index.ts` wiring, or the completion/follower flow beyond the three changes above.
