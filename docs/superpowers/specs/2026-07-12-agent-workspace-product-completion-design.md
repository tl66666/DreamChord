# DreamChord Agent Workspace and Product Completion Design

**Date:** 2026-07-12  
**Status:** Approved by delegated product authority  
**Target:** DreamChord 0.2

## 1. Purpose

DreamChord already has a usable scene and shot-card editor, a visual novel player, project persistence, a Story Bible, and a bounded patch-producing Agent. This release turns those pieces into one coherent creative product.

The primary outcome is a project-aware creative Agent that can hold separate conversations, remember useful information at the correct scope, call bounded tools, produce reviewable story or asset artifacts, and continue work without silently overwriting author content. The release also closes editor, asset, startup, testing, documentation, and showcase gaps that currently prevent the repository from feeling complete after download.

## 2. Audit Findings

The design is based on the following verified gaps:

- Agent messages are persisted, but they are never loaded into later runs. Existing conversation IDs therefore do not provide conversational memory.
- Conversations can be created and listed by the API, but messages cannot be read and conversations cannot be renamed or deleted. The UI does not expose a conversation list.
- Agent context includes the selected graph, Story Bible, and characters, but has no rolling summary, project memory retrieval, accepted-decision memory, or asset context.
- The tool registry is limited to project/story reads, graph analysis, and story patch creation/validation.
- Uploaded assets are stored as opaque files. There is no metadata inspection, derivative generation, transparency validation, character/expression binding, or Agent asset tool.
- The editor declares an asset target but never sets it. Selecting an asset in the editor rail therefore does not update the active card.
- Browser-local character and scene libraries and server project assets are separate sources of truth.
- The editor autosave path is debounced but not serialized, has no real dirty-state model, and provides no general undo/redo history.
- Manuscript import commits directly instead of presenting a structured preview.
- The production build passes. The lint command is declared but ESLint is not installed/configured. Database integration tests are vulnerable to stale or competing SQLite test files.
- The Windows launcher accepts Node 18 despite documenting Node 20, may kill unrelated port owners, has an invalid Prisma generated-client check, uses an unreliable per-package npm fallback for workspace dependencies, and does not cleanly separate migration from first-run seeding.
- The local branch is ahead of GitHub and there is no committed CI workflow.

## 3. Product Principles

1. **The shot-card editor remains primary.** Agent and graph views support the writing flow; they do not replace it.
2. **One bounded Agent, multiple capabilities.** A single orchestrator with explicit tools is easier to understand and verify than a group of competing autonomous agents.
3. **Artifacts before mutation.** Story patches, memories, and processed assets are previewed before consequential writes.
4. **Memory is visible and scoped.** Users can inspect, pin, edit, or forget durable memory. Secrets and hidden reasoning are never stored as memory.
5. **Local-first core.** Editing, validation, startup, and deterministic image preparation work without an AI provider. Model-dependent features degrade honestly.
6. **No silent data loss.** Version conflicts, autosave failures, import errors, and asset failures preserve the author's current work and original files.

## 4. Chosen Architecture

DreamChord will use one `CreativeAgentRuntime` on the server. A run receives a target scope, a bounded context package, recent conversation state, retrieved memories, and a fixed tool registry. The default and hard maximum is eight tool steps per run. It returns a user-facing answer plus zero or more typed artifacts.

The runtime remains provider-neutral. Provider adapters supply text chat. The server owns context selection, tool execution, validation, memory policy, and artifact persistence. The model never receives direct database or filesystem access.

The same conversation and run APIs power two surfaces:

- `/agent`: the full creative workspace with conversation navigation, transcript, context, tools, and artifact inspection.
- Editor Agent rail: a compact current-task view bound to the selected project, chapter, scene, or card, with a link to open the same conversation in `/agent`.

Multi-agent role orchestration is deliberately excluded from this release. Roles such as continuation, structure review, canon review, and asset preparation are task modes and tool combinations within the same runtime.

## 5. Conversation Workspace

