# Material Discovery Implementation Plan

**Goal:** Make assets discoverable and let authors preview, assign and use them without learning internal IDs or engine terminology.

**Architecture:** Shared catalog presentation and reusable voice cards/pickers; persistent existing binding APIs; scene presentation metadata with stable IDs; explicit editor handoff and undoable graph updates. Keep native audio previews and current generation pipeline.

**Tech Stack:** React, TypeScript, Tailwind, Vitest, existing Express/Prisma APIs, generated PNG/WebP illustrations.

- [x] Generate and inspect three coordinated illustrations; integrate larger art into a shared continuous section surface without separate backplates.
- [x] Add clear voice catalog names, traits, languages and role recommendations. Preserve custom names and edited descriptions.
- [x] Build reusable audition cards and selection dialog, direct voice-to-character assignment, and editor audition/change controls.
- [x] Simplify library layout, move advanced configuration behind explicit actions, preserve URL context and useful playback controls.
- [x] Add background search and place/time/mood taxonomy, preview and story handoff. Apply backgrounds to existing scene graphs without losing branches; support undo.
- [x] Align music and file labels, library navigation and empty states with the same hierarchy.
- [x] Extend the page audit to Home, Explore, Settings, auth, Agent, editor and player. Replace the auth image tile with a continuous illustrated background.
- [x] Verify meaningful tests, lint/build, real browser flows and narrow/desktop layouts. Document actual outcomes and commit locally.
