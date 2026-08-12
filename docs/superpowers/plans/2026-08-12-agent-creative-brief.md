# Agent Creative Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Agent execution policy from orchestration and use a structured creative brief to keep material planning consistent with the story request.

**Architecture:** A pure policy selects a deterministic local, local-import, creative-action, conversation, or material-plan route. A pure creative-brief module parses screenplay text, conservatively matches project material, builds StoryPatch input, and formats material requirements. `PrismaAgentRunService` consumes the route without changing existing persistence or approval contracts.

**Tech Stack:** TypeScript, Zod, Vitest, Express/Prisma, `@dreamchord/story-domain`.

---

### Task 1: Add a pure Agent policy

**Files:**
- Create: `apps/server/src/agent/policy.ts`
- Create: `apps/server/src/agent/policy.test.ts`
- Modify: `apps/server/src/agent/runService.ts`

- [ ] **Step 1: Write failing routing tests**

```ts
expect(decideAgentPolicy({ prompt: '根据当前章节创建可运行场景', hasChapter: true, hasSelectedDraft: false, provider: 'glm', materialMode: 'reuse' }).kind).toBe('creative-action')
expect(decideAgentPolicy({ prompt: '根据当前章节创建可运行场景', hasChapter: true, hasSelectedDraft: false, provider: 'glm', materialMode: 'prompts' }).kind).toBe('material-plan')
expect(decideAgentPolicy({ prompt: '【已选草稿】\n雪：回来吧。\n【草稿结束】', hasChapter: true, hasSelectedDraft: true, provider: 'glm', materialMode: 'reuse' }).kind).toBe('local-import')
```

- [ ] **Step 2: Run focused test and confirm failure**

Run: `pnpm --filter dreamchord-server test -- policy.test.ts`

Expected: failing import because `policy.ts` does not exist.

- [ ] **Step 3: Implement policy**

```ts
export type AgentPolicyKind = 'local-immediate' | 'local-import' | 'creative-action' | 'conversation' | 'material-plan'

export function decideAgentPolicy(input: AgentPolicyInput): AgentPolicyDecision {
  if (input.hasSelectedDraft) return { kind: 'local-import' }
  if (input.materialMode === 'prompts' && input.hasChapter && isCreativePrompt(input.prompt)) return { kind: 'material-plan' }
  if (isImmediateLocalPrompt(input.prompt) || input.provider === 'local') return { kind: 'local-immediate' }
  if (shouldUseActionAgent(input.prompt, input.hasChapter)) return { kind: 'creative-action' }
  return { kind: 'conversation' }
}
```

- [ ] **Step 4: Replace `runService` local boolean routing with policy decision**

Use `decision.kind` when choosing local assistant, provider executor, and action fallback. Preserve existing status transitions and approval semantics.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm --filter dreamchord-server test -- policy.test.ts runService.test.ts agent.e2e.test.ts`

Commit:

```bash
git add apps/server/src/agent/policy.ts apps/server/src/agent/policy.test.ts apps/server/src/agent/runService.ts
git commit -m "refactor(agent): isolate execution policy"
```

### Task 2: Create a structured creative brief

**Files:**
- Create: `apps/server/src/agent/creativeBrief.ts`
- Create: `apps/server/src/agent/creativeBrief.test.ts`
- Modify: `apps/server/src/agent/localAssistant.ts`

- [ ] **Step 1: Write failing brief tests**

```ts
const brief = buildCreativeBrief({ text: '【地点】夜晚港口\n【雪】我终于找到这封信了。', snapshot })
expect(brief.scenes[0]?.location).toBe('夜晚港口')
expect(brief.scenes[0]?.cards).toContainEqual(expect.objectContaining({ type: 'dialogue', role: '雪' }))
expect(brief.materials.reused).toContainEqual(expect.objectContaining({ type: 'BACKGROUND', name: '夜晚港口' }))
```

- [ ] **Step 2: Run focused test and confirm failure**

Run: `pnpm --filter dreamchord-server test -- creativeBrief.test.ts`

Expected: failing import because `creativeBrief.ts` does not exist.

- [ ] **Step 3: Implement pure brief parsing and material requirements**

Define explicit `CreativeBrief`, `CreativeBriefScene`, `CreativeBriefCard`, and `MaterialRequirement` types. Match project backgrounds/characters only by normalized exact name or stable ID. Record unmatched scene settings and speaking roles as missing requirements with generated prompts.

- [ ] **Step 4: Move deterministic imported-screenplay parsing to the brief**

Keep public `runLocalAssistant` behavior intact. Have its selected-draft path build a brief and then generate the same reviewable StoryPatch from that brief.

- [ ] **Step 5: Run focused tests and commit**

Run: `pnpm --filter dreamchord-server test -- creativeBrief.test.ts localAssistant.test.ts`

Commit:

```bash
git add apps/server/src/agent/creativeBrief.ts apps/server/src/agent/creativeBrief.test.ts apps/server/src/agent/localAssistant.ts apps/server/src/agent/localAssistant.test.ts
git commit -m "feat(agent): derive material plans from creative briefs"
```

### Task 3: Keep material-prompt requests tied to the original story goal

**Files:**
- Modify: `apps/server/src/agent/localAssistant.ts`
- Modify: `apps/server/src/agent/runService.ts`
- Modify: `apps/server/src/agent/localAssistant.test.ts`
- Modify: `apps/server/src/agent/agent.e2e.test.ts`

- [ ] **Step 1: Write failing regression test**

```ts
const ready = await service.getRun(run.id, 'owner')
expect(ready.patch).toBeNull()
const message = await client.agentMessage.findFirstOrThrow({ where: { conversationId: conversation.id, role: 'assistant' } })
expect(message.content).toContain('夜晚港口')
expect(message.content).toContain('缺少素材')
```

- [ ] **Step 2: Run focused test and confirm failure**

Run: `pnpm --filter dreamchord-server test -- agent.e2e.test.ts`

Expected: current material mode discards the original creative prompt.

- [ ] **Step 3: Implement material-plan response**

Pass the original prompt to the local assistant with `materialPlanOnly: true`. It must return no patch, list reusable material, list missing material, and emit copyable background/character/CG prompts grounded in the brief.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm --filter dreamchord-server test -- localAssistant.test.ts agent.e2e.test.ts`

Commit:

```bash
git add apps/server/src/agent/localAssistant.ts apps/server/src/agent/runService.ts apps/server/src/agent/localAssistant.test.ts apps/server/src/agent/agent.e2e.test.ts
git commit -m "fix(agent): preserve story context in material planning"
```

### Task 4: Update architecture and verify the release

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/AGENT_GUIDE.md`
- Modify: `docs/CURRENT_HANDOFF.md`

- [ ] **Step 1: Document policy, brief, and queue boundary**

Add the route table, CreativeBrief data flow, conservative material matching rule, and explicit future queue-adapter direction. Mark Cloudflare/Azure queue migration as future work, not a current capability.

- [ ] **Step 2: Run complete verification**

```bash
pnpm lint
pnpm test
pnpm -r build
pnpm test:readiness
git diff --check
```

- [ ] **Step 3: Commit and push**

```bash
git add apps/server/src/agent docs
git commit -m "docs: document agent creative brief architecture"
git push origin main
```
