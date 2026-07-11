# DreamChord Agent Workspace Product Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver DreamChord 0.2 as a reliable local-first visual-novel editor with multi-conversation Agent workflows, visible layered memory, safe tools, usable image preparation, complete editor recovery flows, reproducible startup, and verified GitHub delivery.

**Architecture:** Extend the existing bounded Agent instead of replacing it. Add focused server services for conversation, memory, context budgeting, asset processing, and export/import; expose strict authenticated routes; then build a full Agent workspace and connect the same APIs to the compact editor rail. Keep story and asset writes artifact-based and explicitly approved.

**Tech Stack:** TypeScript, React 18, Zustand, Express, Prisma 5.14, SQLite, Zod, Sharp, Vitest, Testing Library, Playwright/agent-browser, PowerShell, GitHub Actions.

---

## File Structure

New focused server units:

- `apps/server/src/agent/conversationService.ts`: conversation CRUD, transcript pagination, rolling summary inputs.
- `apps/server/src/agent/memoryService.ts`: durable memory CRUD, ranking, promotion, and retrieval.
- `apps/server/src/agent/contextBudget.ts`: deterministic source ranking and character budget selection.
- `apps/server/src/assets/imageInspector.ts`: decoded image validation and metadata.
- `apps/server/src/assets/imageProcessor.ts`: deterministic sprite/background/CG derivatives.
- `apps/server/src/assets/assetService.ts`: artifact lifecycle and character/expression binding.
- `apps/server/src/project/projectTransfer.ts`: versioned JSON export/import.
- `apps/server/src/routes/memories.ts`: memory HTTP API.
- `apps/server/src/routes/projectTransfer.ts`: export/import HTTP API.

New focused web units:

- `apps/web/src/agent/AgentWorkspace.tsx`: three-pane Agent layout.
- `apps/web/src/agent/ConversationSidebar.tsx`: conversation CRUD/search.
- `apps/web/src/agent/ConversationTranscript.tsx`: messages, tool events, and artifacts.
- `apps/web/src/agent/MemoryCenter.tsx`: visible durable memory controls.
- `apps/web/src/agent/AgentContextPanel.tsx`: scope, sources, tool trace, and artifact inspector.
- `apps/web/src/editor/editorHistory.ts`: bounded graph history reducer.
- `apps/web/src/editor/saveCoordinator.ts`: serialized autosave state machine.
- `apps/web/src/editor/ManuscriptImportPreview.tsx`: parse review and one-transaction commit.
- `apps/web/src/editor/ProjectAssetPicker.tsx`: server-backed background/character selection.
- `apps/web/src/assets/AssetProcessingSheet.tsx`: original/derivative comparison and confirmation.

Existing files are modified only at their ownership boundaries: Prisma schema and migrations, Agent runtime/routes/client, editor store/shell, asset routes/library, startup scripts, package manifests, docs, showcase, and CI.

### Task 1: Repair the Engineering Baseline

**Files:**
- Create: `eslint.config.mjs`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `apps/server/package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/server/src/story/patchService.test.ts`
- Modify: `apps/server/src/agent/agent.e2e.test.ts`

- [ ] **Step 1: Make test databases unique and self-cleaning**

Replace fixed paths with a helper such as:

```ts
const databasePath = path.resolve('prisma', `.test-${path.basename(import.meta.url)}-${process.pid}-${crypto.randomUUID()}.db`)
```

Register disconnect and removal in `afterAll`, and verify migration commands use the exact absolute datasource URL.

- [ ] **Step 2: Run the two integration suites and confirm they pass independently and together**

Run: `pnpm --filter dreamchord-server test -- src/story/patchService.test.ts src/agent/agent.e2e.test.ts`
Expected: 2 files passed, 4 tests passed.

- [ ] **Step 3: Add ESLint 9 flat configuration and dependencies**

Use TypeScript ESLint recommended type-checked rules, React Hooks rules, browser globals for web files, and Node globals for server/config files. Keep generated/build/upload paths ignored.

- [ ] **Step 4: Add Node 20 CI**

