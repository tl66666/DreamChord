# Studio Reliability and Chapter Three Implementation Plan

> For agentic workers: use subagent-driven-development with bounded ownership and independent final review. User authorized autonomous execution.

**Goal:** Repair reproducible authoring/Agent workflow failures and append a complete literary third chapter to the existing book.

**Architecture:** Keep editor history/save coordinator and bounded Agent proposal lifecycle. Fix closest contracts with regression tests. Freeze current three-chapter source before new exports; extend only the explicit guarded book-release path for a registered 3→4 chapter upgrade, keeping 2→3 compatibility.

**Tech stack:** React/TypeScript/Vitest, Prisma SQLite, GPT-SoVITS, imagegen, ffmpeg/Sharp.

- [x] Read product contract and existing published narrative; inspect editor/Agent flows before feature choices.
- [x] Editor worker: reproduce moveCard and branch-head deletion; write failing targeted tests; fix graph transformations, preserve handles and undo; run focused editor tests.
- [x] Agent worker: reproduce cancellation resurrection and cross-conversation response/history races; failing regressions before root-cause fixes; test cancellation at async boundaries, request identity and history refresh.
- [x] Root: compare live book with current source; write immutable three-chapter release JSON before adding chapter exports.
- [x] Root: author third chapter manuscript with distinct viewpoint/time labels, concrete scenes and a complete local turn; review clarity, continuity and prose before adapting graph.
- [x] Build chapter-three bilingual graph and fixed Japanese line source; test reachability, branch merge, short dialogue, localization and existing profile IDs.
- [x] Produce only required original art and new voice clips using existing authorized references; preserve native sources/parameters/SHA, inspect images, decode/ASR audio with listening limitations explicit.
- [x] Register 3→4 release with exact frozen baseline and complete media preflight. Failing backend tests cover private edits, references, concurrent versions and repeat no-op; no arbitrary force/fingerprint bypass.
- [x] Backup live database/relations, publish only canonical book, verify untouched prior chapter IDs/versions/data and private projects.
- [x] Full tests/lint/build/readiness/media; browser editor/Agent controls and chapter reading at desktop/mobile, independent review, documentation/showcase updates, commit/push and CI/Pages verification (4212368; both success).

Ownership: editor worker owns ShotCardEditor and isolated graph helper/tests; Agent worker owns AgentWorkspace and runService with related tests; root owns story/release/media/docs and coordination. Nobody touches externally modified docs/CURRENT_HANDOFF.md. No worker changes database, credentials or schema, calls paid language models, commits or pushes independently.
