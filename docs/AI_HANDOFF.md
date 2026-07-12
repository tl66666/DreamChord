# DreamChord 0.2 Architecture And AI Handoff

Last updated: 2026-07-12

This document describes the implemented system, its safety boundaries, and the correct extension points for future maintainers or coding agents.

## Current Status

DreamChord 0.2 is a working full-stack visual-novel studio with:

- authenticated projects and publishing;
- chapter/scene/shot-card editing;
- branching graph generation and playback;
- history, serialized autosave, version conflicts, and recovery states;
- structured long-form manuscript preview/import;
- project Story Bible and health analysis;
- full-screen multi-conversation creative Agent;
- layered, ranked, reviewable memory;
- bounded story and asset tools;
- safe image preparation and review;
- versioned project backup/restore;
- portable Windows one-click startup.

The current implementation has browser QA evidence under `docs/screenshots/` for home, editor, Agent workspace, memory center, manuscript preview, asset studio, player, and mobile layouts.

## System Map

```text
Browser
  Home / Library / Settings
  FlowEditor
    SceneTree
    ShotCardEditor
    StoryFlowchart
    MiniPreview
    AssetPanel
    compact AgentPanel
  AIWriterPage
    ConversationSidebar
    ConversationTranscript
    AgentPanel
    AgentContextPanel
    MemoryCenter
  VisualNovelPlayer
        |
        | REST + JWT
        v
Express API
  project / chapter / asset / backup routes
  Agent conversation and run routes
        |
        +-> Prisma + SQLite
        +-> Sharp image pipeline
        +-> OpenAI-compatible model provider
        +-> @dreamchord/story-domain
```

## Editor Data Flow

The browser loads server graph records and converts them into React Flow nodes and edges. `useEditorStore` owns the active graph and its history.

```text
server chapter
  -> convertServerNodes / convertServerEdges
  -> ensureLegacySceneGroups
  -> hydrateGraph (history reset)
  -> scene/card editing
  -> commitGraph (history snapshot)
  -> SaveCoordinator
  -> strict PUT body
  -> atomic chapter version claim
```

### Save Contract

URL:

```text
PUT /api/projects/:projectId/chapters/:chapterId
```

Body:

```json
{
  "baseVersion": 1,
  "nodes": [],
  "edges": []
}
```

The body schema is strict. Do not send `chapterId` inside it. The server increments a version only when `baseVersion` matches. A mismatch returns `409` with the current version.

The autosave coordinator serializes writes and saves the newest revision after an in-flight write. Conflict/error states remain dirty so navigation protection stays active.

## Story Domain

`packages/story-domain` is the shared contract for graph semantics, patch operations, health analysis, and validation. Agent tools and editor code should depend on this package rather than inventing local graph formats.

Core expectations:

- node and edge IDs are unique;
- edges reference existing nodes;
- choice branches preserve handle-to-choice mapping;
- patch operation counts are bounded;
- graph health is checked before approval/application;
- conversion to runtime remains deterministic.

## Creative Agent

### User Model

The Agent has two surfaces:

- Compact editor panel for a quick task in the current project.
- Full-screen `/agent` workspace for multiple conversations, transcripts, memory, context, and long-running creative work.

Each conversation can focus on a different objective. Conversation records store title, scope, chapter ownership, pinned state, summary, and timestamps. Messages and conversation-scoped memories are deleted with the conversation; already applied story changes remain in the chapter audit trail.

### Run Pipeline

```text
request
  -> authorize project + conversation + chapter
  -> assemble context
  -> plan
  -> execute allowlisted tools
  -> build structured proposal
  -> validate graph and limits
  -> await author approval
  -> transactional apply + snapshot
  -> optional version-safe undo
```

The model is not given a direct database write tool.

### Context Assembly

Context is assembled from:

- the active conversation transcript;
- rolling conversation summary;
- project and chapter metadata;
- selected node/scene/chapter scope;
- Story Bible;
- ranked active memories;
- character profiles;
- project asset metadata;
- story graph excerpts and health issues.

Context trimming must preserve ownership and priority before token reduction. Never mix another conversation's private memory into the active run.

### Tool Categories

Read tools:

- conversation context and summaries;
- memory search;
- project/chapter/scene/card lookup;
- Story Bible and character profiles;
- assets and accepted variants;
- story health and bounded search.

Proposal tools:

- create/modify validated story patches;
- propose branch completion or continuation;
- propose safe image preparation.

Apply, undo, accept, and reject remain explicit API commands controlled by the user.

The editor blocks Agent apply/undo while local graph state is dirty, saving, conflicted, or failed. A proposal whose `baseVersion` no longer matches the chapter must be regenerated; never overwrite local edits with an older server result.

Custom provider URLs are checked again at the actual HTTP transport. DNS results are pinned for the connection, redirects are manual and revalidated per hop, and authorization is removed on cross-origin redirects.

### Extending Tools

When adding a tool:

1. Define its input/output schema.
2. Register it in the allowlist and prompt-facing description.
3. Implement authorization and resource bounds.
4. Add focused service tests.
5. Confirm tool output is serializable and contains no secret.
6. Add it to context/tool strategy UI only if users need to understand it.

Avoid generic filesystem, shell, SQL, network, or arbitrary-code tools.

## Layered Memory

### Kinds

| Kind | Purpose |
|---|---|
| `canon` | World rules and immutable facts |
| `character` | Voice, goals, secrets, relationships |
| `plot` | Active plot state and unresolved threads |
| `decision` | Accepted creative decisions |
| `preference` | Author style and workflow preferences |
| `artifact` | Applied patches and generated artifacts |