### 5.1 Conversation lifecycle

Users can create, select, search, rename, and delete project conversations. Each conversation has a title, default scope, optional chapter binding, optional pinned state, timestamps, rolling summary, and summary cursor.

Deleting a conversation requires confirmation and cascades to its messages and runs. Story patches and chapter snapshots that have already changed project history remain auditable through their project/chapter relationship; deletion must not undo accepted story changes.

### 5.2 Transcript

The transcript API returns paginated messages in stable chronological order. User and assistant messages contain typed metadata for runs, tool events, story patches, asset artifacts, and errors. Tool activity is displayed as a collapsed, readable timeline; hidden chain-of-thought is never requested or displayed.

The composer supports project/chapter/scene/card scope, stop, retry, and suggested task starters. Switching conversations does not discard an active run. A conversation URL is shareable within the authenticated local application through `project`, `chapter`, and `conversation` query parameters.

### 5.3 Run behavior

A new run reads conversation history and memory before planning. The API key remains request-only and memory-only in the queue. Interrupted in-process runs become failed with a retryable status after server restart.

## 6. Layered Memory

### 6.1 Layers

1. **Working memory:** ephemeral run plan, tool results, and the current bounded prompt. It is not a durable memory table.
2. **Conversation memory:** recent messages plus a rolling conversation summary. It captures local intent without flooding every prompt with the full transcript.
3. **Project memory:** durable canon, character facts, author preferences, unresolved plot obligations, and project rules. Story Bible data has the highest authority.
4. **Artifact memory:** accepted story patches, confirmed asset variants, and explicit creative decisions with links to their source artifacts.

### 6.2 Memory records

Durable memory records contain project ID, optional conversation ID, kind, title, content, tags, importance, status, source type/source ID, creation time, and update time. Status is `active`, `suggested`, or `forgotten`. A superseding record can reference the record it replaces.

The UI exposes a Memory Center grouped by Story Bible, canon, characters, preferences, plot obligations, decisions, and artifacts. Users can pin, edit, confirm suggestions, or forget records. Forgetting removes the record from retrieval while preserving only the minimum audit metadata needed to explain prior artifacts.

### 6.3 Memory writes

The system automatically stores only high-confidence, bounded facts:

- explicit user preferences stated as durable preferences;
- accepted story changes summarized from the applied patch;
- confirmed asset registrations and character/expression bindings;
- user-confirmed memory suggestions.

Model-proposed canon changes remain `suggested` until accepted. Casual brainstorming, assistant guesses, API keys, raw tool payloads, and hidden reasoning are never promoted automatically.

### 6.4 Retrieval and budget

Retrieval is deterministic and inspectable. It filters by project and scope, scores tag/text overlap, pinned state, importance, recency, and source authority, then deduplicates superseded facts. It does not require an embedding service. The context budget order is:

1. current instruction and selected graph scope;
2. Story Bible and pinned constraints;
3. recent conversation turns;
4. relevant project and artifact memories;
5. rolling summary;
6. lower-ranked older context.

Each run records the source IDs it used so the UI can explain why a memory was included.

## 7. Agent Tools and Artifacts

### 7.1 Story tools

Existing tools remain: project brief, chapter outline, scene read, story search, graph analysis, story patch creation, and patch validation.

New read tools:

- `read_conversation_context`
- `search_memories`
- `list_project_assets`
- `inspect_asset`
- `read_character_profile`
- `preview_manuscript_import`

New artifact tools:

- `propose_memory_changes`
- `prepare_character_asset`
- `prepare_cg_asset`
- `prepare_background_asset`
- `create_project_export`

Tools return typed results and artifact IDs. They cannot accept arbitrary paths, URLs, SQL, or shell commands. All IDs are checked against the authenticated project owner.

### 7.2 Artifact lifecycle

Artifacts use `proposed`, `ready`, `accepted`, `rejected`, and `failed` states. Story patches continue to use version-checked transactional apply and guarded undo. Asset artifacts preserve the original upload and create derivatives in a staging directory; accepting an artifact registers the derivative and optional character binding. Rejecting removes derivatives but retains the original upload unless the user deletes it.

