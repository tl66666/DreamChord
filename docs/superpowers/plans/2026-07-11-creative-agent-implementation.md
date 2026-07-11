# DreamChord Creative Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a project-aware creative Agent that diagnoses a visual-novel chapter, proposes a validated story-graph patch, previews the diff, applies it transactionally, and can undo it.

**Architecture:** Add a small shared story-domain package for graph and patch rules, then layer Prisma persistence and a bounded single-Agent executor on the server. The React editor consumes persisted Agent runs through polling and never mutates a chapter until the author explicitly applies a validated patch.

**Tech Stack:** TypeScript, React 18, Zustand, Express 4, Prisma 5 with SQLite, Zod, Vitest, Testing Library, Supertest, existing OpenAI-compatible LLM providers.

---

## File Map

New shared domain files:

- `packages/story-domain/package.json`: workspace package scripts and exports.
- `packages/story-domain/tsconfig.json`: strict library build configuration.
- `packages/story-domain/src/types.ts`: provider-neutral node, edge, patch, issue, and validation types.
- `packages/story-domain/src/schemas.ts`: Zod schemas for nodes, edges, and patch operations.
- `packages/story-domain/src/health.ts`: deterministic graph diagnostics.
- `packages/story-domain/src/patch.ts`: normalize, validate, apply, and diff story patches.
- `packages/story-domain/src/*.test.ts`: pure domain regression tests.

New server files:

- `apps/server/src/routes/storyBible.ts`: project story-bible endpoints.
- `apps/server/src/routes/health.ts`: persisted project-health endpoint.
- `apps/server/src/routes/agent.ts`: conversation, run, apply, reject, retry, cancel, and undo endpoints.
- `apps/server/src/app.ts`: Express application factory used by production and tests.
- `apps/server/src/agent/context.ts`: bounded project/chapter/scene context assembly.
- `apps/server/src/agent/tools.ts`: fixed Agent tool registry.
- `apps/server/src/agent/protocol.ts`: structured model-response parsing.
- `apps/server/src/agent/executor.ts`: bounded Agent state machine.
- `apps/server/src/agent/queue.ts`: in-process queue and startup recovery.
- `apps/server/src/agent/runService.ts`: persistence and lifecycle transitions.
- `apps/server/src/story/patchService.ts`: transactional patch apply and undo.
- `apps/server/src/validation/http.ts`: reusable Zod request parsing.

New web files:

- `apps/web/src/agent/agentTypes.ts`: frontend Agent DTOs.
- `apps/web/src/agent/useAgentRun.ts`: create, poll, cancel, apply, reject, retry, and undo state.
- `apps/web/src/agent/AgentPanel.tsx`: editor-side Agent container.
- `apps/web/src/agent/AgentComposer.tsx`: prompt, scope, and shortcuts.
- `apps/web/src/agent/AgentTimeline.tsx`: plan and tool progress.
- `apps/web/src/agent/PatchPreview.tsx`: graph diff preview and node navigation.
- `apps/web/src/agent/AgentApprovalBar.tsx`: approval lifecycle commands.
- `apps/web/src/editor/StoryBiblePanel.tsx`: story-bible form.
- `apps/web/src/editor/workbench/StoryEditor.tsx`: extracted story tab.
- `apps/web/src/editor/workbench/CharacterOverview.tsx`: extracted character tab.
- `apps/web/src/editor/workbench/SceneOverview.tsx`: extracted scene tab.

Primary modified files:

- `apps/server/prisma/schema.prisma`
- `apps/server/src/index.ts`
- `apps/server/src/routes/projects.ts`
- `apps/server/src/llm/providers.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/stores/editorStore.ts`
- `apps/web/src/editor/FlowEditor.tsx`
- `apps/web/src/editor/ProjectHealthPanel.tsx`
- `apps/web/src/editor/ProjectSettingsModal.tsx`
- `apps/web/src/editor/WorkbenchPanel.tsx`
- `apps/web/src/pages/AIWriterPage.tsx`
- `apps/web/src/pages/HomePage.tsx`
- `apps/web/src/pages/LibraryPage.tsx`
- `README.md`
- `CLAUDE.md`

### Task 1: Add Test Infrastructure And Shared Story Domain

**Files:**
- Create: `packages/story-domain/package.json`
- Create: `packages/story-domain/tsconfig.json`
- Create: `packages/story-domain/src/index.ts`
- Create: `packages/story-domain/src/types.ts`
- Modify: `apps/server/package.json`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add workspace test dependencies and scripts**

Create `packages/story-domain/package.json`:

