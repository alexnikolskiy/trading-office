# Design: Agent Phoenix traces in the office left panel

Date: 2026-06-27
Status: Approved (design); implementation pending
Branch: `feat/agent-phoenix-traces`
Repos touched: `trading-lab` (producer — new read endpoint), `trading-office` (consumer — connector + UI)

## Goal

trading-lab now exports LLM execution traces to a self-hosted Phoenix
(`arizephoenix/phoenix:17.11.0`, port 6006) via `@mastra/arize` over OTLP. When an
operator clicks an agent on the office floor, the left panel already opens
`AgentActivityPanel` showing simple log lines (`TraceLine[]`). We want to surface the
*rich* Phoenix traces for that agent — the span tree (agent run → LLM calls → tool
calls) with latency and token counts — in a new **Traces** tab of that same panel.

## Decisions (locked)

1. **Data path: through trading-lab.** Office stays a read-only consumer and talks only
   to trading-lab. trading-lab (the producer that owns Phoenix and its credentials) adds
   a read endpoint that proxies/normalises Phoenix. Office consumes it via the existing
   `TradingLabReadConnector`. This matches the established pattern (cf. Phase 4b, where
   read-API ownership lives with the producing repo). Office gains **no** new external
   dependency on Phoenix.
2. **Presentation: a new "Traces" tab** in `AgentActivityPanel`. The existing "Logs"
   view (`TraceLine[]` + live `agent_trace_appended` SSE) is unchanged and remains the
   default tab.
3. **Content: trace list + expandable span tree.** The tab shows a list of recent traces
   for the agent (start time, ok/error status, latency, token counts, cost if available);
   clicking a trace expands its span tree (indented, by `parent_id`), each span showing
   kind (AGENT/LLM/TOOL/CHAIN), name, latency, and status.
4. **On-demand, not streaming.** Traces are fetched on tab open via REST, with a Refresh
   button. Phoenix is not a push source; the live log stream stays on the Logs tab.
5. **Honest empty states (empty ≠ gap).** Reuse the typed `reasonCode` taxonomy
   established in the lab-degradation work: Phoenix disabled, lab unreachable / auth
   failure (no token leak), and "agent has no traces in window" are distinct, typed
   states — never a 500 for the normal cases.
6. **Gated.** The Traces tab/feature is available only in trading-lab mode and only when
   trading-lab reports Phoenix is enabled; otherwise the tab renders a typed "tracing
   disabled" message rather than erroring.

## Spike findings (2026-06-27)

Derived from the `@mastra/arize@1.3.1` source in trading-lab `node_modules` and the
Phoenix REST docs. These shape the reader and DTO.

### Phoenix read API (v17)
- `GET /v1/projects` → `{ data: [...], next_cursor }` (list projects, find identifier).
- `GET /v1/projects/{id}/spans?limit=&cursor=&attribute=key:value` → `{ spans: [...],
  next_cursor }`. Cursor pagination; `attribute=k:v` filters AND together.
- A span carries: `name`, span kind (`openinference.span.kind`), `start_time`/`end_time`,
  status, `attributes` (nested), `context.{trace_id, span_id}`, `parent_id`.
- Auth: optional `Authorization: Bearer <token>` (self-hosted default = no auth).

### How an agent is identified in spans
- `@mastra/arize` maps `mastra.span.type` → `openinference.span.kind`:
  `agent_run`→**AGENT**, `model_*`→LLM, `tool_call`/`mcp_tool_call`→TOOL, else CHAIN.
- The exporter writes **no dedicated "agent name" resource attribute.** A specific agent
  is identified by the **name of its AGENT-kind span** (and possibly `metadata.agentId`).
  `session_id` is the Mastra `threadId` (a conversation thread, not an agent type) — not
  a per-agent-type key.
- Token counts land as `LLM_TOKEN_COUNT_PROMPT/COMPLETION/TOTAL` on LLM spans.
- **Cost is not emitted** by the exporter; Phoenix derives it from tokens + model. The
  REST span may omit cost.

### Consequences
- Per-agent filtering is done **in trading-lab's reader code**, not by relying on the
  Phoenix filter DSL alone: fetch recent project spans, group by `trace_id`, find the
  root AGENT span, match its `name` **or** `metadata.agentId` against
  `mapOfficeAgentIdToLab(agentId)`.
- `costUsd` is **optional/nullable** in the DTO (best-effort; lab may later derive it from
  tokens × model price).
- **One residual to confirm cheaply during implementation:** the exact format of the
  `agent_run` span name (`<agentName>` vs `agent.<name>` vs `metadata.agentId`). A full
  live LLM run is expensive (needs the whole lab stack + API keys + an onboarding flow),
  so instead the first implementation step confirms the format with a single request to
  the running Phoenix, and the reader is built tolerant (match by name OR metadata.agentId).

## Architecture