Workflow steps: checkout, pnpm setup at 9.1.0, Node 20 with pnpm cache, frozen install, Prisma generate, lint, test, build.

- [ ] **Step 5: Verify and commit**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: all commands exit 0.

Commit: `chore: restore reproducible quality checks`

### Task 2: Make One-Click Startup Portable and Non-Destructive

**Files:**
- Create: `scripts/doctor.ps1`
- Modify: `start-dreamchord.ps1`
- Modify: `start-dreamchord.bat`
- Modify: `README.md`
- Test: `scripts/doctor.ps1`

- [ ] **Step 1: Add a non-interactive doctor mode**

The doctor returns non-zero for Node below 20, missing workspace files, invalid environment configuration, or unavailable package manager. It prints machine-readable `[PASS]`, `[WARN]`, and `[FAIL]` lines.

- [ ] **Step 2: Verify the current launcher fails the safety assertions**

Run static assertions that reject `Stop-Process`, accept only Node 20+, require root `pnpm install --frozen-lockfile`, and require `prisma migrate deploy`.
Expected: assertions fail before launcher changes.

- [ ] **Step 3: Rewrite launcher orchestration**

Choose unused ports without killing owners, enable pnpm with Corepack, install at root, create `.env` only when absent, generate Prisma, deploy migrations, query whether seed data is needed, start hidden child processes, wait for health, then open the resolved URL.

- [ ] **Step 4: Simulate a fresh checkout**

Copy tracked files to a temporary directory excluding `.git`, `node_modules`, `.env`, databases, uploads, and build output. Run doctor and the non-interactive setup path. Confirm dependencies, environment, migration, and seed complete without using files outside the copy.

- [ ] **Step 5: Commit**

Commit: `fix: make one-click startup portable and non-destructive`

### Task 3: Add Conversation CRUD and Transcript APIs

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/20260712010000_expand_agent_conversations/migration.sql`
- Create: `apps/server/src/agent/conversationService.ts`
- Create: `apps/server/src/agent/conversationService.test.ts`
- Modify: `apps/server/src/routes/agent.ts`
- Modify: `apps/server/src/routes/agent.test.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/agent/agentTypes.ts`

- [ ] **Step 1: Write failing service tests**

Cover paginated chronological messages, rename trimming, pin toggle, owner isolation, deletion, and deletion preserving already-applied chapter state.

- [ ] **Step 2: Add conversation fields and service**

Add `chapterId`, `isPinned`, `summary`, and `summaryThroughMessageId`. Define:

```ts
interface ConversationService {
  list(projectId: string, userId: string, query?: string): Promise<ConversationDto[]>
  get(id: string, userId: string): Promise<ConversationDetailDto>
  update(id: string, userId: string, patch: { title?: string; isPinned?: boolean; scope?: AgentScope; chapterId?: string | null }): Promise<ConversationDto>
  remove(id: string, userId: string): Promise<void>
  messages(id: string, userId: string, cursor?: string, limit?: number): Promise<MessagePageDto>
}
```

- [ ] **Step 3: Add strict HTTP endpoints**

Add `GET/PATCH/DELETE /api/agent/conversations/:id` and `GET /api/agent/conversations/:id/messages`, with Zod query/body parsing and owner checks.

- [ ] **Step 4: Add typed client calls and verify**

Run: `pnpm --filter dreamchord-server test -- src/agent/conversationService.test.ts src/routes/agent.test.ts`
Expected: all conversation tests pass.

- [ ] **Step 5: Commit**

Commit: `feat: add complete agent conversation lifecycle`

### Task 4: Build the Full Agent Workspace

**Files:**
- Create: `apps/web/src/agent/AgentWorkspace.tsx`
- Create: `apps/web/src/agent/ConversationSidebar.tsx`
- Create: `apps/web/src/agent/ConversationTranscript.tsx`
- Create: `apps/web/src/agent/AgentContextPanel.tsx`
- Create: `apps/web/src/agent/AgentWorkspace.test.tsx`
- Modify: `apps/web/src/pages/AIWriterPage.tsx`
- Modify: `apps/web/src/agent/AgentPanel.tsx`

- [ ] **Step 1: Write failing interaction tests**

Test create, select, search, rename, pin, delete with confirmation, message pagination, project/chapter switching, active run persistence, and editor-to-fullscreen deep link.

- [ ] **Step 2: Implement the stable three-pane layout**

Use a 260px conversation sidebar, flexible transcript, and 320px inspector on large screens. Collapse sidebar and inspector into accessible drawers/tabs below 1024px. Keep composer height stable and ensure long titles wrap or truncate without changing controls.

- [ ] **Step 3: Render real transcript artifacts**

Render message text, assistant run status, collapsed tool events, source citations, patch preview, asset artifact preview, retry/apply/reject controls, and errors. Never render hidden reasoning.

- [ ] **Step 4: Connect compact editor rail**

The rail shows the current conversation's recent messages and run; an icon button opens `/agent?...&conversation=...`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter dreamchord-web test -- src/agent/AgentWorkspace.test.tsx src/agent/AgentPanel.test.tsx src/pages/AIWriterPage.test.tsx`
Expected: all workspace tests pass.