```json
{
  "name": "@dreamchord/story-domain",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vitest": "^2.1.9"
  }
}
```

Create `packages/story-domain/tsconfig.json` with `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `declaration: true`, `outDir: dist`, and `rootDir: src`.

Add `@dreamchord/story-domain: workspace:*`, `vitest`, `supertest`, and `@types/supertest` to the server. Add `@dreamchord/story-domain: workspace:*`, `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom` to the web app. Add `test` scripts to both apps and root package.

- [ ] **Step 2: Define neutral graph types**

Create `packages/story-domain/src/types.ts`:

```ts
export const STORY_NODE_TYPES = [
  'dialogue', 'choice', 'background', 'character', 'transition',
  'subtitle', 'delay', 'condition', 'setVariable', 'jump',
] as const

export type StoryNodeType = typeof STORY_NODE_TYPES[number]

export interface StoryNode {
  id: string
  type: StoryNodeType
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface StoryEdge {
  id: string
  source: string
  target: string
  label?: string
  sourceHandle?: string
  animated: boolean
}

export interface StoryGraph {
  nodes: StoryNode[]
  edges: StoryEdge[]
}

export type IssueLevel = 'info' | 'warning' | 'danger'

export interface StoryIssue {
  code: string
  level: IssueLevel
  title: string
  detail: string
  nodeIds: string[]
  sceneGroupId?: string
  fixKind?: 'connect-choice' | 'remove-edge' | 'fill-text' | 'review-branch'
}
```

Export all public modules from `src/index.ts`.

- [ ] **Step 3: Verify the empty test harness and package build**

Run: `pnpm install`

Expected: lockfile updates successfully.

Run: `pnpm --filter @dreamchord/story-domain build`

Expected: TypeScript exits 0 and creates `packages/story-domain/dist`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml apps/server/package.json apps/web/package.json packages/story-domain
git commit -m "test: add shared story domain harness"
```

### Task 2: Extract Deterministic Story Health Rules

**Files:**
- Create: `packages/story-domain/src/health.ts`
- Create: `packages/story-domain/src/health.test.ts`
- Modify: `packages/story-domain/src/index.ts`
- Modify: `apps/web/src/editor/ProjectHealthPanel.tsx`

- [ ] **Step 1: Write failing graph-health tests**

Create tests for a disconnected choice and an unreachable node:

```ts
import { describe, expect, it } from 'vitest'
import { analyzeStoryGraph, type StoryGraph } from './index.js'

describe('analyzeStoryGraph', () => {
  it('reports an option without a choice edge', () => {
    const graph: StoryGraph = {
      nodes: [{
        id: 'choice-1', type: 'choice', position: { x: 0, y: 0 },
        data: { choices: ['留下', '离开'], sceneGroupId: 'scene-1' },
      }],
      edges: [],
    }

    const report = analyzeStoryGraph(graph)

    expect(report.issues.filter((issue) => issue.code === 'choice-exit-missing')).toHaveLength(2)
  })

  it('reports nodes unreachable from the single start node', () => {
    const graph: StoryGraph = {
      nodes: [
        { id: 'start', type: 'subtitle', position: { x: 0, y: 0 }, data: { text: '开始' } },
        { id: 'end', type: 'subtitle', position: { x: 0, y: 100 }, data: { text: '结束' } },
        { id: 'lost', type: 'dialogue', position: { x: 300, y: 0 }, data: { role: '雪', text: '无人听见' } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'end', animated: true }],
    }

    const report = analyzeStoryGraph(graph)

    expect(report.issues.some((issue) => issue.code === 'node-unreachable' && issue.nodeIds.includes('lost'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @dreamchord/story-domain test -- health.test.ts`

Expected: FAIL because `analyzeStoryGraph` is not exported.

- [ ] **Step 3: Implement the deterministic analyzer**

Implement `analyzeStoryGraph(graph)` returning:

```ts
export interface StoryHealthReport {
  issues: StoryIssue[]
  metrics: {
    nodeCount: number
    edgeCount: number
    choiceCount: number
    sceneGroupCount: number
    endingCount: number
    unreachableCount: number
  }
}
```

The implementation must emit stable issue codes for `invalid-edge`, `multiple-starts`, `choice-exit-missing`, `empty-text`, `isolated-node`, `node-unreachable`, `missing-background`, `missing-character`, `no-ending`, and `shallow-branch`. Use breadth-first traversal from the single start candidate and read `sceneGroupId`, `text`, and `choices` through guarded helpers.

- [ ] **Step 4: Replace component-local health logic**

Convert editor nodes and edges with a small adapter:

```ts
const report = analyzeStoryGraph({
  nodes: nodes.map((node) => ({
    id: node.id,
    type: (node.type || 'dialogue') as StoryNodeType,
    position: node.position,
    data: getNodeData(node),
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === 'string' ? edge.label : undefined,
    sourceHandle: edge.sourceHandle || undefined,
    animated: edge.animated ?? true,
  })),
})
```

Delete `buildHealthReport` and `collectReachableNodeIds` from the React component. Render the shared report and preserve the existing modal layout.

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter @dreamchord/story-domain test && pnpm --filter dreamchord-web build`

Expected: all domain tests pass and the web build exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/story-domain apps/web/src/editor/ProjectHealthPanel.tsx
git commit -m "refactor: share deterministic story health rules"
```

### Task 3: Define And Validate Story Patches

**Files:**
- Create: `packages/story-domain/src/schemas.ts`
- Create: `packages/story-domain/src/patch.ts`
- Create: `packages/story-domain/src/patch.test.ts`
- Modify: `packages/story-domain/src/index.ts`

- [ ] **Step 1: Write failing patch tests**

Cover temporary IDs, choice handles, node deletion, and unknown fields:

```ts
it('adds a node and resolves its temporary edge reference', () => {
  const result = applyStoryPatch(baseGraph, {
    operations: [
      { kind: 'addNode', tempId: 'new-line', node: { type: 'dialogue', data: { role: '雪', text: '继续。' } }, anchor: { afterNodeId: 'start' } },
      { kind: 'addEdge', sourceRef: 'start', targetRef: 'new-line' },
    ],
  }, () => 'generated-node')

  expect(result.graph.nodes.some((node) => node.id === 'generated-node')).toBe(true)
  expect(result.graph.edges.some((edge) => edge.target === 'generated-node')).toBe(true)
})

it('rejects a choice edge whose handle exceeds the choice count', () => {
  const result = validateStoryGraph({
    nodes: [{ id: 'choice', type: 'choice', position: { x: 0, y: 0 }, data: { choices: ['A'] } }],
    edges: [{ id: 'bad', source: 'choice', target: 'choice', sourceHandle: 'choice-2', animated: true }],
  })

  expect(result.errors.some((error) => error.code === 'choice-handle-invalid')).toBe(true)
})
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `pnpm --filter @dreamchord/story-domain test -- patch.test.ts`

Expected: FAIL because patch functions and schemas do not exist.

- [ ] **Step 3: Implement schemas and pure patch functions**

Define these public types:

```ts
export type PatchAnchor = { afterNodeId: string } | { beforeNodeId: string }

export type StoryPatchOperation =
  | { kind: 'addNode'; tempId: string; node: { type: StoryNodeType; data: Record<string, unknown>; position?: { x: number; y: number } }; anchor?: PatchAnchor }
  | { kind: 'updateNode'; nodeId: string; changes: Record<string, unknown> }
  | { kind: 'removeNode'; nodeId: string }
  | { kind: 'addEdge'; sourceRef: string; targetRef: string; sourceHandle?: string; label?: string }
  | { kind: 'removeEdge'; edgeId: string }

export interface StoryPatch {
  operations: StoryPatchOperation[]
}

export interface StoryPatchDiff {
  addedNodeIds: string[]
  updatedNodeIds: string[]
  removedNodeIds: string[]
  addedEdgeIds: string[]
  removedEdgeIds: string[]
}
```

Use discriminated Zod schemas with `.strict()`. Implement `validateStoryGraph`, `applyStoryPatch`, and `createStoryPatchDiff`. Node data validation must whitelist fields by node type; removing a node also removes its incident edges. Enforce 60 added nodes and 200 operations.

- [ ] **Step 4: Run domain tests**

Run: `pnpm --filter @dreamchord/story-domain test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/story-domain/src
git commit -m "feat: add validated story patch domain"
```

### Task 4: Add Agent Persistence And Chapter Versions

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/20260711_add_creative_agent/migration.sql`
- Modify: `apps/server/prisma/seed.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/stores/editorStore.ts`

- [ ] **Step 1: Add schema models and indexes**

Add `version Int @default(1)` to `Chapter`, a one-to-one `StoryBible`, and these relations:

```prisma
model StoryBible {
  id          String   @id @default(uuid())
  content     String   @default("{}")
  version     Int      @default(1)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  projectId   String   @unique @map("project_id")
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@map("story_bibles")
}

model AgentConversation {
  id        String         @id @default(uuid())
  title     String
  scope     String
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")
  userId    String         @map("user_id")
  projectId String         @map("project_id")
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  messages  AgentMessage[]
  runs      AgentRun[]
  @@index([userId, projectId])
  @@map("agent_conversations")
}
```

Add `AgentMessage`, `AgentRun`, `StoryPatch`, and `ChapterSnapshot` with JSON stored as `String`, explicit status strings, timestamps, project/user/chapter foreign keys, and indexes on ownership and status. Remove `AIProviderConfig` and `User.aiConfigs` because the application does not use them and storing plaintext provider keys is unsafe.

- [ ] **Step 2: Generate and apply the migration**

Run: `pnpm --filter server prisma generate`

Run: `pnpm --filter server prisma migrate dev --name add_creative_agent`

Expected: Prisma client generation and migration both exit 0.

- [ ] **Step 3: Add chapter version DTOs and editor state**

Add `version: number` to `Chapter`, `baseVersion: number` to `SaveChapterPayload`, and change `saveChapter` to return `{ version: number }`. Add this store state:

```ts
chapterVersion: number
setChapterVersion: (version: number) => void
```

Initialize it to `1`; set it whenever a chapter is loaded.

- [ ] **Step 4: Re-run generation, build, and seed**

Run: `pnpm --filter server prisma generate && pnpm --filter server build && pnpm --filter dreamchord-web build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/server/prisma apps/web/src/api/client.ts apps/web/src/stores/editorStore.ts
git commit -m "feat: persist agent runs and chapter versions"
```

### Task 5: Add Story Bible API And Settings UI

**Files:**
- Create: `apps/server/src/validation/http.ts`
- Create: `apps/server/src/routes/storyBible.ts`
- Create: `apps/server/src/routes/storyBible.test.ts`
- Create: `apps/server/src/app.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/editor/StoryBiblePanel.tsx`
- Modify: `apps/web/src/editor/ProjectSettingsModal.tsx`

- [ ] **Step 1: Write failing authorization and round-trip tests**

Use Supertest with an exported Express app. Test that an owner can `PUT` then `GET` this strict payload and a second user receives 403:

```ts
const content = {
  worldSummary: '节点能改写现实。',
  themes: ['存在', '选择'],
  styleGuide: '克制、事件驱动，不解释世界。',
  timelineRules: '故事发生在同一周。',
  forbiddenElements: ['无铺垫复活'],
  characterNotes: { yuki: { goal: '保护同伴', secret: '曾删除节点', voice: '简短直接', relations: '信任宫' } },
}
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter server test -- storyBible.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement strict request parsing and routes**

Create a helper:

```ts
export function parseBody<T>(schema: z.ZodType<T>, req: Request, res: Response): T | undefined {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: '请求参数不正确', details: result.error.flatten() })
    return undefined
  }
  return result.data
}
```

Implement owner-only `GET /api/projects/:projectId/story-bible` and `PUT` with an upsert. Return `{ content, version, updatedAt }` and increment the version on updates.

Move Express middleware, static files, routes, 404, and error middleware into `createApp()` in `app.ts`. Keep environment validation, `listen`, shutdown handlers, and queue recovery in `index.ts`. Supertest must import `createApp()` without opening a port.

- [ ] **Step 4: Add the tabbed settings UI**

Change `ProjectSettingsModal` to use `type SettingsTab = 'project' | 'storyBible'`. Load the bible when the second tab opens. `StoryBiblePanel` uses controlled inputs for every specified field and saves through `updateStoryBible(projectId, content)`.

- [ ] **Step 5: Run tests and builds**

Run: `pnpm --filter server test -- storyBible.test.ts && pnpm build`

Expected: route tests pass and both apps build.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src apps/web/src/api/client.ts apps/web/src/editor/ProjectSettingsModal.tsx apps/web/src/editor/StoryBiblePanel.tsx
git commit -m "feat: add project story bible"
```

