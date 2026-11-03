# Chapter One and story library cleanup plan

> **For agentic workers:** Use subagent-driven-development for independent audit/backend, art, and voice/literary review. Root owns text, story-domain, reader chapter entry and final integration. Preserve the pre-existing CURRENT_HANDOFF edit and reuse this checkout.

**Goal:** Continue the approved literary story with a complete first chapter in the same project, while safely removing proven duplicate default stories.

**Architecture:** A separate chapter-one graph/line/prose module is installed beside the unchanged prologue, reusing cast/voice identities. Read-only canonical comparison and backup precede cleanup. Player chapter selection uses current project chapters and the existing runtime converter.

**Tech Stack:** TypeScript/Vitest, React, Prisma/SQLite, built-in imagegen, local GPT-SoVITS, Sharp/ffmpeg, existing backup/delete services.

- [x] Read-only prologue/literary review and project duplication inventory; resolve real continuity blockers.
- [x] Write original bilingual chapter prose/dialogue and a complete action-choice graph; RED/GREEN reachability/branch convergence/source hashes/continuous reading tests.
- [x] Generate shop, river and paired cup CGs with provenance; generate fixed-role Japanese dialogue, preserve prior takes, check text/runtime hashes and decoding.
- [x] Backend explicit same-project chapter installation with media preflight, ownership/canonical-content guard, stable cast/bindings, idempotence and transactional writes; TDD.
- [x] Reader chapter picker, direct chapter entry and accurate chapter labels, with invalid-input and existing preview behavior tests.
- [x] Review duplicate groups, verify full local backups and portable exports, remove five curated obsolete QA/empty/older-replaced projects; preserve edited/independent works.
- [x] Independent prose and backend review; full lint/tests/build/media plus desktop/mobile/branch/chapter QA.
- [x] User follow-up: short reading pages, localized page history, genuine page reset on language change, no repeated BGM; real-player and full-canon paging tests.
- [x] Update manuscript, reading copy, handover and current screenshots. Commit/push and verify remote CI/Pages.

Local evidence: full core suite 600 tests passed, followed by an additional full-canon paging test; media pack 9 tests, native-art byte reproduction, 68 runtime audio decodes, presentation 39 resource references, production build and lint passed. Manual 1440×900 / 390×844, both chapter-one branches, chapter zero/one/invalid URL, anonymous preview denial, focused settings Escape. Prior prologue 166 audio files unchanged. Synthesized acting still requires human listening; three short ASR flags are documented, not waived as human acceptance.

Release evidence: code commit `4a04bc0` pushed to main; clean Ubuntu/Node20 [CI run 41600887115](https://github.com/tl66666/DreamChord/actions/runs/41600887115) and [Pages run 41600886181](https://github.com/tl66666/DreamChord/actions/runs/41600886181) both succeeded. Live showcase returned HTTP200 with the new chapter screenshot and short-page description. Original Hero retained. Pre-existing external changes in `docs/CURRENT_HANDOFF.md` were preserved and excluded from the release commit.