## 8. Asset Studio

### 8.1 Data model

Assets gain normalized type, MIME type, byte size, width, height, alpha-channel flag, processing status, original/derived relationship, tags, and metadata. `AssetVariant` stores preview, thumbnail, sprite, and optimized runtime derivatives. Character sprites reference an accepted asset variant instead of an untracked URL.

Server-backed project characters and expressions become the editor's project source of truth. Built-in browser library entries remain available as templates and can be copied into a project. Existing localStorage library data is migrated non-destructively when the user opens the library.

### 8.2 Processing pipeline

The deterministic local pipeline uses image metadata and pixel processing to:

- validate decoded file content rather than trusting the client MIME string;
- normalize EXIF orientation;
- generate a thumbnail and optimized preview;
- trim transparent or near-white margins;
- remove a near-white studio background with adjustable threshold and edge feathering;
- fit a sprite to a stable transparent canvas;
- export runtime PNG/WebP derivatives;
- report whether the result has meaningful transparency and safe dimensions.

This pipeline is suitable for transparent or clean white-background character art. Complex-background removal is not presented as reliable local AI and is outside this release. Unsupported input remains available as an original asset and the UI explains that a transparent or clean white-background source is required.

### 8.3 User flow

Upload opens a processing sheet with detected purpose (`character`, `CG`, or `background`), original/processed comparison, crop and threshold controls, output dimensions, and target character/expression selectors. The Agent can propose the processing recipe and metadata. The user confirms before the derivative becomes usable in the editor.

## 9. Story Editor Completion

### 9.1 Asset integration

Background and character selectors use a shared project asset picker. Opening the Asset rail from a field sets an explicit target; choosing an asset updates that field and records the change in editor history. Character selection stores the character ID and expression ID, not an image URL in `characterId`.

### 9.2 Edit history and save state

The Zustand editor store gains a bounded graph history with undo/redo commands and `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y`. History records user graph mutations, not selection changes or server refreshes.

The save coordinator tracks `clean`, `dirty`, `saving`, `saved`, `conflict`, and `error`. Autosaves are serialized; a change during an in-flight save schedules exactly one follow-up save with the newest state. Navigation warns whenever unsaved dirty state exists, not only while a request is in progress.

Version conflict UI offers reload-server-copy and keep-local-copy/export options. It never silently overwrites a newer chapter.

### 9.3 Manuscript import

Import parses chapter headings, scene separators, character dialogue, narration, thoughts, memories, and system text into a preview model. Users review scene/card counts and parsing warnings before committing. Commit is a single history transaction and can be undone.

### 9.4 Backup

Project export produces a versioned DreamChord JSON manifest and an asset inventory. Import validates schema and IDs before creating a new project; it never merges destructively into an existing project in this release. Binary asset-bundle export is outside this release.

## 10. Reliability, Security, and Startup

### 10.1 API hardening

- Every asset list/read/write endpoint verifies project ownership or public access policy.
- Request bodies use strict schemas and enumerated asset/memory types.
- Uploaded image content is decoded and size-limited before persistence.
- Generated paths are server-owned and resolved inside configured storage roots.
- Conversation and memory APIs enforce user/project ownership.
- Provider secrets remain absent from logs, database rows, messages, run DTOs, and artifacts.

### 10.2 One-click Windows startup

The launcher:

1. requires Node.js 20 or newer;
2. enables a pinned pnpm through Corepack when pnpm is absent;
3. installs from the workspace root using the committed lockfile;
4. creates local environment configuration without overwriting user secrets;
5. always runs Prisma generate and `migrate deploy` when needed;
6. seeds only when the application has no users/projects;
7. chooses free ports without terminating unrelated processes;
8. starts child processes with clear logs and waits for health checks;
9. opens the resolved frontend URL;
10. exits with actionable diagnostics and a non-zero status on failure.