### Task 6: Make Manual Chapter Saves Version-Safe

**Files:**
- Create: `apps/server/src/routes/projects.test.ts`
- Modify: `apps/server/src/routes/projects.ts`
- Modify: `apps/web/src/editor/FlowEditor.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/stores/editorStore.ts`

- [ ] **Step 1: Write a failing conflict test**

Save the same chapter twice with `baseVersion: 1`; assert the first returns 200 with version 2 and the second returns 409 with `{ error: '章节已被其他操作修改', currentVersion: 2 }`.

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm --filter server test -- projects.test.ts`

Expected: FAIL because the save route ignores `baseVersion`.

- [ ] **Step 3: Replace untyped full-save handling**

Parse the body with a strict Zod schema. Inside one transaction, update the chapter with:

```ts
const updated = await tx.chapter.updateMany({
  where: { id: chapterId, projectId: id, version: body.baseVersion },
  data: { version: { increment: 1 } },
})

if (updated.count !== 1) throw new ChapterVersionConflictError()
```

Then replace nodes and edges using typed mapped records. Return the new version. Remove all `any` from this route.

- [ ] **Step 4: Send and store the chapter version in FlowEditor**

Set `chapterVersion` when loading a chapter. Include it as `baseVersion` in `handleSave`; after success call `setChapterVersion(response.version)`. On 409, show a toast instructing the user to reload instead of silently overwriting.

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter server test -- projects.test.ts && pnpm build`

