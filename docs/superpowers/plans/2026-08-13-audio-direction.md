# Audio Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable BGM, SFX, and voice-over direction to DreamChord stories without creating a demo-only audio path.

**Architecture:** Audio configuration is stored on playable graph nodes, converted into shared runtime scenes, and played through separate BGM, SFX, and voice channels. The asset library remains the single source of audio files, while the Agent only reads and reports audio needs.

**Tech Stack:** TypeScript, React, Vitest, HTMLAudioElement, React Flow, Express asset API, Prisma-backed project graph.

---

### Task 1: Define runtime audio contracts

**Files:**
- Modify: `apps/web/src/engine/types.ts`
- Modify: `apps/web/src/engine/converter.ts`
- Test: `apps/web/src/engine/converter.test.ts`

- [ ] Add a failing converter test for a dialogue node containing BGM, SFX, and voice metadata.
- [ ] Run `pnpm --filter dreamchord-web test -- converter.test.ts` and confirm the new assertion fails.
- [ ] Add typed `RuntimeAudioDirection` contracts and map node metadata into `RuntimeScene.audio`.
- [ ] Re-run the converter test and confirm it passes.

### Task 2: Build isolated player audio controller

**Files:**
- Create: `apps/web/src/player/audioDirector.ts`
- Test: `apps/web/src/player/audioDirector.test.ts`
- Modify: `apps/web/src/player/VisualNovelPlayer.tsx`

- [ ] Add failing unit tests for BGM play/keep/stop, SFX/voice one-shot playback, volume updates and disposal.
- [ ] Implement the minimal controller using injected audio factories.
- [ ] Integrate the controller with scene changes, player settings, restart and page cleanup.
- [ ] Run controller and player tests.

### Task 3: Add audio direction to shot cards

**Files:**
- Modify: `apps/web/src/editor/ShotCardEditor.tsx`
- Modify: `apps/web/src/editor/sceneGraph.ts`
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/editor/ShotCardEditor.test.tsx`

- [ ] Add a failing UI test asserting BGM, SFX and voice selectors only surface audio assets.
- [ ] Add the structured shot-card fields and persist them into dialogue/subtitle/choice node data.
- [ ] Add an accessible compact audio section to the editor and wire it to the project asset library.
- [ ] Run the editor test.

### Task 4: Expand audio asset taxonomy and Agent inventory

**Files:**
- Modify: `apps/server/src/routes/assets.ts`
- Modify: `apps/web/src/editor/AssetPanel.tsx`
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Modify: `apps/server/src/agent/tools.ts`
- Modify: `apps/server/src/agent/localAssistant.ts`
- Test: `apps/server/src/routes/assets.test.ts`
- Test: `apps/server/src/agent/localAssistant.test.ts`

- [ ] Add failing tests for validated SFX/VOICE upload types and offline audio inventory guidance.
- [ ] Accept the two new audio categories through existing validation/storage paths.
- [ ] Label and filter BGM/SFX/VOICE consistently in library and editor panels.
- [ ] Extend local Agent inventory output with audio coverage and missing-direction advice.
- [ ] Run the focused tests.

### Task 5: Add user and maintainer documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/CREATOR_WORKFLOW.md`
- Modify: `docs/AGENT_GUIDE.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/CURRENT_HANDOFF.md`
- Modify: `CHANGELOG.md`

- [ ] Document supported audio formats, creation workflow, playback behavior and current boundaries.
- [ ] Document the three-channel runtime and Agent’s read-only audio role.
- [ ] Update handoff and changelog with verification results and future directions.

### Task 6: Verify and publish

**Files:**
- Verify: repository-wide

- [ ] Run `pnpm lint`, `pnpm test`, `pnpm -r build`, `pnpm test:readiness`, and `git diff --check`.
- [ ] Start the app and verify uploaded audio can be selected from a shot card and appears in the player flow.
- [ ] Commit only implementation, tests and documentation; push `main`.
- [ ] Verify the latest GitHub CI and Pages runs for the pushed commit.
