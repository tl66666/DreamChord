# Draft Scene Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a continuation that has no matching project material can still become an editable text-only workbench scene without invalid graph references.

**Architecture:** The local Agent creates a typed patch. A text-only draft owns subtitle nodes and may link from the preceding card directly to its first subtitle; it must never reference the background temporary node that is intentionally absent. Existing matching-material drafts keep the background -> character -> subtitle chain.

**Tech Stack:** TypeScript, Vitest, shared DreamChord story-patch contract.

---

### Task 1: Protect the text-only draft patch

**Files:**
- Modify: `apps/server/src/agent/localAssistant.test.ts`
- Modify: `apps/server/src/agent/localAssistant.ts`

- [x] **Step 1: Write the failing regression test**

```ts
expect(result.patch?.operations.some((operation) => (
  operation.kind === 'addEdge' && operation.targetRef === 'scene-background'
))).toBe(false)
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `pnpm --filter dreamchord-server test -- localAssistant.test.ts`

Expected: the unmatched-continuation test fails because the patch contains an edge to `scene-background` while no background node is created.

- [x] **Step 3: Write the minimal implementation**

```ts
if (!textDraft && terminal) {
  operations.unshift({ kind: 'addEdge', sourceRef: terminal.id, targetRef: 'scene-background' })
}
```

- [x] **Step 4: Run the focused test and confirm it passes**

Run: `pnpm --filter dreamchord-server test -- localAssistant.test.ts`

Expected: all local Assistant tests pass.

### Task 2: Verify the production workflow

**Files:**
- No source changes expected

- [x] **Step 1: Build the workspace and restart the compiled server**

Run: `pnpm -r build`, then launch `apps/server/dist/index.js` on port 3001.

- [x] **Step 2: Reproduce in the editor**

Open `http://127.0.0.1:5173/editor/sakura-story`, generate a continuation mentioning a new character, choose `生成试玩场景`, and inspect the Agent proposal.

Expected: the proposal is titled `文本草稿场景`, contains the continuation text, creates no default character/background, and remains applicable.

- [x] **Step 3: Run completion checks**

Run: `pnpm lint`, `pnpm test`, `pnpm build`, `git diff --check`.
