# DreamChord Development Guide

This file is the operational guide for coding agents and maintainers working in this repository.

## Product Contract

DreamChord is a visual-novel creation studio. The primary workflow is chapter -> scene -> shot card -> playable story. Raw graph editing is a supporting view, not the main writing experience.

The creative Agent is a bounded collaborator with conversations, layered memory, tool use, structured proposals, review, apply, and undo. It must never silently mutate story data or promote suggestions into canon.

## Workspace

```text
apps/web                 React/Vite frontend
apps/server              Express/Prisma backend
packages/story-domain    shared story graph and patch contracts
docs                     handoff, showcase, and QA screenshots
scripts                  workspace and launcher diagnostics
```

Use the repository root for all pnpm commands. The workspace is pinned to `pnpm@9.1.0`.

## Required Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

For server schema work:

```bash
pnpm --filter dreamchord-server prisma generate
pnpm --filter dreamchord-server prisma migrate dev
pnpm --filter dreamchord-server prisma db seed
```

Do not hand-edit generated Prisma client files.

## Story Graph Invariants

- Shared node, edge, patch, and health rules belong in `packages/story-domain`.
- UI nodes use React Flow shapes; server persistence uses explicit `nodeId`, `positionX`, and `positionY` fields.
- HTTP save payloads are strict. `chapterId` belongs in the URL, not the request body.
- Chapter saves require a positive `baseVersion` and atomically increment the version.
- A stale save returns `409` and must not overwrite the current chapter.
- Preserve choice handles and branch destinations when inserting, moving, or deleting cards.
- Keep graph conversion deterministic and validate patches before database writes.

## Editor State

`useEditorStore` is the editor's single graph source. Hydration resets history. User mutations commit snapshots through the store so undo/redo remains coherent.

Autosave is coordinated by `SaveCoordinator`:

- at most one save is active;
- one latest revision may follow an active save;
- conflict and error states remain dirty;
- navigation protection must treat saving/conflict/error as unsaved work;
- keyboard shortcuts must not intercept text inputs.

Do not add a second local graph copy inside editor components.

## Agent Architecture

Core server code is under `apps/server/src/agent` and the HTTP routes are in `apps/server/src/routes/agent.ts`.

Expected run lifecycle:

```text
queued -> planning -> tool_use -> validating -> awaiting_approval
        -> applied -> undone
        -> rejected / failed / cancelled
```

Rules:

- Conversations are project-owned and user-authorized.
- Conversation history, rolling summary, Story Bible, and ranked memories are assembled before model execution.
- Tools are allowlisted and bounded. Add tools through the registry, schema, implementation, and tests together.
- Model output must become a typed proposal before it can affect a chapter.
- Applying a patch records provenance and an artifact memory.
- Undo is allowed only while the chapter version still matches the applied run.
- API keys must not be logged, persisted in messages, or returned in run records.

## Layered Memory

Memory kinds: `canon`, `character`, `plot`, `decision`, `preference`, `artifact`.

Memory states: `suggested`, `active`, `forgotten`.

Memory behavior:

- suggested memories are reviewable and excluded from canon unless activated;
- forgotten memories remain auditable but are not supplied to the Agent;
- conversation-scoped memories must not leak to another conversation;
- pinned and important memories rank higher, but ownership and status filters run first;
- preserve source type, source ID, tags, and supersession links.

## Assets And Image Processing

- Inspect decoded image content with Sharp; do not trust extension or browser MIME alone.
- Reject malformed, unsupported, oversized, or unsafe inputs before processing.
- Preserve the original upload.
- Derived variants begin as `proposed` and require accept/reject.
- Sprite preset: transparent PNG, 1024x1536.
- CG/background preset: WebP, 1920x1080.
- Character/expression binding happens only when an accepted sprite has a valid character name.
- Deleting a test asset must also clean its file and variants through the service boundary.

## Backup And Restore

Project backups use the versioned `dreamchord-project` manifest. Import must validate with Zod, reject unknown/oversized shapes, create new IDs, and remap all internal references. Never import raw database IDs into an existing project.

## Frontend Expectations

- Operational screens should remain dense, predictable, and work-focused.
- Use existing Lucide icons and established component patterns.
- Avoid cards inside cards and decorative marketing composition inside the editor.
- Maintain usable layouts at 1440x900, 1024x768, 430x932, and 390x844.
- Text and controls must not overlap or rely on viewport-scaled font sizes.
- Mobile editor controls must remain reachable even when side panels collapse.
- The full Agent page uses three mobile tabs: conversations, workspace, context.

## Testing Rules

Use TDD for behavior changes and bug fixes:

1. Add the smallest regression test.
2. Run it and confirm the expected failure.
3. Implement the root-cause fix.
4. Run focused tests, then the full suite.

Test the contract closest to the defect. Examples:

- API serialization bug -> client API test.
- version conflict -> route/service integration test.
- graph mutation -> story-domain test.
- Agent ownership or memory leak -> server service test.
- responsive navigation behavior -> component interaction test plus browser screenshot.

Browser QA should also check console errors and failed network requests.

## Launcher

`start-dreamchord.bat` delegates to `start-dreamchord.ps1`. Keep it portable:

- resolve paths from the script location;
- require Node.js 20+;
- use Corepack and the pinned pnpm version;
- preserve an existing `.env` and secret;
- select free local ports;
- use frozen installs, migrations, and idempotent seed data;
- wait for health endpoints before opening the browser.

Never hardcode a developer's absolute path in launcher or runtime files.

## Security And Git Hygiene

Do not commit:

- `.env` files
- SQLite databases
- `uploads/`
- API keys or bearer tokens
- QA/dev logs
- `node_modules/`, `dist/`, coverage, or generated downloads

Preserve unrelated user changes. Avoid destructive git commands. Use normal commits with focused messages.

## Completion Checklist

Before claiming completion:

1. Run `pnpm lint`.
2. Run `pnpm test`.
3. Run `pnpm build`.
4. Run `pnpm test:readiness` when launcher/workspace behavior changed.
5. Run `git diff --check`.
6. Reproduce high-risk user workflows in a real browser.
7. Confirm the final branch and remote commit.