```
[click agent]
  FloorScreen.onAgentClick → setLeftSel({ agentId })
  → AgentActivityPanel  [tabs: Logs | Traces]
       Logs   = existing TraceLine[] + agent_trace_appended SSE   (unchanged)
       Traces = gateway.getAgentTraces(agentId)                   (NEW, REST, on-demand)
                  │
  office web ─────┼─→ GET /api/office/agents/:agentId/traces
  office server   │     CompositeOfficeReadConnector
                  │       → TradingLabReadConnector.getAgentTraces(agentId)
                  │           │
  trading-lab ────┼─────────→ GET /agents/:labId/traces?limit=N    (NEW; lab owns)
                  │             PhoenixTraceReader → Phoenix REST :6006
                  │               project = PHOENIX_PROJECT_NAME ("trading-lab")
                  │               filter: root AGENT span name|metadata.agentId == labId
  Phoenix :6006 ──┘
```

## Components & data model

### trading-lab (producer — most new logic)
- **`PhoenixTraceReader`**: queries Phoenix REST, groups spans by trace, identifies the
  agent, normalises to the DTO. Gated by `PHOENIX_ENABLED`; when off, returns a typed
  empty result (`reasonCode: "tracing-disabled"`) with HTTP 200 — never a 500.
- **New route** `GET /agents/:agentId/traces?limit=N` → `AgentTracesDTO`.
- Phoenix failures (unreachable, auth) → typed `reasonCode` (e.g. `phoenix-unreachable`),
  no credential/token leakage in the response.

### Shared DTO (`AgentTracesDTO`)
```
AgentTraces {
  agentId: string;
  reasonCode?: "tracing-disabled" | "phoenix-unreachable" | "no-traces" | null;
  traces: Trace[];
}
Trace {
  traceId: string;
  startTime: string;          // ISO
  status: "ok" | "error";
  latencyMs: number;
  tokens?: { prompt?: number; completion?: number; total?: number };
  costUsd?: number | null;    // best-effort, may be null
  rootName: string;           // the agent_run span name
  spans: Span[];
}
Span {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: "AGENT" | "LLM" | "TOOL" | "CHAIN";
  startTime: string;
  latencyMs: number;
  status: "ok" | "error";
  llm?: { model?: string; tokensIn?: number; tokensOut?: number };
}
```

### trading-office (consumer)
- **`office-gateway` package**: add `agentTracesSchema` (Zod) for the DTO above incl. the
  `reasonCode` enum; add the new path to `OFFICE_API`.
- **`OfficeReadConnector`**: add `getAgentTraces(agentId): Promise<AgentTraces>`.
- **`TradingLabReadConnector.getAgentTraces`**: call the new lab endpoint via the lab
  client; map/validate response. **`CompositeOfficeReadConnector`** delegates traces to
  the lab connector. Platform/infra connectors are untouched.
- **server `app.ts`**: add route `GET /api/office/agents/:agentId/traces` → connector.
- **web `HttpOfficeGateway.getAgentTraces(agentId)`**.
- **`AgentActivityPanel`**: add a Logs | Traces tab switch. The Traces tab fetches
  `getAgentTraces` on open + Refresh; renders the trace list and expandable span tree;
  renders typed empty/disabled/error states from `reasonCode`.

## Error handling

| Situation | Behaviour |
|---|---|
| `PHOENIX_ENABLED=false` (lab) | 200 + `reasonCode: "tracing-disabled"`, empty traces; tab shows "tracing disabled" |
| Phoenix unreachable / auth fail (lab) | typed `reasonCode: "phoenix-unreachable"`, no token leak; tab shows error state |
| Agent exists, no traces in window | 200 + `reasonCode: "no-traces"`, empty list; tab shows "no traces yet" |
| lab unreachable from office | office connector returns typed error per existing lab-degradation taxonomy; tab shows error state |
| Not trading-lab mode | Traces tab hidden / disabled |

## Testing

- **trading-lab**: `PhoenixTraceReader` unit tests against a mocked Phoenix REST
  (span grouping, root-agent identification by name and by metadata.agentId, token
  mapping, cost-absent → null); endpoint test; `PHOENIX_ENABLED=false` → typed empty;
  Phoenix-unreachable → typed error with no leak.
- **trading-office**: connector test (mocked lab client incl. each `reasonCode`); schema
  validation round-trip; gateway test; `AgentActivityPanel` test (tab switch; renders
  list; expands span tree; renders disabled/no-traces/error states). Follow existing test
  conventions in both repos.

## Out of scope (YAGNI)

- Streaming/live trace updates (Logs tab already streams; Phoenix is pull-only here).
- Trace search/filter UI, evals, datasets, prompt-playground — Phoenix UI owns those.
- Deep-linking to the Phoenix UI (can be added later as a small enhancement).
- Computing cost when Phoenix omits it (left as best-effort/null for now).
- Cross-thread/session correlation beyond what a single agent's recent traces show.

## Implementation order (for the plan)

1. **Confirm span-name format** with one request to the running Phoenix; lock the reader's
   agent-match rule (name and/or metadata.agentId).
2. trading-lab: `PhoenixTraceReader` + endpoint + gating + tests.
3. office: shared DTO/schema + connector method + composite wiring + server route + tests.
4. office: gateway method + `AgentActivityPanel` tabs + rendering + tests.
5. End-to-end smoke (lab + Phoenix up) per the established operator-smoke style.
