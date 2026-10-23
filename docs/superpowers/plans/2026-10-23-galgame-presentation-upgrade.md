# Galgame Presentation Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify sprite staging across player and editor, add full/bust/stage character previews, and turn the official demo's final choice into three real endings.

**Architecture:** A focused `stagePresentation` module owns deterministic layout rules while `StageCharacters` owns rendering and speaker focus. The player and mini preview consume that shared component. The story domain remains the single source of truth for branching.

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion, Vitest, existing DreamChord runtime.

---

### Task 1: Add deterministic stage layout rules

**Files:**
- Create: `apps/web/src/stage/stagePresentation.ts`
- Test: `apps/web/src/stage/stagePresentation.test.ts`

- [ ] Write tests asserting human characters use bust framing in stage mode, system sprites stay fully visible, one/two/three-character positions are stable, and non-speakers are dimmed.
- [ ] Run `pnpm --filter dreamchord-web test -- stagePresentation.test.ts` and observe the missing-module failure.
- [ ] Implement `getStageSpritePresentation` and exported presentation types without reading or mutating story state.
- [ ] Re-run the focused test and commit the green change.

### Task 2: Share sprite rendering between player and editor

**Files:**
- Create: `apps/web/src/stage/StageCharacters.tsx`
- Create: `apps/web/src/stage/StageCharacters.test.tsx`
- Modify: `apps/web/src/player/VisualNovelPlayer.tsx`
- Modify: `apps/web/src/editor/MiniPreview.tsx`

- [ ] Write component tests for URL resolution, `data-framing`, speaker focus, special-system framing, and image-error fallback.
- [ ] Run the focused test and verify it fails before the component exists.
- [ ] Implement the component with `AnimatePresence`, `object-contain`/controlled crop rules, a fixed dialogue-safe bottom, and reduced-motion-friendly transitions.
- [ ] Replace the player's private `CharacterSprite` and the mini preview's duplicate image mapping with the shared component.
- [ ] Run both stage tests plus the player source and editor preview tests; commit when green.

### Task 3: Add character full/bust/stage inspection

**Files:**
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Modify: `apps/web/src/pages/LibraryPage.test.tsx`

- [ ] Add a failing test that switches 全身、半身、舞台 and verifies the corresponding preview mode and current expression.
- [ ] Implement an accessible three-way segmented control, stage background/safe area, and keep mode changes as local UI state only.
- [ ] Run the library tests and commit the green change.

### Task 4: Polish the formal player shell

**Files:**
- Modify: `apps/web/src/player/VisualNovelPlayer.tsx`
- Modify: `apps/web/src/player/VisualNovelPlayer.source.test.ts`

- [ ] Extend source tests for labelled AUTO/SKIP state, hidden continue indicator while typing, choice focus styles, and the shared stage component.
- [ ] Implement a low-interference top toolbar, star-string glass dialogue panel, scroll-safe mobile choices, and visible keyboard focus.
- [ ] Verify auto and skip both stop at a choice, digit shortcuts still select, and settings/history clicks do not advance dialogue.
- [ ] Run focused player/audio tests and commit.

### Task 5: Give the official demo three distinct endings

**Files:**
- Modify: `packages/story-domain/src/officialDemo.ts`
- Modify: `packages/story-domain/src/officialDemo.test.ts`
- Modify: `DEMO_STORY.md`

- [ ] Write graph tests that start from each final choice handle, require a unique route-specific reply and terminal node, and reject an immediate shared merge.
- [ ] Run the focused domain test and observe failure against the current shared `s8-save` path.
- [ ] Add three short ending sequences—accepting failure, shared authorship, and returning agency—each with its own consequence and closing line.
- [ ] Synchronize the human-readable demo document and run all story-domain tests.
- [ ] Commit the green story change.

### Task 6: Full verification and visual QA

**Files:**
- Modify only when verification exposes a defect.

- [ ] Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:readiness`, and `git diff --check`.
- [ ] Launch the workspace and inspect player, mini preview, and character library at 1440×900, 1024×768, 430×932, and 390×844.
- [ ] Play all three endings, check console/network errors, and fix any regression with a focused failing test first.

