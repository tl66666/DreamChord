# Agent Routing and Stage Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DreamChord answer arbitrary chat reliably while preserving strict mutation approval, and make new story scenes inherit the effective visual-novel stage.

**Architecture:** Add a deterministic execution-mode selector in the server. Natural conversation gets a read-only executor; explicit actions keep the structured tool executor. Add a pure graph stage resolver to the editor and use it to seed and explain new scene drafts.

**Tech Stack:** TypeScript, Express, Prisma, React, Vitest, React Testing Library, Tailwind CSS

---

### Task 1: Agent execution routing

**Files:**
- Modify: `apps/server/src/agent/localAssistant.ts`
- Modify: `apps/server/src/agent/executor.ts`
- Modify: `apps/server/src/agent/runService.ts`
- Test: `apps/server/src/agent/localAssistant.test.ts`
- Test: `apps/server/src/agent/executor.test.ts`
- Test: `apps/server/src/agent/agent.e2e.test.ts`

- [ ] Add failing tests for time/date, first-response natural text, read-only tool calls, patch suppression, and user-visible failures.
- [ ] Run the focused server tests and confirm failures describe the missing routing behavior.
- [ ] Implement local, conversation, and action mode selection with read-only tool restrictions.
- [ ] Persist a visible assistant failure message without creating patches, memories, or artifacts.
- [ ] Run focused tests and commit.

### Task 2: Story stage continuity

**Files:**
- Modify: `apps/web/src/editor/workbench/workbenchTypes.ts`
- Modify: `apps/web/src/editor/workbench/storyEditorGraph.ts`
- Modify: `apps/web/src/editor/workbench/StoryEditor.tsx`
- Modify: `apps/web/src/editor/workbench/SceneComposerModal.tsx`
- Modify: `apps/web/src/editor/workbench/StoryEditorParts.tsx`
- Test: `apps/web/src/editor/workbench/storyEditorGraph.test.ts`
- Test: `apps/web/src/editor/WorkbenchPanel.test.tsx`

- [ ] Add failing tests for background inheritance, character keep/show/hide, and branch-specific stage state.
- [ ] Implement a pure path-aware stage resolver and inherited scene draft builder.
- [ ] Seed new main/branch scenes from the predecessor stage and show inherited state in the composer.
- [ ] Show the effective stage on story cards and flag ambiguous merge state.
- [ ] Run focused tests and commit.

### Task 3: Agent product emphasis

**Files:**
- Modify: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/web/src/pages/HomePage.test.tsx`
- Modify: `README.md`
- Modify: `docs/AGENT_GUIDE.md`
- Modify: `docs/LONG_STORY_WORKFLOW.md`
- Modify: `docs/showcase.html`

- [ ] Add a project-specific Agent action and concise first-viewport capability strip.
- [ ] Document execution boundaries and stage continuity with concrete workflows.
- [ ] Run frontend tests and commit.

### Task 4: End-to-end verification and evidence

**Files:**
- Modify: `docs/screenshots/*.png` only with real browser captures

- [ ] Run lint, all tests, production build, readiness checks, and `git diff --check`.
- [ ] Start through `start-dreamchord.ps1` twice and verify API/frontend health.
- [ ] Use a real browser to test time, general chat, project analysis, new-character continuity, and responsive layouts.
- [ ] Capture real Agent and story-editor screenshots, update the showcase references, rerun readiness, commit, and push `main`.
