# 05 — Trading Lab Research Floor Brief

This is the first example floor to build with the Office Visual Builder Kit.

## Floor name

```text
Trading Lab Research Floor
```

## Floor purpose

Visualize the current `trading-lab` agent system as a living AI research office.

The floor should make the multi-agent workflow understandable at a glance.

## Required agents

### 1. Boss / Orchestrator

Role:

- coordinates workflow;
- owns side effects in `trading-lab`;
- routes commands;
- main entry point for user commands later.

Visual:

- bottom-center or central command console;
- visually distinct;
- violet/gold accent;
- larger console/desk.

### 2. Strategy Analyst

Role:

- analyzes strategy profiles;
- studies bot behavior;
- identifies patterns and weak spots.

Visual:

- analytics terminal;
- charts;
- notes.

### 3. Researcher

Role:

- generates hypotheses;
- explores explanations;
- proposes experiments.

Visual:

- research desk;
- documents/cards;
- idea board nearby.

### 4. Critic / Risk Reviewer

Role:

- attacks hypotheses;
- reviews overfit risk;
- rejects weak ideas.

Visual:

- review board;
- warning markers;
- amber/red accents.

### 5. Builder

Role:

- turns approved hypotheses into artifacts/modules;
- prepares implementation candidates.

Visual:

- dev terminal;
- code monitors;
- near server rack.

### 6. Evaluator

Role:

- runs/reads backtests;
- compares baseline/variant;
- decides pass/fail/paper candidate.

Visual:

- dashboard desk;
- metrics monitors;
- equity/backtest wall monitor nearby.

### 7. Performance Monitor

Role:

- watches bot results;
- detects degradation;
- triggers investigation.

Visual:

- bot status monitor;
- green/yellow/red heartbeat indicators.

## Required interactive objects

### Wall Monitor

Purpose:

- backtest summary;
- equity curve;
- variant comparison;
- paper candidate decision.

Placement:

- top-right wall or central wall.

### Hypothesis Board

Purpose:

- hypotheses pipeline;
- draft/validated/built/backtested/paper/failed.

Placement:

- top-left wall or near Researcher/Critic.

### Bot Status Monitor

Purpose:

- bot health/status;
- long_oi / short_oi monitoring;
- warnings.

Placement:

- near Performance Monitor.

### Archive Shelf

Purpose:

- knowledge base;
- archived hypotheses;
- previous runs.

Placement:

- lower-right or side wall.

### Server Rack / Data Node

Purpose:

- technical visual anchor;
- linked to Builder/Evaluator.

Placement:

- near Builder or back wall.

## Suggested composition

```text
┌──────────────────────────────────────────────────────────┐
│ Hypothesis Board        Wall Monitor / Backtests          │
│                                                          │
│ Analyst Desk      Researcher Desk       Evaluator Desk    │
│                                                          │
│ Critic Desk       Central Data Table     Performance Mon. │
│                                                          │
│ Builder Desk      Server Rack            Archive Shelf    │
│                                                          │
│                Boss / Orchestrator Console                │
└──────────────────────────────────────────────────────────┘
```

This is only a guide. Do not make it too rigid if a better visual composition emerges.

## Default labels

Labels should be readable:

```text
Boss
Analyst
Researcher
Critic
Builder
Evaluator
Monitor
```

Object labels:

```text
Hypothesis Board
Backtests
Bot Status
Archive
```

## Status badges

Use small role/status badges, not long text.

Example:

```text
thinking
running
reviewing
backtesting
idle
```

## Visual priority

The first preview must make clear:

1. this is a research/trading lab;
2. there are multiple specialized agents;
3. Boss/Orchestrator coordinates them;
4. monitors/boards represent real system data later;
5. the floor is original, not copied from a reference.
