# @trading-office/server

Read-only office gateway (Hono). Serves the floor's HTTP/WS API by composing a
`TradingLabReadConnector` (trading-lab read API) and a read-only
`PlatformMonitoringConnector` (trading-platform ops read API). **No execution
authority** — there is no write/command path.

## Reliability: upstream failures degrade, they don't crash

Both upstream connectors follow the same posture: an upstream failure becomes a
**typed, visible source state**, never a generic HTTP 500 on the dashboard.

### trading-lab — auth-aware health vs. data reads (two distinct signals)

- **`trading-lab-read-api`** (infra source) — the auth-aware *health* probe:
  open `/readyz` (process/DB) **plus** the credentialed `/v1/authz` probe sent
  with the same read token used for real reads. So a wrong read token surfaces
  as `degraded` / `auth_failed` instead of a false `live`.
- **`trading-lab-read`** (infra source) — the outcome of the last *data* read
  (`/v1/agents`, `/v1/hypotheses`, `/v1/backtests`). A data read can be degraded
  (timeout, 5xx, malformed) while `/readyz` + `/v1/authz` still pass, so it is
  tracked separately. `detail` carries a stable, token-free reason code.

Aggregate/dashboard endpoints (`agent-statuses`, `hypotheses`, `backtests`)
**never** 500 on an upstream lab failure: they return an empty/default
projection (200) and the failure is recorded as the `trading-lab-read` source
state above. The strict per-agent detail endpoint (`agent activity`) instead
returns a **typed** status (`401` for auth failures, `502` otherwise) — never a
generic 500. No response, source state, or log ever contains the read token.

### Upstream reason-code taxonomy (`trading-lab-read` detail)

| reasonCode             | state    | cause                                   |
| ---------------------- | -------- | --------------------------------------- |
| `auth_failed`          | degraded | lab read returned 401/403               |
| `upstream_unreachable` | error    | network error / ECONNREFUSED / ENOTFOUND|
| `upstream_timeout`     | error    | client timeout (request aborted)        |
| `upstream_5xx`         | error    | lab read returned a 5xx                 |
| `upstream_bad_response`| error    | non-JSON / unexpected response shape    |
| `upstream_error`       | error    | unclassified failure                    |

The operator sees these in the **Data node / Infra** panel (`GET
/api/office/infra` → `sources[]`), each rendered as `state (detail)`. A degraded
lab data source therefore does not take down the rest of the dashboard — bot
health, platform infra, and the floor keep rendering from their own sources.

The platform connector behaves the same way (per-aspect best-effort; `bot-health`
and the `platform-*` sources convey why) — it is the template this mirrors.