Expected: conflict test passes and both apps build.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/projects.ts apps/server/src/routes/projects.test.ts apps/web/src/api/client.ts apps/web/src/stores/editorStore.ts apps/web/src/editor/FlowEditor.tsx
git commit -m "feat: protect chapter saves with versions"
```

### Task 7: Build Agent Context And Deterministic Tools

**Files:**
- Create: `apps/server/src/agent/context.ts`
- Create: `apps/server/src/agent/context.test.ts`
- Create: `apps/server/src/agent/tools.ts`
- Create: `apps/server/src/agent/tools.test.ts`
- Create: `apps/server/src/routes/health.ts`
- Create: `apps/server/src/routes/health.test.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Write failing bounded-context tests**

Test that card scope returns at most nine text cards centered on the selected node, chapter scope returns summaries before full scene data, and story-bible secrets only include characters referenced by the selected scope.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter server test -- context.test.ts tools.test.ts`

Expected: FAIL because context and tools do not exist.

- [ ] **Step 3: Implement context sources**

Use this source envelope:

```ts
export interface AgentContextSource {
  id: string
  kind: 'story-bible' | 'character' | 'chapter-outline' | 'scene' | 'search-result' | 'health-report'
  title: string
  content: string
  nodeIds: string[]
}
```

Implement `buildInitialContext`, `readProjectBrief`, `readChapterOutline`, `readScene`, and `searchStory`. Cap search results at 20 and each serialized tool result at 20,000 characters.

- [ ] **Step 4: Implement the fixed tool registry**

Expose only these names:

```ts
export type AgentToolName =
  | 'read_project_brief'
  | 'read_chapter_outline'
  | 'read_scene'
  | 'search_story'
  | 'analyze_story_graph'
  | 'create_story_patch'
  | 'validate_story_patch'