Commit: `feat: add multi-conversation agent workspace`

### Task 5: Add Durable Layered Memory

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/20260712020000_add_agent_memory/migration.sql`
- Create: `apps/server/src/agent/memoryService.ts`
- Create: `apps/server/src/agent/memoryService.test.ts`
- Create: `apps/server/src/agent/contextBudget.ts`
- Create: `apps/server/src/agent/contextBudget.test.ts`
- Create: `apps/server/src/routes/memories.ts`
- Create: `apps/server/src/routes/memories.test.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Write failing ranking and ownership tests**

Use records that prove Story Bible/pinned facts outrank recent low-importance notes, superseded/forgotten facts are excluded, conversation memory does not leak across conversations, and another user cannot read or mutate memory.

- [ ] **Step 2: Add `AgentMemory` and service**

Kinds: `canon`, `character`, `preference`, `plot`, `decision`, `artifact`. Statuses: `suggested`, `active`, `forgotten`. Store JSON tags, importance 0-100, source type/ID, optional conversation, optional superseded record.

- [ ] **Step 3: Implement deterministic retrieval**

Normalize Chinese/Latin tokens, score scope match, token overlap, pinned state, importance, authority, and recency. Return score explanations and enforce a character budget with deterministic ordering.

- [ ] **Step 4: Add strict memory APIs**

