# Global Assets And Resilient Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent runs recover from malformed tool inputs, support project-only conversations and a no-key local mode, and make uploaded assets user-owned and reusable across every story.

**Architecture:** Keep story mutations chapter-bound, while allowing project-scoped conversations to use read-only project tools. Move asset authorization to an explicit owner relation with an optional origin project, and preserve referenced global files in project backups. Route no-key requests through a deterministic local assistant that produces normal completed conversations without pretending to be a generative model.

**Tech Stack:** React 18, TypeScript, Express, Prisma 5/SQLite, Zod, Vitest, Testing Library, Sharp.

---

### Task 1: Recover Invalid Agent Tool Inputs

**Files:**
- Modify: `apps/server/src/agent/executor.ts`
- Modify: `apps/server/src/agent/executor.test.ts`
- Modify: `apps/server/src/agent/tools.ts`

- [ ] Add executor tests where `inspect_asset` receives `{ ids: ['asset'] }`, where multiple IDs trigger a repair request, and where a corrected second tool call completes the run.
- [ ] Run `pnpm --filter dreamchord-server test -- executor.test.ts` and confirm the new cases fail because tool parsing currently throws.
- [ ] Add `tool_input_repair` to `AgentExecutionEvent`, normalize a single `ids` alias for single-asset tools, catch Zod/tool-input parse failures, append a concise corrective user message, and allow two input repairs without consuming tool steps.
- [ ] Extend the system prompt with explicit single-asset tool schemas and keep raw Zod issue arrays out of persisted errors.
- [ ] Run the focused executor and tool tests and commit `fix: recover malformed agent tool inputs`.

### Task 2: Add Project-Only Agent Runs

**Files:**
- Modify: `apps/server/src/agent/tools.ts`
- Modify: `apps/server/src/agent/tools.test.ts`
- Modify: `apps/server/src/agent/runService.ts`
- Modify: `apps/server/src/agent/runService.test.ts`
- Modify: `apps/server/src/routes/agent.ts`

- [ ] Add tests that create a `project` run without `chapterId`, read project/assets/memory context, finish without a patch, and reject a chapter patch with the message `请选择章节后再修改剧情`.
- [ ] Run the focused server tests and confirm failure at the current `!run.chapterId` guard.
- [ ] Make `createAgentToolRegistry.chapterId` optional; project/read-only tools operate without it, while scene/graph/patch tools return a bounded chapter-required error.
- [ ] Build initial context with `scope: 'project'` when no chapter is selected and only require a chapter when validating or persisting a story patch.
- [ ] Validate that non-project scopes still require `chapterId` at the HTTP boundary, run focused tests, and commit `feat: support project scoped agent conversations`.

### Task 3: Add No-Key Local Assistant Mode

**Files:**
- Create: `apps/server/src/agent/localAssistant.ts`
- Create: `apps/server/src/agent/localAssistant.test.ts`
- Modify: `apps/server/src/agent/runService.ts`
- Modify: `apps/server/src/routes/agent.ts`
- Modify: `apps/web/src/agent/AgentPanel.tsx`
- Modify: `apps/web/src/agent/AgentComposer.tsx`
- Modify: `apps/web/src/agent/AgentPanel.test.tsx`
- Modify: `apps/web/src/agent/agentTypes.ts`

- [ ] Add local assistant tests for project summary, asset inventory, character inventory, chapter health, and a writing request that explains model configuration is required without returning a patch.
- [ ] Add frontend tests asserting `运行本地助手` remains enabled without a provider and model-only shortcuts display a settings action instead of a failed task.
- [ ] Run focused tests and confirm they fail under the current provider gate.
- [ ] Implement deterministic intent routing from snapshot/chapter data and return a normal `AgentExecutionResult` with no patch.
- [ ] Allow provider config `{ provider: 'local', model: 'dreamchord-local', apiKey: '' }`; bypass external provider construction for local jobs and persist normal assistant messages.
- [ ] Make AgentPanel fall back to local config, update composer labels/capability notice, run focused tests, and commit `feat: add local agent mode without api key`.

### Task 4: Make Chapter Selection Optional In The Agent UI

