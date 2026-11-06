# Chapter Two and Soundtrack Implementation Plan

> For agentic workers: use subagent-driven-development with bounded file ownership and independent review.

**Goal:** Strengthen the first two chapters, replace repetitive music with a licensed scene score, and ship a complete playable second chapter in the same book.

**Architecture:** Freeze the published two-chapter definition before edits. Domain prose and authored lines remain source; a shared soundtrack registry provides portable credited files. An explicit fingerprint/version-guarded book release handles existing-chapter revisions and append-only new chapters without touching private copies or duplicating voices.

**Tech Stack:** TypeScript/Vitest, Prisma SQLite, React/Vite, local GPT-SoVITS, original imagegen, Sharp/ffmpeg.

- [x] Read project contract; freeze published definitions; browse official narrative samples; inventory music without mutations.
- [x] Compare live project with frozen source; implement guarded book revision/append service and regression tests (red before green).
- [x] Revise limited bilingual prose and plant the audition letter; keep existing spoken lines and source hashes intact.
- [x] Write original chapter-two bilingual prose/dialogue, own-character conflict and converging action branches; domain tests first.
- [x] Copy only selected existing licensed score files to portable book assets; record credits, author rules, SHA and node cue sheet; replace old cues deliberately.
- [x] Generate corridor/letter/restorer-desk art only where the story needs new images; retain native sources and exact provenance.
- [x] Render fixed-role Japanese chapter audio with existing references, package and check current text/voice hashes/decoding; disclose listening boundary.
- [x] Preflight all media, backup current official snapshot, apply release only if live guard permits; verify same project and stable voice/character IDs.
- [x] Review prose and music usage; independently review installer and runtime changes; fix concrete blockers, run lint/tests/build/media and desktop/mobile/branch QA.
- [x] Export Chinese reading copy and bilingual performance draft, maintain handoff/credits/screenshots, push and verify CI/Pages (feature aa13745: both success).

File ownership: root owns domain prose/chapters/cues and final docs; backend worker owns new server book-release service/tests/CLI and preflight music-credit support; music worker owns new book audio assets/credits and evidence (no source graph edits); audio/art worker owns new chapter assets and production scripts. No worker edits `docs/CURRENT_HANDOFF.md`, database schema, another worker's files or private projects.
