# 00 — Goal

We are creating a new repository: `trading-office`.

`trading-office` is not just an admin panel for `trading-lab`.

It is a separate **AI Office Shell / Control Room** for multiple agent systems.

`trading-lab` will be the first connected agent system / first floor, but the architecture should later support additional systems such as:

- ML Research Lab;
- Strategy Discovery Lab;
- Backtest & Evaluation Floor;
- Bot Monitoring Floor;
- Archive / Knowledge Base Floor.

## Existing project boundaries

### trading-platform

`trading-platform` is the TypeScript/Node.js trading platform and source of truth for:

- market data;
- historical datasets;
- research/backtest runner;
- sandbox execution;
- paper/live runtime;
- simulated orders/fills/trades;
- decision logs;
- StrategyModule / HypothesisModule contracts;
- risk/execution authority.

### trading-lab

`trading-lab` is a TypeScript/Mastra multi-agent research system built on top of `trading-platform`.

Accepted architecture formula:

```text
trading-lab = research brain, hypothesis memory, multi-agent workflows
trading-platform = market data, runner, sandbox, paper/live runtime, execution authority
```

Core principle:

```text
Agents reason, workflows decide, Orchestrator owns side effects, platform executes.
```

### trading-office

`trading-office` is a visual frontend/control-room layer.

It must not have execution authority.

It must not directly access `trading-platform`.

It must not directly access internal Postgres databases from the browser.

Future production shape:

```text
Browser
  ↓
trading-office web
  ↓
trading-office server / office gateway
  ↓
connected agent systems
  ↓
trading-lab
  ↓
trading-platform
```

## Current Fable task

Do NOT build the whole product.

Build a strong, reusable **Office Visual Builder Kit** and one visually reviewable example floor.

The kit should answer:

- How do we author floors?
- How do we render pixel-art office scenes?
- How do we place agents?
- How do we place interactive objects?
- How do we use Tiled maps?
- How does React integrate with the renderer later?
- How can Superpowers continue from this foundation?

## Desired one-line outcome

```text
Fable creates how the office is built and rendered.
Superpowers later turns it into the full trading-office app.
```