```

Each registry entry contains a strict Zod input schema and an async executor. `create_story_patch` parses patch data but never writes. `validate_story_patch` calls the shared domain package.

- [ ] **Step 5: Implement the persisted health route**

Add owner-only `GET /api/projects/:projectId/health`. Load persisted nodes and edges, convert them to the shared graph shape, and return `analyzeStoryGraph(graph)`. Route tests must cover 200 for the owner, 403 for another user, and deterministic issue codes.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter server test -- context.test.ts tools.test.ts health.test.ts`

Expected: all context, tool, and health-route tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/agent apps/server/src/routes/health.ts apps/server/src/routes/health.test.ts apps/server/src/app.ts
git commit -m "feat: add bounded creative agent tools"
```

### Task 8: Implement The Structured Single-Agent Executor

**Files:**
- Modify: `apps/server/src/llm/providers.ts`
- Create: `apps/server/src/agent/protocol.ts`
- Create: `apps/server/src/agent/protocol.test.ts`
- Create: `apps/server/src/agent/executor.ts`
- Create: `apps/server/src/agent/executor.test.ts`
- Create: `apps/server/src/agent/queue.ts`

- [ ] **Step 1: Write failing protocol and limit tests**

Use fake model responses for one tool call followed by a final answer:

```ts
const responses = [
  JSON.stringify({ type: 'tool_call', tool: 'analyze_story_graph', input: {} }),
  JSON.stringify({ type: 'final', summary: '补充分支', plan: ['检查结构', '生成补丁'], patch: { operations: [] } }),
]
```

Assert that the tool runs once, the final patch validates, and a model that emits nine tool calls fails with code `step-limit-exceeded`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter server test -- protocol.test.ts executor.test.ts`

Expected: FAIL because protocol and executor do not exist.

- [ ] **Step 3: Add structured protocol parsing**

Define strict schemas for:

```ts
type AgentModelResponse =
  | { type: 'tool_call'; tool: AgentToolName; input: unknown }
  | { type: 'final'; summary: string; plan: string[]; patch?: StoryPatch; suggestions?: string[] }
```

Strip a single surrounding JSON code fence, parse once, and return a schema error containing field paths without echoing the raw provider response.

