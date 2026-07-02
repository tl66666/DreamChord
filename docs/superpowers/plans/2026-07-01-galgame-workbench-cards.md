# Galgame Workbench Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn DreamChord's workbench into a practical Galgame authoring surface built around chapters, scenes, shot cards, character speech, narration, thoughts, memories, and branch destinations.

**Architecture:** Keep the existing node graph as the runtime source of truth, but make the workbench create and edit higher-level shot cards that compile into background, character, dialogue, subtitle, and choice nodes. Preview remains driven by the compiled runtime converter so editor and player stay aligned.

**Tech Stack:** React, TypeScript, Zustand, React Flow, Express, Prisma, SQLite.

---

### Task 1: Shot Card Data Model

**Files:**
- Modify: `apps/web/src/editor/WorkbenchPanel.tsx`
- Modify: `apps/web/src/engine/converter.ts`

- [ ] Add `lensType` to scene drafts with values `dialogue`, `narration`, `thought`, `memory`, `system`.
- [ ] Add speaker auto-stage fields so a single card can show a character, set expression/position, and write dialogue.
- [ ] Preserve data on generated text nodes using `lensType` so preview can distinguish narration, thought, and memory.

### Task 2: Shot Composer UI

**Files:**
- Modify: `apps/web/src/editor/WorkbenchPanel.tsx`

- [ ] Replace the plain scene modal copy with a "镜头卡" editor.
- [ ] Add type buttons for 对话、旁白、心理、回忆、系统提示.
- [ ] Show character controls when the card is dialogue/thought, and keep multiple visible characters for scene composition.
- [ ] Add "随机表情" as an expression option.

### Task 3: Branch Card Destinations

**Files:**
- Modify: `apps/web/src/editor/WorkbenchPanel.tsx`

- [ ] Make each choice row show its current destination.
- [ ] Keep "写这条分支" and "跳转已有场景" as first-class actions.
- [ ] Do not auto-merge branches unless the user chooses a merge point.

### Task 4: Long Story Management

**Files:**
- Modify: `apps/web/src/editor/FlowEditor.tsx`
- Modify: `apps/web/src/editor/WorkbenchPanel.tsx`

- [ ] Keep true backend chapters as top-level workspaces.
- [ ] Keep scene-code filtering inside each chapter as an optional local scene index.
- [ ] Preview all chapters in order.

### Task 5: Verification

**Files:**
- Modify: `README.md`

- [ ] Run `npm run build` in `apps/web`.
- [ ] Run `npm run build` in `apps/server`.
- [ ] Browser-check editor shot card modal.
- [ ] Browser-check player has back-to-workbench flow.
