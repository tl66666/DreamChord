# Bilingual Audio Workspace Implementation Plan

**Goal:** Deliver editable audio libraries and independent Chinese/Japanese subtitle/voice tracks with real audition assets.

**Architecture:** Keep source text backward compatible. Shared localization utilities resolve fields without mutating story state. Library management goes through authenticated, reference-aware APIs. New media stays traceable through manifests and source notes.

**Tech Stack:** TypeScript, React, Express, Prisma/SQLite, Vitest, Python audio runtimes, generated raster illustration.

## Tasks

- [x] Add voice profile delete/reference removal safeguards in `apps/server/src/routes/voices.ts`, with owned resources and active-job checks. Expose profile update/delete and unbind functions from `apps/web/src/api/client.ts`.
- [x] Build reusable `apps/web/src/voice/VoiceProfileEditor.tsx`; connect edit/status/delete/unbind actions from `VoiceLibrary.tsx`. Verify protected delete and edited list behavior.
- [x] Add shared `packages/story-domain/src/localization.ts` resolver and localized-field schemas; preserve old graph parsing. Extend `apps/web/src/engine/types.ts` and `converter.ts`.
- [x] Add localized fields to the existing node editing panel and independent subtitle/voice controls to `VisualNovelPlayer.tsx`. Test unchanged scene position and no mismatched voice fallback.
- [x] Add official Japanese dialogue/choices map; source additional licensed synthetic voice references and human-composed BGM. Generate and inspect audition output before importing candidates.
- [x] Generate recording-studio artwork via built-in image tool, save an optimized project asset and provenance note, and integrate responsive shared workspace header into voice/music pages.
- [x] Run relevant suites, lint/build, real browser verification and audio checks. Record actual outcomes and any remaining gaps before local commit.

## Additional authorized scope

- [x] Chinese-only input → local/configured translation → Japanese synthesis; CPU translator installation with verified model/runtime downloads.
- [x] Fixed character voices and chapter batch generation, exclusion, rerecording, bulk linking and one-step undo.
- [x] Homepage-aligned navigation, authentication pages, discovery, settings, library and Agent/editor accents; mobile checks.
- [x] Fix notification-triggered reload loops, temporary-backend-outage logout and interrupted voice-job recovery.

## Verification outcomes

2026-10-28: 31 domain + 249 server + 147 web tests passed (427 total); lint and production build passed. Voice-runtime checks: 18 passed; workspace readiness passed. Python scripts and PowerShell translation installer parsed successfully. Native translation and both voice engines were exercised through authenticated APIs. The real editor generated, stopped, auditioned and linked one additional Japanese line while preserving its Chinese source.

See `docs/verification/2026-10-28-audio-and-interface.md` for media limits and browser evidence.

## Test targets

`pnpm --filter @dreamchord/story-domain test`, `pnpm --filter dreamchord-server test -- src/routes/voices.test.ts src/voice`, `pnpm --filter dreamchord-web test -- src/player/VisualNovelPlayer.test.tsx src/voice/VoiceLibrary.test.tsx src/library/MusicLibrary.test.tsx`, `pnpm lint`, `pnpm build`, `pnpm test:voice-runtime`.
