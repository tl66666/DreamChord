# World, Preview and Story Details Plan

> Use subagent-driven-development with bounded file ownership; user authorized autonomous improvement.

**Goal:** Fix skipped preview openings, make supporting people and town life readable in-game, and group story presentations into detail pages.

**Architecture:** Preserve canonical chapters and existing save/voice workflow. Distinguish full versus selected-card playback at the editor entry. Add a static world/cast reading panel to the official player without mutating project data. Move story-specific media to static detail pages.

- [x] Reproduce selected-card `from` leaking into both full-preview buttons; targeted tests red then green, retain save/conflict guard.
- [x] Group each story into one homepage cover with detail links; preserve all original detail media and Hero.
- [x] Author supporting cast, town routes and two complete supplementary life scenes; distinguish future characters from existing mentions.
- [x] Generate two original mature NPC archive portraits, preserve native files/prompts/SHA; never use opaque archive portraits as stage sprites.
- [x] Connect player panel with pause/keyboard/close behavior, test navigation without advancing the story.
- [x] Extend presentation-resource checks to story detail pages; run full tests/lint/build/media and desktop/mobile QA.
- [x] Independent review and docs. Publication is verified against the pushed commit's CI and Pages runs.

Ownership: preview worker owns FlowEditor and preview tests; showcase worker owns showcase/story-detail HTML/CSS; world worker owns PaintWorldPanel/data/tests and WORLD_AND_CAST.md; root owns player integration, image assets, verification scripts, QA, README and release. Do not modify docs/CURRENT_HANDOFF.md or rewrite prior chapters/voice bindings/database.
