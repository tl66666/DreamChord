# Voice Library and GPT-SoVITS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private reusable voice library, project-character bindings, reviewed voice-generation jobs, and a safe local GPT-SoVITS adapter.

**Architecture:** Prisma stores voice profiles, references, bindings, and generation provenance. A provider-neutral service talks to one server-configured GPT-SoVITS endpoint through a serialized queue. Accepted candidates become existing `VOICE` assets so playback remains provider-independent.

**Tech Stack:** TypeScript, Express, Prisma/SQLite, Zod, React, Vitest, GPT-SoVITS HTTP API.

---

### Task 1: Model the voice library

**Files:**
- Modify: `apps/server/prisma/schema.prisma`
- Create: `apps/server/prisma/migrations/20261023010000_voice_library/migration.sql`
- Create: `apps/server/src/voice/voiceSchemas.ts`
- Create: `apps/server/src/voice/voiceSchemas.test.ts`

- [ ] Test required ownership, consent, transcript/language, provider enum, job states, speed bounds, and revocation rules.
- [ ] Add `VoiceProfile`, `VoiceReference`, `CharacterVoiceBinding`, and `VoiceGenerationJob` with owner/project/asset relations and deletion behavior.
- [ ] Generate Prisma Client and run schema tests.

### Task 2: Add secure voice-library routes

**Files:**
- Create: `apps/server/src/routes/voices.ts`
- Create: `apps/server/src/routes/voices.test.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/routes/assets.ts`

- [ ] Test authenticated list/create/update, cross-user denial, consent enforcement, valid `VOICE_SAMPLE` attachment, binding ownership, and revocation blocking new jobs.
- [ ] Implement CRUD and binding routes using the existing auth and error response conventions.
- [ ] Extend voice-sample metadata with exact transcript, language, style, and quality guidance while preserving old samples as unassigned references.
- [ ] Run server route tests and commit.

### Task 3: Implement the provider boundary

**Files:**
- Create: `apps/server/src/voice/provider.ts`
- Create: `apps/server/src/voice/gptSovitsProvider.ts`
- Create: `apps/server/src/voice/gptSovitsProvider.test.ts`
- Create: `apps/server/src/voice/providerConfig.ts`

- [ ] Mock HTTP and test `/tts` payload mapping, binary response handling, timeout, non-2xx messages, fixed configured URL, and disabled-provider health.
- [ ] Implement `VoiceProvider`, environment parsing, and GPT-SoVITS adapter using server-side resolved reference paths only.
- [ ] Reject request-provided provider URLs and avoid logging sample paths or secrets.
- [ ] Run focused provider tests and commit.

### Task 4: Add serialized generation and candidate acceptance

**Files:**
- Create: `apps/server/src/voice/voiceQueue.ts`
- Create: `apps/server/src/voice/voiceQueue.test.ts`
- Modify: `apps/server/src/routes/voices.ts`
- Modify: `apps/server/src/assets/assetService.ts`

- [ ] Test FIFO single concurrency, failed-job cleanup, retry, rejection, acceptance provenance, and no overwrite of current shot audio.
- [ ] Generate to a managed private candidate path; create a formal `VOICE` asset only on acceptance.
- [ ] Expose health, create job, list jobs, retry, accept, and reject routes.
- [ ] Run voice and asset tests and commit.

### Task 5: Build the voice-library UI

**Files:**
- Create: `apps/web/src/voice/VoiceLibrary.tsx`
- Create: `apps/web/src/voice/VoiceLibrary.test.tsx`
- Create: `apps/web/src/voice/VoiceProfileEditor.tsx`
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Modify: `apps/web/src/api/client.ts`

- [ ] Test empty/offline states, search and filters, preview, consent form, transcript/language validation, reference count, and generation history.
- [ ] Add a 声音库 tab with directory/detail layout and clear private/authorized labels.
- [ ] Surface provider status without exposing its raw URL.
- [ ] Run web tests and commit.

### Task 6: Bind characters and review candidates in the editor

**Files:**
- Create: `apps/web/src/editor/CharacterVoicePanel.tsx`
- Create: `apps/web/src/editor/CharacterVoicePanel.test.tsx`
- Modify: `apps/web/src/editor/AssetPanel.tsx`
- Modify: `apps/web/src/editor/CardEditor.tsx`

- [ ] Test voice selection, unbinding, generate-missing-only, offline fallback, audition, accept, reject, and preserving an existing shot voice.
- [ ] Add exact transcript/language fields to sample upload and the binding/candidate panel to project editing.
- [ ] Keep manual `VOICE` upload and binding available in every provider state.
- [ ] Run focused editor tests and commit.

### Task 7: Documentation and verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/CREATOR_WORKFLOW.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `CHANGELOG.md`

- [ ] Document local GPT-SoVITS startup assumptions, environment variables, authorization responsibilities, backup behavior, and offline/manual fallback.
- [ ] Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:readiness`, and `git diff --check`.
- [ ] Browser-test voice library and editor at desktop and mobile widths, including provider offline, job failure, and candidate acceptance.