**Files:**
- Modify: `apps/web/src/pages/AIWriterPage.tsx`
- Modify: `apps/web/src/pages/AIWriterPage.test.tsx`
- Modify: `apps/web/src/agent/AgentWorkspace.tsx`
- Modify: `apps/web/src/agent/AgentWorkspace.test.tsx`
- Modify: `apps/web/src/agent/AgentPanel.tsx`
- Modify: `apps/web/src/agent/AgentComposer.tsx`
- Modify: `apps/web/src/agent/AgentContextPanel.tsx`

- [ ] Add UI tests for the `不绑定章节（项目对话）` option, project-scoped new conversations with null chapter, and disabled card/scene/chapter scopes when no chapter is selected.
- [ ] Run focused web tests and confirm the current mandatory chapter rendering fails.
- [ ] Make chapter props nullable, use an empty graph and project context when unbound, create conversations with `scope: 'project'`, and update URL search params without a chapter key.
- [ ] Present chapter binding as optional context rather than a prerequisite, run focused tests, and commit `feat: allow agent conversations without a chapter`.

### Task 5: Migrate Assets To User Ownership

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/<timestamp>_global_asset_library/migration.sql`
- Modify: `apps/server/src/routes/assets.ts`
- Modify: `apps/server/src/routes/assets.test.ts`
- Modify: `apps/server/src/assets/assetService.ts`
- Modify: `apps/server/src/assets/assetService.test.ts`

- [ ] Add route/service tests for listing all owner assets, uploading without `projectId`, cross-project visibility, optional sprite binding project, and source-project deletion not deleting the asset.
- [ ] Run focused tests and confirm the current required project relation fails.
- [ ] Add required `ownerId`, optional `projectId`, `onDelete: SetNull`, owner/project indexes, and a migration that backfills owner from the source project before enforcing the foreign key.
- [ ] Authorize inspect/process/replace/delete through `ownerId`; store uploads under `library/<userId>`; copy owner/source fields to accepted derivatives; bind sprites only when a target project is provided and owned.
- [ ] Expose owner-library GET/upload routes while keeping the old project route as a compatibility alias returning the same owner library.
- [ ] Generate Prisma Client, run focused tests, and commit `feat: add user owned global asset library`.

### Task 6: Complete Global Asset UI And Backup Safety

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Modify: `apps/web/src/pages/HomePage.test.tsx` or create `apps/web/src/pages/LibraryPage.test.tsx`
- Modify: `apps/web/src/editor/AssetPanel.tsx`
- Modify: `apps/web/src/assets/AssetProcessingSheet.tsx`
- Modify: `apps/web/src/assets/AssetProcessingSheet.test.tsx`
- Modify: `apps/server/src/project/projectTransfer.ts`
- Modify: `apps/server/src/project/projectTransfer.test.ts`

- [ ] Add frontend tests proving the upload library has no project selector, can rename/delete/process global assets, and passes the current editor project only when binding a sprite.
- [ ] Add backup tests where a project references a global background originating elsewhere and verify its bytes are embedded.
- [ ] Run focused tests and confirm failure with project-scoped APIs and export queries.
- [ ] Add `getAssetLibrary()` and projectless `uploadAsset()`; simplify the library copy and controls; make editor panels read the same owner library.
- [ ] Pass optional `projectId` through asset acceptance, use `接受到素材库` outside an editor, and retain `接受并绑定` inside a story.
- [ ] Export the union of origin assets and owner assets whose URLs are referenced by project cover, nodes, character defaults or sprites; run focused tests and commit `feat: reuse global assets across stories`.

### Task 7: Browser QA, Documentation, And Release

**Files:**
- Modify: `README.md`
- Modify: `docs/showcase.html` and screenshots only when current UI captures change materially.

- [ ] Update Chinese documentation for the global library, optional chapter context, local mode, external model mode, and friendly failure recovery.
- [ ] Use a real browser to reproduce the former `{ ids }` failure path, run no-key local chat, switch between project-only and chapter-bound conversations, upload once and use the asset in two projects, then verify guarded rename/delete.
- [ ] Check desktop and 390px layouts, console errors and failed network requests.
- [ ] Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:readiness`, and `git diff --check`.
- [ ] Inspect Git status for secrets/generated data, commit QA/docs changes, push `main`, restart with the one-click launcher, and verify health URLs.