List/search/create-suggestion/confirm/edit/pin/forget. All mutations check project ownership and write provenance.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter dreamchord-server test -- src/agent/memoryService.test.ts src/agent/contextBudget.test.ts src/routes/memories.test.ts`
Expected: all tests pass.

Commit: `feat: add visible layered agent memory`

### Task 6: Integrate Conversation and Memory into Agent Runs

**Files:**
- Modify: `apps/server/src/agent/context.ts`
- Modify: `apps/server/src/agent/executor.ts`
- Modify: `apps/server/src/agent/protocol.ts`
- Modify: `apps/server/src/agent/tools.ts`
- Modify: `apps/server/src/agent/runService.ts`
- Modify: related tests in `apps/server/src/agent/`

- [ ] **Step 1: Write a failing continuation test**

Create two conversations with contradictory character directions. Assert the next run receives only its own recent turns and summary, plus relevant project memory, and records exact source IDs.

- [ ] **Step 2: Extend the final protocol**

Add typed `memorySuggestions` and artifact references while preserving existing patch responses. Invalid memory kinds or oversized content fail parsing without affecting accepted assistant text.

- [ ] **Step 3: Build bounded run context**

Load recent transcript, conversation summary, Story Bible, selected graph context, and ranked memory. Apply the fixed priority order and persist source explanations.

- [ ] **Step 4: Add memory and asset read tools**

Register `read_conversation_context`, `search_memories`, `list_project_assets`, `inspect_asset`, and `read_character_profile`. Keep eight total tool steps and the current format-repair limit.

- [ ] **Step 5: Promote accepted artifacts**

On patch apply, create an artifact memory with patch/chapter provenance. Store model suggestions as `suggested`; never auto-promote guessed canon.

- [ ] **Step 6: Verify and commit**

Run all server Agent tests.
Expected: prior Agent behavior plus conversation continuity and memory isolation pass.

Commit: `feat: make agent runs contextually continuous`

### Task 7: Build the Memory Center UI

**Files:**
- Create: `apps/web/src/agent/MemoryCenter.tsx`
- Create: `apps/web/src/agent/MemoryCenter.test.tsx`
- Modify: `apps/web/src/agent/AgentWorkspace.tsx`
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1: Write failing user-control tests**

Test grouping, search, source display, suggestion confirmation, pin, inline edit, forget confirmation, and forgotten-item removal.

- [ ] **Step 2: Implement accessible memory controls**

Use tabs for groups, a search input, pin/edit/trash icon buttons with tooltips, a source link, and a status badge. Do not put nested cards inside cards.

- [ ] **Step 3: Show context usage**

The Agent inspector links each source entry to the matching Memory Center record and displays why it was selected.

- [ ] **Step 4: Verify and commit**

Commit: `feat: add user-controlled agent memory center`

### Task 8: Add Editor History and Serialized Save Coordination

**Files:**
- Create: `apps/web/src/editor/editorHistory.ts`
- Create: `apps/web/src/editor/editorHistory.test.ts`
- Create: `apps/web/src/editor/saveCoordinator.ts`
- Create: `apps/web/src/editor/saveCoordinator.test.ts`
- Modify: `apps/web/src/stores/editorStore.ts`
- Modify: `apps/web/src/editor/FlowEditor.tsx`

- [ ] **Step 1: Write failing state-machine tests**

Cover bounded undo/redo, redo invalidation, one history transaction for compound graph edits, serialized saves, exactly one follow-up save, dirty navigation warning, success, error, and version conflict.

- [ ] **Step 2: Implement graph history**

Store snapshots `{nodes, edges}` with a 50-entry limit. Exclude selection and server hydration. Expose `commitGraph`, `undo`, `redo`, `canUndo`, and `canRedo`.

- [ ] **Step 3: Implement save coordinator**

State is `clean | dirty | saving | saved | conflict | error`. The coordinator accepts a `readLatest()` callback so follow-up saves cannot use stale closures.

- [ ] **Step 4: Add toolbar icons and shortcuts**

Use `Undo2` and `Redo2` icon buttons with tooltips. Add platform-aware keyboard handlers and avoid intercepting native undo inside text inputs unless the graph transaction explicitly owns the edit.

- [ ] **Step 5: Verify and commit**

Commit: `feat: add reliable editor history and autosave`

### Task 9: Unify Project Assets with Editor Fields

**Files:**
- Create: `apps/web/src/editor/ProjectAssetPicker.tsx`
- Create: `apps/web/src/editor/ProjectAssetPicker.test.tsx`
- Modify: `apps/web/src/editor/CardEditor.tsx`
- Modify: `apps/web/src/editor/ShotCardEditor.tsx`
- Modify: `apps/web/src/editor/FlowEditor.tsx`
- Modify: `apps/web/src/editor/AssetPanel.tsx`
- Modify: `apps/server/src/routes/assets.ts`
- Modify: `apps/server/src/routes/assets.test.ts`

- [ ] **Step 1: Write failing picker and authorization tests**

Prove the field that opens the picker becomes the target, selecting a background updates `backgroundId`, selecting a sprite stores character/expression IDs, and authenticated non-owners cannot list private assets.

- [ ] **Step 2: Harden asset APIs**

Validate owner access on list/read, enumerate asset types, parse strict rename/update bodies, and reject mismatched project/asset relationships.

- [ ] **Step 3: Connect the picker**

Replace the unused `assetTarget` path with explicit callbacks from background and character fields. Keep built-in templates visible but copy/register them before project use.

- [ ] **Step 4: Add local library migration**

On first library open, offer a one-time non-destructive import of browser-local custom entries into the selected project. Record a migration marker only after success.

- [ ] **Step 5: Verify and commit**

Commit: `fix: connect project assets to story cards`

### Task 10: Add Manuscript Import Preview

**Files:**
- Modify: `apps/web/src/editor/manuscriptUtils.tsx`
- Create: `apps/web/src/editor/manuscriptParser.ts`
- Create: `apps/web/src/editor/manuscriptParser.test.ts`
- Create: `apps/web/src/editor/ManuscriptImportPreview.tsx`
- Modify: `apps/web/src/editor/ShotCardEditor.tsx`

- [ ] **Step 1: Write parser fixtures**

Cover chapter headings, scene separators, `角色：台词`, narration, thought/memory/system markers, long paragraph splitting, unknown speaker warnings, and empty input.

- [ ] **Step 2: Return a typed preview**

```ts
interface ManuscriptPreview {
  chapters: Array<{ title: string; scenes: Array<{ title: string; cards: ParsedCard[] }> }>
  warnings: Array<{ line: number; message: string }>
}
```

- [ ] **Step 3: Add review-before-commit UI**

Show counts, warnings, collapsible scene/card previews, and cancel/import commands. Commit as one editor history transaction so undo removes the import.

- [ ] **Step 4: Verify and commit**

Commit: `feat: preview structured manuscript imports`

### Task 11: Add Image Metadata and Safe Derivatives

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/assets/imageInspector.ts`
- Create: `apps/server/src/assets/imageInspector.test.ts`
- Create: `apps/server/src/assets/imageProcessor.ts`
- Create: `apps/server/src/assets/imageProcessor.test.ts`
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/20260712030000_add_asset_variants/migration.sql`

- [ ] **Step 1: Add Sharp and image fixtures**

Generate fixtures in tests: transparent PNG, white-background sprite, JPEG, malformed bytes, oversized dimensions, and animated GIF metadata.

- [ ] **Step 2: Write failing decode and processing tests**

Assert MIME is derived from decoded bytes, metadata is persisted, malformed/oversized files fail, originals remain, near-white removal creates alpha, transparent trimming works, and derivative canvas dimensions are stable.

- [ ] **Step 3: Implement inspector and processor**

Use Sharp with pixel limits. Output thumbnail, preview, sprite PNG, and optimized WebP variants under a server-owned project directory. Resolve every output path against the storage root before writing.

- [ ] **Step 4: Add asset metadata models**

Extend `Asset` and add `AssetVariant` with original relationship, dimensions, alpha, status, variant kind, and metadata.

- [ ] **Step 5: Verify and commit**

Commit: `feat: add safe local image preparation pipeline`

### Task 12: Add Asset Artifact APIs, Character Binding, and Agent Tools

**Files:**
- Create: `apps/server/src/assets/assetService.ts`
- Create: `apps/server/src/assets/assetService.test.ts`
- Modify: `apps/server/src/routes/assets.ts`
- Modify: `apps/server/src/agent/tools.ts`
- Modify: `apps/server/src/agent/tools.test.ts`
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Cover upload original, inspect, propose recipe, process, preview, accept as background/CG/sprite, bind new/existing character expression, reject derivatives, retry failure, and preserve original.

- [ ] **Step 2: Implement typed processing endpoints**

Use `POST /assets/:id/process`, `POST /assets/:id/accept`, and `POST /assets/:id/reject`. Recipe fields are enumerated and bounded; no client paths are accepted.

- [ ] **Step 3: Add bounded Agent tools**

`prepare_character_asset`, `prepare_cg_asset`, and `prepare_background_asset` create proposed artifacts only. They cannot accept the artifact or bind it without user approval.

- [ ] **Step 4: Verify and commit**

Commit: `feat: let agent prepare reviewable visual assets`

### Task 13: Build the Asset Processing UI

**Files:**
- Create: `apps/web/src/assets/AssetProcessingSheet.tsx`
- Create: `apps/web/src/assets/AssetProcessingSheet.test.tsx`
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Modify: `apps/web/src/editor/AssetPanel.tsx`
- Modify: `apps/web/src/agent/ConversationTranscript.tsx`

- [ ] **Step 1: Write failing workflow tests**

Test purpose selection, comparison preview, white threshold, feather, trim, dimensions, process retry, character/expression binding, accept, reject, and unsupported-complex-background message.

- [ ] **Step 2: Implement a feature-complete processing sheet**

Use segmented purpose controls, sliders for numeric processing, checkboxes for trim/fit, swatches for detected matte color, and icon buttons with tooltips. Show actual source and derivative images without decorative nesting.

- [ ] **Step 3: Embed the same artifact in Agent transcript**

An Agent-created asset proposal opens the processing sheet and cannot be accepted from an ambiguous generic button.

- [ ] **Step 4: Verify and commit**

Commit: `feat: add project asset processing studio`

### Task 14: Add Versioned Project Export and Import

**Files:**
- Create: `apps/server/src/project/projectTransfer.ts`
- Create: `apps/server/src/project/projectTransfer.test.ts`
- Create: `apps/server/src/routes/projectTransfer.ts`
- Create: `apps/server/src/routes/projectTransfer.test.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/pages/HomePage.tsx`

- [ ] **Step 1: Write failing schema and ownership tests**

Cover version 1 manifest export, Story Bible, chapters/graphs, characters/sprites, asset inventory, memories excluding forgotten records, invalid schema, duplicate IDs, missing references, and import creating a new project only.

- [ ] **Step 2: Implement strict transfer schema**

Validate with Zod, generate new database IDs while preserving internal graph IDs, and use a transaction. Exclude API keys, passwords, raw run secrets, uploads, and local absolute paths.

- [ ] **Step 3: Add export/import commands**

Export downloads `.dreamchord.json`. Import previews title, chapter/scene/asset counts and warnings before creating a new project.

- [ ] **Step 4: Verify and commit**

Commit: `feat: add safe project backup and restore`

### Task 15: Full Verification, Documentation, Showcase, and GitHub Delivery

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/AI_HANDOFF.md`
- Modify: `docs/index.html`
- Modify: `docs/showcase.html`
- Modify: root `index.html`
- Update: `docs/screenshots/*`