A non-interactive doctor command checks the same prerequisites for CI and support. The repository remains Windows-first for double-click startup; manual cross-platform pnpm commands are documented.

### 10.3 Engineering baseline

- Add ESLint configuration and pinned dependencies so `pnpm lint` is real.
- Give every SQLite integration suite a unique temporary database path and reliable cleanup.
- Add GitHub Actions for install, Prisma generation, lint, test, and build on Node 20.
- Keep generated databases, uploads, build artifacts, screenshots under verification, and secrets out of Git.

## 11. Error Handling and Degraded Modes

- Without an AI provider, users can still edit, run deterministic graph health checks, search stored data, process supported images, and manage memory manually.
- Invalid model JSON receives bounded repair attempts, then a retryable error with no write.
- Tool step, token, upload size, derivative count, and patch operation limits are explicit.
- Context overflow removes low-ranked sources first and records an omission summary.
- A failed memory extraction never fails the main assistant response.
- A failed image derivative keeps the original and records a retryable processing error.
- A failed or conflicting story patch remains previewable but cannot be applied.
- Server restart marks in-flight jobs interrupted; the UI offers retry with the same prompt and scope.

## 12. Testing and Acceptance

### 12.1 Automated tests

- Domain tests for memory ranking, context budgeting, artifact state transitions, import preview, graph history, and save coordination.
- API tests for conversation CRUD/transcripts, memory CRUD/retrieval, ownership, asset processing lifecycle, and export/import validation.
- Database tests for rolling summaries, applied-artifact memory, story patch transactions, and deletion behavior.
- Component tests for conversation navigation, transcript rendering, Memory Center, asset processing preview, undo/redo, dirty states, and conflict recovery.
- End-to-end browser tests for a real workflow: create conversation, continue a scene, inspect tool sources, apply patch, retain memory, upload and prepare a sprite, bind it to a character, use it in a card, save, preview, reload, and reopen the conversation.

### 12.2 Device and delivery checks

- Desktop widths: 1440 and 1024.
- Mobile widths: 390 and 430, with no overlapping editor/Agent controls.
- Fresh-directory Windows startup simulation without existing `node_modules`, `.env`, or database.
- `pnpm lint`, `pnpm test`, and `pnpm build` all pass from the repository root.
- GitHub Actions passes on the pushed commit.
- The GitHub Pages showcase accurately describes implemented behavior and uses current screenshots.

## 13. Delivery Order

1. Repair engineering baseline, test isolation, security checks, and startup behavior.
2. Implement conversation CRUD, transcripts, and the full Agent workspace shell.
3. Implement layered memory, retrieval, summaries, Memory Center, and Agent context integration.
4. Implement editor history/save coordination, asset picker integration, and manuscript import preview.
5. Implement asset metadata, variants, local sprite preparation, character binding, and Agent asset tools.
6. Add project export/import, complete browser QA, update documentation/showcase/screenshots, and push `main`.

Each stage uses tests first and must leave the full existing suite buildable. Database migrations are additive. Existing projects, Story Bible content, conversations, assets, and local libraries are migrated or preserved.

## 14. Explicit Non-Goals

- Unrestricted shell, filesystem, web browsing, SQL, or arbitrary HTTP tools for the Agent.
- Hidden autonomous writes to story graphs, memories, or project assets.
- Multi-agent role orchestration.
- Storing AI provider keys on the server or in conversation history.
- Claiming reliable complex-background AI removal without a configured provider.
- Collaborative real-time multi-user editing.
- Cloud job queues, object storage, billing, or production multi-tenant deployment.

## 15. Definition of Done

The release is complete when a new user can download the repository on Windows, double-click the launcher, sign in, create or open a project, use a complete shot-card editor, maintain multiple independent Agent conversations, observe relevant memory and tool use, safely apply or reject story changes, upload and prepare a character image into a usable project sprite, save and preview the story, export a backup, restart the app without losing state, and understand the project from current documentation and the online showcase.
