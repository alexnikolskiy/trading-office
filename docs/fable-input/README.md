# trading-office Fable Input Pack

This folder is an input package for the first Fable pass.

Goal: ask Fable to create a reusable **Office Visual Builder Kit** for `trading-office`, not the whole product.

Fable should focus on:

- Tiled-compatible office/floor authoring conventions;
- PixiJS-based pixel-art scene renderer;
- React preview/wrapper integration;
- asset registry and license policy;
- one visually reviewable `Trading Lab Research Floor` example.

Fable should NOT build:

- Hono server;
- Postgres;
- authentication;
- real `trading-lab` API integration;
- production dashboard panels;
- Docker Compose for the whole product.

Read these files in order:

1. `00-goal.md`
2. `01-visual-references.md`
3. `02-asset-sources.md`
4. `03-license-policy.md`
5. `04-office-builder-kit-scope.md`
6. `05-trading-lab-floor-brief.md`
7. `06-technical-stack.md`
8. `07-deliverables.md`
9. `08-acceptance-criteria.md`
10. `09-fable-master-prompt.md`

Local screenshot references may be placed under `references/`, but should not be committed to public git unless rights are clear.