### States

| State | Agent use |
|---|---|
| `suggested` | Visible for review, excluded from authoritative context |
| `active` | Eligible for ranking and context assembly |
| `forgotten` | Retained for audit, excluded from Agent context |

Each memory includes project ownership, optional conversation ownership, title, content, tags, importance, pin status, source/provenance, supersession, and timestamps.

Ranking occurs after ownership and state filtering. Pinned/high-importance/relevant memories rank higher. Conversation-scoped records must never appear in another conversation.

Applied story patches create active `artifact` memories. Model-extracted facts remain suggested until approved.

## Story Bible

The Story Bible holds world summary, themes, style guide, timeline rules, forbidden elements, and per-character notes. It is project-level context and should remain concise enough to be loaded regularly.

Do not duplicate every memory into the Story Bible. Use the Bible for stable author-maintained rules and memory for provenance-rich evolving knowledge.

## Asset Pipeline

### Upload Boundary

The server validates decoded images with Sharp and audio with signature inspection. Filename and browser MIME are hints only. Uploaded files receive server-owned canonical extensions; static serving permits only known image/audio extensions and sends `X-Content-Type-Options: nosniff`. Reject malformed media, unsupported formats, excessive dimensions/pixels, and files above configured limits.

### Processing Presets

| Purpose | Output |
|---|---|
| Sprite | 1024x1536 transparent PNG |
| CG | 1920x1080 WebP |
| Background | 1920x1080 WebP |

Sprite processing may remove white matte, feather the alpha edge, and trim transparency. CG/background use appropriate crop/fit behavior without white-background removal.

### Variant Lifecycle

```text
original asset
  -> process
  -> proposed variant
  -> accept -> active project asset / character-expression binding
  -> reject -> derived file removed, original preserved
```

Agent image tools may create proposals but may not accept them automatically.

Asset deletion is reference-aware. A derived file still used by `Character.defaultSprite` or `Sprite.url` returns `409`; database deletion commits before unreferenced files are removed. Rejecting a proposal removes its file only when no other record shares the URL.

## Manuscript Import

Long-form text is parsed into a review model before touching the graph. The preview displays chapters, scenes, card counts, and warnings. Only confirm import after the author has reviewed the structure.

Parser extensions should add explicit syntax support and regression fixtures. Avoid guessing complicated hierarchy from punctuation alone.

## Backup And Restore

Export returns a v2 `dreamchord-project` manifest containing project metadata, Story Bible, chapters, graph data, characters, supported memories, and deduplicated uploaded asset bytes. Each embedded file records decoded byte length, MIME, base64 content, and SHA-256.

Import:

- validates the complete manifest with strict Zod schemas;
- limits size and array counts (20 MiB per decoded file, 64 MiB aggregate, 90 MiB JSON request envelope);
- verifies hashes and decoded media content rather than trusting manifest MIME or source URLs;
- creates a new project;
- generates server-owned upload paths and remaps project, chapter, node, edge, character, sprite, asset, URL, graph-data, and Story Bible references;
- never overwrites an existing project;
- leaves the source project unchanged.

Legacy v1 metadata-only manifests are rejected explicitly because they do not contain the bytes needed for a portable restore.

## Frontend Responsive Behavior

Validated viewports:

- 1440x900
- 1024x768
- 430x932
- 390x844

At desktop widths, the editor uses scene tree, card editor, and preview/tool panel. At mobile widths, secondary panes collapse and the shot-card workspace remains primary. The full Agent switches to conversations/workspace/context tabs. The home page uses a compact menu below `md`.

## One-Click Launcher

`start-dreamchord.bat` calls `start-dreamchord.ps1` from the repository directory.

The PowerShell launcher:

- verifies required repository files;
- requires Node.js 20+;
- enables pnpm 9.1.0 via Corepack when needed;
- selects free API/web ports;
- creates `.env` only if missing;
- preserves secrets while updating local port/CORS values;
- installs with `--frozen-lockfile`;
- generates Prisma client, deploys migrations, and runs idempotent seed;
- starts API/web windows and waits for readiness;
- opens the browser only after both services respond.

Use `-SetupOnly` for clean-directory verification and `-NoBrowser` for automated runs.

## Verification Matrix

Automated:

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

Browser:

- login and project listing;
- editor load, add card, undo, redo, autosave, refresh persistence;
- flow view and project health entry;
- manuscript preview without immediate import;
- Agent conversation create/rename/pin/delete;
- memory create/pin/forget;
- asset upload/process/reject/delete;
- backup export/import and imported-project cleanup;
- player progression;
- desktop/tablet/mobile screenshots;
- console errors and failed network requests.

## Known Product Boundaries

- LLM generation requires a configured provider and network access.
- The Agent intentionally does not have arbitrary shell, filesystem, browser, or database access.
- Collaboration/multi-user real-time editing is not implemented.
- TTS and a complete BGM timeline are future extensions, not 0.2 claims.
- Accepted remote model output still requires author review; validation reduces risk but does not replace creative judgment.

## Safe Next Extensions

Recommended order:

1. Agent evaluation fixtures for consistency, character voice, and branch diversity.
2. Memory conflict/supersession UI with side-by-side resolution.
3. Asset generation provider adapters that still feed the proposed-variant workflow.
4. BGM timeline and scene audio transitions.
5. Revision history beyond single-run Agent undo.
6. Optional PostgreSQL deployment profile and object storage adapter.

Do not expand autonomy before adding corresponding authorization, budget, review, audit, and rollback boundaries.
