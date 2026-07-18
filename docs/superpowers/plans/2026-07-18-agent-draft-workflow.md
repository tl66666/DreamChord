# Agent Draft Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Agent prose into an explicit, reviewable draft workflow that can create matching workbench cards, while keeping story drafts separate from the image-and-audio asset library.

**Architecture:** Conversation messages remain the durable source for prose drafts. A user can run a saved assistant reply as a chapter-scoped `story_patch`; the patch stays pending until applied, then becomes editable scene cards. The editor Agent keeps one toggleable local health report, and its shortcut commands execute the selected writing task instead of merely pre-filling the input.

**Tech Stack:** React, TypeScript, Vitest, Express/Prisma Agent run service, shared StoryPatch contract.

---

### Task 1: Make health checks toggleable

**Files:**
- Modify: `apps/web/src/agent/AgentComposer.tsx`
- Modify: `apps/web/src/agent/AgentPanel.tsx`
- Test: `apps/web/src/agent/AgentPanel.test.tsx`

- [x] **Step 1: Add a failing component test**

```tsx
fireEvent.click(screen.getByRole('button', { name: '运行剧情体检' }))
expect(screen.getByRole('button', { name: '收起剧情体检' })).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: '收起剧情体检' }))
expect(screen.queryByText(/规则体检/)).toBeNull()
```

- [x] **Step 2: Run focused test and confirm failure**

Run: `pnpm --filter dreamchord-web test -- AgentPanel.test.tsx`

- [x] **Step 3: Implement a single health-report toggle**

```tsx
onHealth={() => setLocalReport((current) => current ? null : analyzeStoryGraph(graph))}
```

- [x] **Step 4: Run focused test and confirm pass**

Run: `pnpm --filter dreamchord-web test -- AgentPanel.test.tsx`

### Task 2: Preserve prose as structured workbench cards

**Files:**
- Modify: `apps/server/src/agent/localAssistant.ts`
- Test: `apps/server/src/agent/localAssistant.test.ts`

- [x] **Step 1: Add a failing continuation test**

```ts
expect(result.patch?.operations).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: 'addNode', node: expect.objectContaining({ type: 'dialogue', data: expect.objectContaining({ role: '林宇' }) }) }),
]))
```

- [x] **Step 2: Run focused test and confirm failure**

Run: `pnpm --filter dreamchord-server test -- localAssistant.test.ts`

- [x] **Step 3: Parse labelled dialogue and narration paragraphs**

```ts
const cards = parseContinuationCards(suppliedContinuation)
// "角色（动作）：台词" becomes a dialogue card; unlabelled prose remains a subtitle card.
```

- [x] **Step 4: Run focused test and confirm pass**

Run: `pnpm --filter dreamchord-server test -- localAssistant.test.ts`

### Task 3: Make saved conversation drafts actionable

**Files:**
- Modify: `apps/web/src/agent/ConversationTranscript.tsx`
- Modify: `apps/web/src/agent/AgentWorkspace.tsx`
- Modify: `apps/web/src/agent/AgentPanel.tsx`
- Modify: `apps/web/src/agent/AgentComposer.tsx`
- Test: `apps/web/src/agent/ConversationTranscript.test.tsx`
- Test: `apps/web/src/agent/AgentPanel.test.tsx`

- [x] **Step 1: Add failing UI tests for draft actions**

```tsx
expect(screen.getByRole('button', { name: '生成工作台场景' })).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: '续写已选场景' }))
expect(start).toHaveBeenCalledWith(expect.objectContaining({ scope: 'scene' }))
```

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter dreamchord-web test -- ConversationTranscript.test.tsx AgentPanel.test.tsx`

- [x] **Step 3: Implement draft actions**

```tsx
onDraftAction({ prompt: '根据当前对话中最近一份续写草稿，创建可编辑的工作台场景。', scope: 'chapter' })
```

- [x] **Step 4: Run focused tests and confirm pass**

Run: `pnpm --filter dreamchord-web test -- ConversationTranscript.test.tsx AgentPanel.test.tsx`

### Task 4: Verify the complete creative loop

- [x] Build and start the services.
- [x] In the editor, run the health check twice and verify it opens then closes.
- [ ] Use an assistant continuation with named dialogue, choose `生成工作台场景`, inspect pending patch cards, apply it, then select the inserted scene and run `续写已选场景`.
- [x] Run `pnpm lint`, `pnpm test`, `pnpm -r build`, and `git diff --check`.
