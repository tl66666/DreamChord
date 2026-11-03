# Paint Prologue Implementation Plan

> **For agentic workers:** Use subagent-driven-development for isolated art/audio/server work. Main agent owns script, story-domain and frontend. No new worktree: continue the suitable active checkout; preserve the pre-existing CURRENT_HANDOFF edit.

**Goal:** Publish a complete playable prologue for the approved literary VN with Chinese text, Japanese acting, coherent art and a safe editable private template.

**Architecture:** Export `PAINT_PROLOGUE` plus `PAINT_STARTER_CARD` from story-domain; reuse the current runtime, localization, character stage and audio director. Add trusted paint-only seeding/template service without resetting existing projects. Use a separate voice/art pack with manifests, bound project-owned voice profiles and hash-checked references.

**Tech Stack:** TypeScript/Vitest, React/Vite, Prisma/SQLite, Python local TTS, Sharp/ffmpeg, built-in image generation.

## 1. Script and graph

- [x] Write original bilingual scene records `{id,role,text,ja,emotion}` in `.runtime/paint-script.json`; keep the readable canonical script in `docs/story/paint/00-prologue.md` and production JSON in the story-domain module.
- [x] RED: `paintPrologue.test.ts` checks reachability, branch convergence, two unique action responses, complete JA text with hashes and no narration voice, fixed canonical ending clue.
- [x] GREEN: `paintPrologue.ts` builds ordered background/character/dialogue/subtitle/choice nodes and edges with independent scene groups and directions. Export through `index.ts`.

## 2. Media

- [x] Generate workshop/stage/night studio with the built-in image tool; copy originals into `source-assets/paint-prologue`, convert accepted backgrounds to runtime WebP.
- [x] Generate identity-consistent transparent full-body character sprites; inspect alpha/subject bounds and half-body stage rendering.
- [x] Voice worker makes expressive reference auditions, then Japanese dialogue takes for each approved script line; save reference, model, seed, text, emotion, WAV/OGG SHA and technical checks.
- [x] Select licensed existing acoustic/piano music and short effects, normalize conservatively, package only required runtime files with credits.
- [x] `scripts/paint-prologue-pack.test.mjs` verifies every referenced file, audio duration/hash and art alpha/size.

## 3. Trusted backend

- [x] Server worker adds `paintPrologueSeed.ts`, `paintTemplate.ts`, an authenticated fixed `/templates/paint-prologue` route and a seed CLI. Use project id `dreamchord-paint-prologue`, preserve previous demos and never accept arbitrary source-project IDs.
- [x] RED: template tests cover private ownership, graph ID remapping, per-owner references/profile bindings, replayed request id and existing-data preservation.
- [x] GREEN: install from fixed manifests only, validate reference SHA before copy, increment no existing author graphs. Create owned template with an editable next-line card focused for the editor.

## 4. Entry and presentation

- [x] Add a fixed `/start/paint-prologue` entry and explicit login return allowlist; test no unsafe return route and creation request reuse.
- [x] Update homepage official-play link to the prologue, retain previous story cards, and give this demo a clear “序章” label. Player completion offers “从这一幕继续写”.
- [x] Set default subtitle zh and voice ja; voice bindings inherited once per role; use saved JA takes immediately on play.

## 5. Review and delivery

- [x] Independent literary/Japanese review for natural dialogue, speaker identity, clue timing and continuity.
- [x] Independent code/spec review after implementation. Fix important findings.
- [x] Run domain/server/web tests, lint, build, readiness, media and presentation checks. Browser verify desktop/mobile, both branch paths, Japanese audio, music continuity, half-body sprites, template clone and editor save.
- [x] Update story guide, credits and verification screenshots; commit/push the authorized iteration, leaving pre-existing external changes unstaged.
