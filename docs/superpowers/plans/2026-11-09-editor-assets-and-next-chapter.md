# Editor usability and next chapter implementation plan

> Execute with subagent-driven-development; user has explicitly authorized autonomous design, implementation and continuation. Preserve the unrelated dirty docs/CURRENT_HANDOFF.md.

**Goal:** Restore usable editor asset scrolling, repair verified card editing problems, and continue the official story with supporting characters in action.

**Architecture:** Existing React/flex panels, editor store and SaveCoordinator remain authoritative. Story definitions stay in story-domain; append-only release uses existing fingerprints/CAS with explicit new-character validation. Original chapters and private copies are protected.

## Tasks

- [ ] Root reproduces AssetPanel clipping at 1440/390, measures the ancestor height/overflow chain, records a failing browser regression, then fixes minimum-height/width/scroll containment at the source. Verify first/last item, search, tab/close and small-screen forms.
- [ ] Editor worker audits existing shot kinds/operations, writes failing component/domain regressions for confirmed issues, implements bounded fixes and runs focused checks. Own only card-editing files, not AssetPanel/FlowEditor/responsive layout.
- [ ] Story worker audits all four chapters and new NPC short stories, writes an actionable continuity report and complete fourth-chapter CN/JP graph/script with short paragraphs, two NPCs entering real scenes, branching action and concrete consequence. Own new chapter files and documentation; no DB or old chapter rewrites.
- [ ] Release worker adds a guarded four-to-five-chapter append path and additive NPC registration using TDD; reject altered/private/unregistered old states and preserve chapter/voice identities. Own release pipeline/tests/installer only, coordinate exact NPC definitions with story worker.
- [ ] Root produces necessary original art and original voice references/JP dialogue, retains originals/prompts/hashes, applies existing licensed music/SFX and validates actual decoding/text/role mapping.
- [ ] Integrate domain exports, media packs, safe installation, full tests/lint/build/media, real UI workflows, independent review and narrative review. Back up before authorized official append; verify unchanged old chapters and private projects, then update documentation/showcase and GitHub CI/Pages.

Run commands from root: pnpm --dir apps/web exec vitest run <focused files>; pnpm --filter @dreamchord/story-domain test; pnpm -r test; pnpm lint; pnpm build; pnpm test:paint; pnpm test:voice-runtime; pnpm test:presentation; pnpm test:readiness; git diff --check.