- [ ] **Step 4: Implement the bounded executor**

Inject `chat`, tool registry, and lifecycle callbacks. Loop for at most eight steps. Append tool results as assistant-visible messages, allow at most two final-patch repair prompts, and finish only with a validated patch or a read-only diagnosis.

Extend `LLMProvider.chat` with `AbortSignal` and create a 60-second `AbortController` in provider requests. Do not log message contents or API keys.

- [ ] **Step 5: Implement queue lifecycle and startup recovery**

The queue accepts `{ runId, secretConfig }`, executes one job at a time, and deletes the secret from memory in `finally`. On server startup, mark persisted `queued`, `planning`, `gathering_context`, `drafting`, and `validating` runs as failed with `server-restarted`.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter server test -- protocol.test.ts executor.test.ts`

Expected: all executor tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/agent apps/server/src/llm/providers.ts
git commit -m "feat: add bounded creative agent executor"
```

### Task 9: Add Transactional Patch Apply And Undo

**Files:**
- Create: `apps/server/src/story/patchService.ts`
- Create: `apps/server/src/story/patchService.test.ts`

- [ ] **Step 1: Write failing transaction tests**

Cover these cases with a temporary SQLite database:

- applying a valid patch increments chapter version and stores a snapshot;
- applying against an old base version returns a conflict without writes;
- a forced edge insert failure rolls back nodes, edges, patch status, and version;
- undo restores byte-equivalent serialized nodes and edges;
- undo refuses when the chapter version changed after Agent apply.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter server test -- patchService.test.ts`

Expected: FAIL because the patch service does not exist.

- [ ] **Step 3: Implement apply in one Prisma transaction**

Export:

```ts
export async function applyPersistedStoryPatch(input: {
  patchId: string
  userId: string
}): Promise<{ chapterId: string; version: number; graph: StoryGraph }>
```

Load patch, chapter, project owner, nodes, and edges. Validate ownership, status, and base version. Apply the shared pure function with `crypto.randomUUID`, store the pre-apply snapshot, replace graph records, increment version, and mark patch `applied`.

- [ ] **Step 4: Implement guarded undo**

Export:

```ts
export async function undoPersistedStoryPatch(input: {
  patchId: string
  userId: string
}): Promise<{ chapterId: string; version: number; graph: StoryGraph }>
```

Require patch status `applied` and chapter version equal to `appliedVersion`. Restore the snapshot in one transaction, increment version again, and mark patch `undone`.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter server test -- patchService.test.ts`

Expected: all transaction tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/story
git commit -m "feat: apply and undo agent patches transactionally"
```

### Task 10: Add Agent Run API

**Files:**
- Create: `apps/server/src/agent/runService.ts`
- Create: `apps/server/src/routes/agent.ts`
- Create: `apps/server/src/routes/agent.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write failing route lifecycle tests**

Test owner-only conversation creation, `202` run creation, polling, cancellation before approval, rejection, application, and undo. Assert every response omits `apiKey` and provider Authorization data.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter server test -- agent.test.ts`

Expected: FAIL because `/api/agent` routes do not exist.

- [ ] **Step 3: Implement run persistence and transitions**

Use this transition table:

```ts
const ALLOWED_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ['planning', 'cancelled', 'failed'],
  planning: ['gathering_context', 'cancelled', 'failed'],
  gathering_context: ['drafting', 'cancelled', 'failed'],
  drafting: ['validating', 'cancelled', 'failed'],
  validating: ['awaiting_approval', 'failed'],
  awaiting_approval: ['applying', 'cancelled', 'failed'],
  applying: ['completed', 'failed'],
  completed: [], failed: [], cancelled: [],
}
```

Persist plan, timeline, sources, validation, error code, and patch ID as JSON strings. A transition outside the table throws a typed conflict error.

- [ ] **Step 4: Implement routes and enqueue runs**

Create strict schemas for scope (`card`, `scene`, `chapter`, `project`), target IDs, prompt length 1-4000, and provider config. Return sanitized DTOs. `POST /runs/:runId/apply` calls the patch service only from `awaiting_approval`; `undo` only works for completed applied runs.

Validate custom provider URLs with `new URL()`. Accept only `http:` and `https:`. When `NODE_ENV=production`, reject loopback, link-local, and RFC1918 IPv4 hosts before the provider is constructed. Add route tests for `127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, and a valid public HTTPS URL.

- [ ] **Step 5: Mount routes and recovery**

Mount story-bible routes before `projects/:id`, mount Agent routes at `/api/agent`, and run queue recovery before listening.

- [ ] **Step 6: Run route tests and build**

