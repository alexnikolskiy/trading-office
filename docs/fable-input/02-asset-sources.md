# 02 — Asset Sources

The goal is to keep the first visual kit legally clean and easy to publish.

## Preferred core asset source: Kenney

Use Kenney assets as the preferred environment/furniture prototyping source.

Website:

```text
https://kenney.nl/assets
```

Why:

- strong prototyping asset library;
- many top-down packs;
- CC0/public-domain style licensing for game assets;
- attribution not required, but credit is appreciated.

Recommended categories/packs to inspect:

- top-down assets;
- office/interior-like objects;
- simple furniture;
- walls/floors;
- monitors/computers;
- urban/RPG indoor style packs.

If Kenney assets are used, include:

```text
assets/third-party/kenney/SOURCE.md
assets/third-party/kenney/LICENSE.txt
```

## Character source: custom placeholders first

For the first Fable pass, prefer original simple pixel agents created for this project.

Reason:

- avoids attribution complexity;
- keeps style consistent;
- enough for visual review;
- agents can be improved later.

Suggested first-pass agents:

- small pixel characters;
- role color accents;
- idle/typing/thinking frames may be simple;
- readable labels are more important than complex animation.

## Optional later: Universal LPC Spritesheet Generator

Website:

```text
https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/
```

Use LPC only as an optional future character pipeline.

Important:

- LPC assets require attribution;
- licenses can include CC-BY-SA / OGA-BY / GPL variants;
- do not make LPC mandatory for the core kit;
- if LPC is used, create attribution manifest.

Suggested future location:

```text
assets/optional/lpc/
  ATTRIBUTIONS.md
  LICENSES.md
  SOURCE.md
```

## Optional later: game-icons.net

Website:

```text
https://game-icons.net/
```

Use only if needed for UI icons.

Important:

- CC-BY license;
- requires attribution;
- not needed for the first visual kit if simple pixel glyphs are enough.

## Forbidden sources

Do not use:

- random images from Google/Pinterest;
- screenshots as assets;
- YouTube screenshot elements copied as sprites;
- AgentRoom assets/layout copied directly;
- Pixel Agents assets/layout copied directly;
- assets without clear license;
- assets without source URL/license metadata.

## Asset policy summary

Use this priority order:

```text
1. Original/generated placeholder pixel assets
2. Kenney CC0 environment/furniture assets
3. Optional LPC characters later with attribution
4. Optional game-icons later with attribution
```