- [ ] **Step 1: Run complete automated verification**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: exit 0 with no skipped integration suites caused by environment setup.

- [ ] **Step 2: Run desktop and mobile browser workflows**

At 1440x900, 1024x768, 430x932, and 390x844 verify login, story editing, undo/redo, autosave, manuscript preview, conversations, memory, story patch apply/undo, asset processing/binding, preview, export/import, and reload persistence. Capture screenshots and inspect console/network errors.

- [ ] **Step 3: Run fresh-directory launcher verification**

Use the isolated copy procedure from Task 2. Confirm a user with only Node 20 can reach the app using the one-click launcher and documented demo credentials.

- [ ] **Step 4: Update documentation and showcase**

Document actual setup, degraded modes, supported image inputs, memory controls, tool safety, backup format, tests, and architecture. Replace stale screenshots and claims. Keep GitHub Pages as the showcase, not a misleading full-stack live app.

- [ ] **Step 5: Review Git state and push**

Confirm only intended tracked files changed, no secrets/databases/uploads/build outputs are staged, pull remote updates without force, integrate if needed, push `main`, and verify the remote commit and GitHub Actions result.

Commit: `docs: publish DreamChord 0.2 product workflow`

## Release Acceptance Checklist

- [ ] Separate conversations carry separate history and can be renamed/deleted.
- [ ] A later message demonstrably uses relevant prior conversation and visible project memory.
- [ ] Memory can be inspected, pinned, edited, confirmed, and forgotten.
- [ ] Agent tool calls are bounded, visible, and cannot perform arbitrary system operations.
- [ ] Story patches and asset artifacts require explicit acceptance.
- [ ] Editor asset selection updates the intended field and survives reload.
- [ ] Undo/redo, serialized autosave, dirty state, and conflict recovery work.
- [ ] Manuscript import is previewed and undoable.
- [ ] A clean white-background character upload becomes a transparent, trimmed, bound sprite.
- [ ] Project JSON export imports as a new playable project.
- [ ] One-click startup works from a fresh Windows copy without killing other processes.
- [ ] Lint, tests, build, browser QA, docs, showcase, GitHub push, and CI are complete.