Run: `pnpm --filter server test -- agent.test.ts && pnpm --filter server build`

Expected: route tests pass and server builds.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src
git commit -m "feat: expose creative agent run lifecycle"
```

### Task 11: Add Frontend Agent API And State Hook

**Files:**
- Create: `apps/web/src/agent/agentTypes.ts`
- Create: `apps/web/src/agent/useAgentRun.ts`
- Create: `apps/web/src/agent/useAgentRun.test.tsx`
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1: Write failing hook tests**

With fake timers and mocked API functions, verify polling stops at `awaiting_approval`, cancel stops polling, apply replaces the editor graph and version, and undo restores the returned graph.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter dreamchord-web test -- useAgentRun.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Add typed API functions**

Add functions for story bible, conversations, runs, cancel, reject, retry, apply, and undo. Define run DTO fields explicitly; do not use `Record<string, unknown>` for the patch lifecycle response.

- [ ] **Step 4: Implement the hook**

Expose:

```ts
export interface UseAgentRunResult {
  run: AgentRunDto | null
  isSubmitting: boolean
  error: string
  start: (input: StartAgentRunInput) => Promise<void>
  cancel: () => Promise<void>
  reject: () => Promise<void>
  retry: () => Promise<void>
  apply: () => Promise<AppliedPatchDto>
  undo: () => Promise<AppliedPatchDto>
  reset: () => void
}
```

Poll every 1.5 seconds only for active states. Clear timers on unmount and route change.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter dreamchord-web test -- useAgentRun.test.tsx`

Expected: hook tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/agent apps/web/src/api/client.ts
git commit -m "feat: add creative agent client state"
```

### Task 12: Build The Editor Agent Experience

**Files:**
- Create: `apps/web/src/agent/AgentComposer.tsx`
- Create: `apps/web/src/agent/AgentTimeline.tsx`
- Create: `apps/web/src/agent/PatchPreview.tsx`
- Create: `apps/web/src/agent/AgentApprovalBar.tsx`
- Create: `apps/web/src/agent/AgentPanel.tsx`
- Create: `apps/web/src/agent/AgentPanel.test.tsx`
- Modify: `apps/web/src/editor/FlowEditor.tsx`

- [ ] **Step 1: Write failing UI-state tests**

Render `AgentPanel` in these states and assert commands:

- idle: prompt, scope, shortcuts, and Run are visible;
- active: progress and Cancel are visible, Apply is absent;
- awaiting approval: diff, Apply, Reject, and Regenerate are visible;
- completed: summary and Undo are visible;
- no provider: deterministic Health Check remains enabled and AI tasks explain that configuration is required.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter dreamchord-web test -- AgentPanel.test.tsx`

Expected: FAIL because Agent components do not exist.

- [ ] **Step 3: Implement the compact editor panel**

Use a fixed 320px right rail matching the existing editor. The composer uses a segmented scope control, textarea, and icon buttons for shortcuts. Timeline rows show `pending`, `active`, `completed`, or `failed`; do not expose hidden chain-of-thought, only user-facing plan and tool names.

- [ ] **Step 4: Implement patch preview and graph replacement**

Render stable lists from `StoryPatchDiff`. Clicking a node calls `onSelectNode(nodeId)`. On apply or undo, map the returned shared graph into React Flow nodes and edges, update Zustand, set chapter version, and show a toast.

- [ ] **Step 5: Replace AIAssistantPanel in FlowEditor**

Rename the toolbar command from `AI助手` to `创作 Agent`. Pass project ID, chapter ID, chapter version, selected card/node IDs, current graph, and navigation callbacks. Preserve `ShotCardEditor.onRequestAI` by mapping modes to shortcut prompts.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --filter dreamchord-web test -- AgentPanel.test.tsx && pnpm --filter dreamchord-web build`

Expected: component tests pass and web build exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/agent apps/web/src/editor/FlowEditor.tsx
git commit -m "feat: add editor creative agent panel"
```

### Task 13: Unify The Full-Screen Agent And Remove Fake AI

**Files:**
- Modify: `apps/web/src/pages/AIWriterPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/HomePage.tsx`
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Delete: `apps/web/src/editor/AIAssistantPanel.tsx`
- Modify: `apps/server/src/routes/ai.ts`

- [ ] **Step 1: Add a full-screen Agent smoke test**

Render `/agent` with projects loaded and assert the user must select a project and chapter before running a structural task. Assert navigation labels say `创作 Agent` and no text claims local drafts are AI-generated.

- [ ] **Step 2: Replace the independent writer implementation**

