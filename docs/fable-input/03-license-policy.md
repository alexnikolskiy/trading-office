# 03 — License Policy

This project may become public. Therefore the first visual kit must be license-clean.

## Core rules

1. Every third-party asset must have a source URL.
2. Every third-party asset must have a license file or clear license note.
3. Prefer CC0 assets for the core visual kit.
4. Do not copy copyrighted screenshots, layouts, characters, or props.
5. Do not embed the YouTube reference screenshot in public repo unless rights are clear.
6. Keep optional attribution-heavy assets separate from core assets.
7. If attribution is required, create `ATTRIBUTIONS.md`.

## Recommended folder structure

```text
assets/
  generated/
    tiles/
    furniture/
    agents/
    ui/

  third-party/
    kenney/
      SOURCE.md
      LICENSE.txt
      ...

  optional/
    lpc/
      SOURCE.md
      ATTRIBUTIONS.md
      LICENSES.md

docs/
  design/
    asset-policy.md
```

## Git policy for references

Local reference screenshots can be kept in:

```text
docs/fable-input/references/
```

But public git should usually ignore raw screenshots:

```gitignore
docs/fable-input/references/*.png
docs/fable-input/references/*.jpg
docs/fable-input/references/*.jpeg
docs/fable-input/references/*.webp
```

Instead, commit textual mood notes.

## README wording

Recommended README wording for future:

```text
The visual style is original and uses legally allowed assets.
Prototype environment assets may include Kenney CC0 assets.
Reference screenshots were used only as private mood references and were not copied into the final layout, characters, or assets.
```

## Attribution files

If using Kenney:

```text
Attribution is not required for Kenney CC0 assets, but this project credits Kenney in SOURCE.md for transparency.
```

If using LPC later:

```text
LPC assets require attribution. Include all authors and licenses in ATTRIBUTIONS.md before committing generated sprites.
```
