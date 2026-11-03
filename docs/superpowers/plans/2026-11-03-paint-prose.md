# Paint prose revision implementation plan

> **For agentic workers:** Use subagent-driven-development for independent migration, art and literary review. Root owns the narrative, domain tests and integration. Reuse this checkout and preserve the pre-existing CURRENT_HANDOFF change.

**Goal:** Turn the approved prologue into a readable literary VN opening, with grounded protagonist perspective, purposeful intertext and motifs, rather than a series of voice auditions.

**Architecture:** Keep stable dialogue IDs/JA takes and four scene groups, rewrite and interleave bilingual narration, add two coherent background/prop images. Add an explicit fingerprint-guarded official upgrade, separate from create-only seed; all changes are checked before transactional updates.

**Tech Stack:** TypeScript/Vitest, React runtime, Prisma, built-in image generation, Sharp, existing local TTS/audio assets.

- [x] Snapshot the currently released v1 canonical graph for safe upgrade comparison before editing.
- [x] RED domain tests for grounded prose opening, purposeful literary source nodes and dispersed dialogue; GREEN rewritten bilingual narration with readable card lengths and original scene closure.
- [x] Generate home opening and ticket/book detail with built-in imagegen, preserve originals and manifests; no new decorative collage.
- [x] RED/GREEN official upgrade tests: exact previous release only, author/visibility/version guard, no private/edited project rewrite, media preflight and transaction. Expose explicit upgrade CLI, leave normal seed create-only.
- [x] Fix CI by installing ffmpeg/ffprobe explicitly before media checks; retain decode verification.
- [x] Independent literary review: no contradictory ticket/seating counts, knowledge/time rules, gratuitous quotation or philosophical mouthpieces. Address findings.
- [x] Browser read opening at normal pace, verify both branches, readable long narration/mobile composition and existing JA audio; update canonical script and screenshots.
- [x] Full tests/lint/build/media, push and verify CI/Pages. Update handover with exact limits; no human-listening claim.
