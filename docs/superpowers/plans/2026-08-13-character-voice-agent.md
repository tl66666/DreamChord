# Character Voice and Production Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authorized character voice-reference management and Agent-generated voice production plans without pretending to provide a local voice-cloning model.

**Architecture:** Reuse the secure asset library for `VOICE_SAMPLE` files and store a compact profile on project characters. The Agent reads project-scoped characters, samples, and dialogue to produce read-only plans. Existing `VOICE` assets remain the only playable voice URLs.

**Tech Stack:** TypeScript, Express, Prisma/SQLite, Zod, React, Vitest, existing DreamChord Agent tool registry.

---

### Task 1: Model character voice profiles

**Files:** `apps/server/prisma/schema.prisma`, `apps/server/src/routes/projects.ts`, `apps/web/src/api/client.ts`, tests for project API.

- [x] Keep profile information in project-scoped `VOICE_SAMPLE` metadata for this iteration, avoiding an unnecessary schema migration.
- [x] Validate the character ownership and affirmative consent on the upload route.
- [x] Test missing consent, unrelated characters, and valid metadata persistence.

### Task 2: Classify and inspect voice samples

**Files:** `apps/server/src/routes/assets.ts`, `apps/server/src/routes/assets.test.ts`, `apps/web/src/editor/AssetPanel.tsx`, `apps/web/src/pages/LibraryPage.tsx`.

- [x] Add a `VOICE_SAMPLE` audio type through the existing signature validation path.
- [x] Clearly distinguish reference samples from playable `VOICE` assets in editor and library UI.
- [x] Test that samples use the audio validation path and require project character ownership.

### Task 3: Add provider-neutral voice plans

**Files:** `apps/server/src/agent/voicePlan.ts`, `.test.ts`, `apps/server/src/agent/tools.ts`, `apps/server/src/agent/policy.ts`, `apps/server/src/agent/localAssistant.ts`.

- [x] Write and observe failing tests for line extraction, character matching, sample consent, and no-provider fallback.
- [x] Add `plan_character_voice` as a read-only project-scoped tool.
- [x] Return a structured, author-reviewable plan; never create `StoryPatch` or bind audio.

### Task 4: Surface the workflow and document provider boundary

**Files:** character settings/editor UI, `README.md`, `docs/CREATOR_WORKFLOW.md`, `docs/AGENT_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/CURRENT_HANDOFF.md`, `CHANGELOG.md`, `docs/showcase.html`.

- [x] Show project-role selection, optional delivery notes, and consent confirmation at sample upload.
- [x] Explain sample quality, consent, no-provider behavior, and the candidate-review path.
- [x] Record the chosen boundaries and deferred provider generation work.

### Task 5: Verify and publish

- [x] Run focused red/green tests, `pnpm lint`, `pnpm test`, `pnpm -r build`, `pnpm test:readiness`, and `git diff --check`.
- [ ] Commit only code, docs, and tests; push `main`; wait for CI and Pages for that commit.