Rebuild `AIWriterPage` as a full-width shell around the same Agent composer, timeline, patch preview, and approval components. Persist the selected project and conversation ID in URL search parameters.

- [ ] **Step 3: Update routes and navigation**

Use protected route `/agent`; redirect `/ai-writer` to `/agent` for compatibility. Update Home and Library commands and product copy to describe plan, validation, preview, and undo.

- [ ] **Step 4: Remove misleading fallbacks and duplicate UI**

Delete `AIAssistantPanel.tsx` and all `runLocalAssistant` fixed responses. Keep old server endpoints during the compatibility period, but change their system prompts to shared prompt helpers and add strict input validation. Mark them deprecated in comments and docs.

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter dreamchord-web test && pnpm build`

Expected: all web tests pass and the monorepo builds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/server/src/routes/ai.ts
git commit -m "refactor: unify ai writing into creative agent"
```

### Task 14: Split WorkbenchPanel Along Existing Tabs

**Files:**
- Create: `apps/web/src/editor/workbench/StoryEditor.tsx`
- Create: `apps/web/src/editor/workbench/CharacterOverview.tsx`
- Create: `apps/web/src/editor/workbench/SceneOverview.tsx`
- Create: `apps/web/src/editor/workbench/workbenchTypes.ts`
- Modify: `apps/web/src/editor/WorkbenchPanel.tsx`

- [ ] **Step 1: Capture behavior with focused tests**

Test that each tab renders, story insertion updates nodes and edges, deleting a choice renumbers `choice-N` handles, and opening templates still creates two connected branches.

- [ ] **Step 2: Move tab-specific code without changing behavior**

Keep `WorkbenchPanel` responsible only for tab state and shell:

```tsx
export default function WorkbenchPanel({ onSave }: WorkbenchPanelProps) {
  const [tab, setTab] = useState<WorkbenchTab>('story')
  return (
    <div className="flex h-full flex-col bg-dream-50/30">
      <WorkbenchTabs value={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto">
        {tab === 'story' && <StoryEditor onSave={onSave} />}
        {tab === 'characters' && <CharacterOverview />}
        {tab === 'scenes' && <SceneOverview />}
      </div>
    </div>
  )
}
```

Move helpers with the tab that owns them. Reuse `sceneGraph.ts` exports instead of copying graph logic. Keep each new component below 700 lines; if StoryEditor remains larger, split `SceneComposer` and `BranchEditor` into their own files in the same folder.

- [ ] **Step 3: Run targeted and full web tests**

Run: `pnpm --filter dreamchord-web test && pnpm --filter dreamchord-web build`

Expected: tests pass, build exits 0, and `WorkbenchPanel.tsx` is below 180 lines.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/editor/WorkbenchPanel.tsx apps/web/src/editor/workbench
git commit -m "refactor: split workbench tab modules"
```

### Task 15: End-To-End Verification, Documentation, And Visual QA

**Files:**
- Create: `apps/server/src/agent/agent.e2e.test.ts`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/AI_HANDOFF.md`

- [ ] **Step 1: Add the controlled-model end-to-end test**

Seed a project with two chapters and use a fake provider that requests `read_chapter_outline`, requests `analyze_story_graph`, then returns a branch patch. Verify run polling reaches `awaiting_approval`, apply changes only chapter two, runtime conversion succeeds, and undo restores the original graph.

- [ ] **Step 2: Run complete automated verification**

Run: `pnpm test`

Expected: domain, server, and web test suites all pass.

Run: `pnpm build`

Expected: all workspace builds pass with no TypeScript errors.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 3: Start the application and perform browser QA**

Run: `pnpm dev`

Expected: web app is available on `http://localhost:5173` and API health returns 200 on `http://localhost:3001/api/health`.

Verify desktop 1440x900 and mobile 390x844 with browser automation:

- editor controls do not overlap;
- Agent rail remains usable without resizing the center editor unexpectedly;
- full-screen Agent is readable and project selection is reachable;
- story-bible fields fit and save;
- diff rows navigate to the correct card;
- Apply and Undo visibly update the graph;
- no-provider state never presents fixed prose as model output.

- [ ] **Step 4: Update documentation**

Document Agent architecture, story-bible fields, API-key handling, run limits, compatibility endpoints, tests, and the main user workflow. Correct outdated file-size claims in `CLAUDE.md`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/agent/agent.e2e.test.ts README.md CLAUDE.md docs/AI_HANDOFF.md
git commit -m "docs: document and verify creative agent workflow"
```

- [ ] **Step 6: Final repository check**

Run: `git status --short`

Expected: no uncommitted files from this implementation.
