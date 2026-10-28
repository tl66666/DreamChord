# Official Demo Audio Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a rewritten, stateful official demo with character-specific adaptive voice direction, curated human-composed music, and production-style playback mixing.

**Architecture:** Add a pure story-domain voice director and declarative branch effects, then compile those effects into the existing runtime engine. Keep audio generation provider-neutral: CosyVoice handles instruction-driven performance, GPT-SoVITS handles authorized cloning, and both produce reviewable assets before node binding. Official music and voice cues use stable manifest keys resolved by the seed layer instead of machine-specific paths.

**Tech Stack:** TypeScript, React, Vitest, Express, Prisma/SQLite, Web Audio-compatible HTMLAudioElement control, PowerShell-managed Python runtimes, CosyVoice 3, GPT-SoVITS.

---

## File map

### Story and direction

- Create `packages/story-domain/src/voiceDirection.ts`: deterministic line analysis, text hashing, defaults, and explicit-lock merging.
- Create `packages/story-domain/src/voiceDirection.test.ts`: pure behavior tests for the director.
- Modify `packages/story-domain/src/types.ts`: shared `VoiceDirection` and declarative runtime effect types.
- Modify `packages/story-domain/src/schemas.ts`: accept validated `voiceDirection` and `audio` dialogue metadata.
- Modify `packages/story-domain/src/index.ts`: export the new module.
- Modify `packages/story-domain/src/officialDemo.ts`: rewrite the nine scenes, add branch effects, voice directions, and stable audio keys.
- Modify `packages/story-domain/src/officialDemo.test.ts`: assert story quality, branch consequences, and cue coverage.

### Runtime and player

- Modify `apps/web/src/engine/types.ts`: runtime variables, choice effects, audio keys, and optional voice direction.
- Modify `apps/web/src/engine/converter.ts`: compile choice effects and resolve non-playable graph nodes without emitting blank scenes.
- Modify `apps/web/src/engine/converter.test.ts`: converter coverage.
- Modify `apps/web/src/engine/runtime.ts`: apply choice effects and conditional targets.
- Modify `apps/web/src/engine/runtime.test.ts`: branch-state tests.
- Modify `apps/web/src/player/audioDirector.ts`: BGM ducking, timed fades, voice completion restoration, and safe cancellation.
- Modify `apps/web/src/player/audioDirector.test.ts`: deterministic fake-timer audio tests.
- Modify `apps/web/src/player/VisualNovelPlayer.tsx`: wait for voice during auto mode and cancel voice on manual advance.
- Modify `apps/web/src/player/VisualNovelPlayer.test.tsx`: formal player interaction tests.

### Licensed soundtrack

- Create `assets/music-packs/ternox-vn/manifest.json`: selected tracks, author, CC0 source, original name, hashes, and scene roles.
- Create `assets/music-packs/ternox-vn/LICENSE-SOURCE.md`: license/source record.
- Create `scripts/install-official-soundtrack.ps1`: download, verify, transcode, and install selected OGG files.
- Create `scripts/official-soundtrack-manifest.test.mjs`: manifest safety and completeness tests.
- Modify `.gitignore`: ignore downloaded originals while retaining manifest and compact runtime files chosen for commit.
- Modify `package.json`: soundtrack setup/test commands.
- Modify `apps/server/prisma/seedStarterMusic.ts`: seed curated track metadata and replace prior starter entries by stable IDs.

### Adaptive providers and chapter production

- Create `apps/server/src/voice/voiceDirectionService.ts`: shared direction inference and provider request mapping.
- Create `apps/server/src/voice/voiceDirectionService.test.ts`: mapping/fallback tests.
- Modify `apps/server/src/voice/provider.ts`: provider capability contract and expressive input fields.
- Modify `apps/server/src/voice/gptSovitsProvider.ts`: select emotion-matched references and declare supported capabilities.
- Modify `apps/server/src/voice/gptSovitsProvider.test.ts`: request and fallback tests.
- Create `apps/server/src/voice/cosyVoiceProvider.ts`: local HTTP provider.
- Create `apps/server/src/voice/cosyVoiceProvider.test.ts`: exact request/response tests.
- Create `scripts/setup-cosyvoice.ps1`: isolated runtime and model installation.
- Create `scripts/cosyvoice-runtime-config.mjs`: paths, ports, and launch configuration.
- Create `scripts/cosyvoice-runtime-config.test.mjs`: configuration tests.
- Modify `apps/server/src/voice/providerConfig.ts`: enable provider selection and fallback order.
- Modify `apps/server/src/routes/voices.ts`: analyze text, batch official lines, quality status, and bind approved assets.
- Modify `apps/server/src/routes/voices.test.ts`: route tests.
- Create `apps/web/src/voice/ChapterVoiceDirector.tsx`: chapter production UI.
- Create `apps/web/src/voice/ChapterVoiceDirector.test.tsx`: UI tests.
- Modify `apps/web/src/voice/VoiceLibrary.tsx`: capability/role-fit badges and fixed-line A/B audition.
- Modify `apps/web/src/api/client.ts`: new analysis and batch endpoints.

### Seed and documentation

- Modify `apps/server/src/demo/officialDemoSeed.ts`: resolve stable audio keys to seeded asset URLs and keep refresh idempotent.
- Create `apps/server/src/demo/officialDemoSeed.test.ts`: stable-key and idempotency tests.
- Create `scripts/generate-official-demo-voices.mjs`: queue, poll, quality-check, accept, and bind official lines.
- Modify `README.md`, `docs/CREATOR_WORKFLOW.md`, and `docs/GPT_SOVITS_SETUP.md`: end-user setup and licensing.

## Phase 1 — story, direction, and playback

Execution status (2026-10-28): Tasks 1–5 are committed. Task 6 is installed and verified by three real CosyVoice generations plus one GPT-SoVITS fallback generation. Task 7 currently has shared direction mapping, manual/automatic library controls, provenance and stale-hash service; chapter batch APIs/UI remain. Task 8 remains pending. See `docs/VOICE_RUNTIME_VERIFICATION.md` for evidence and remaining work. Individual checkboxes below retain the original implementation recipe.

### Task 1: Pure automatic voice director

**Files:**
- Create: `packages/story-domain/src/voiceDirection.ts`
- Create: `packages/story-domain/src/voiceDirection.test.ts`
- Modify: `packages/story-domain/src/types.ts`
- Modify: `packages/story-domain/src/index.ts`

- [ ] **Step 1: Write failing tests for stable emotion, pacing, locks, and hashes**

```ts
import { describe, expect, it } from 'vitest'
import { directVoiceLine, voiceTextHash } from './voiceDirection.js'

describe('directVoiceLine', () => {
  it('directs hesitation without turning it into exaggerated sadness', () => {
    expect(directVoiceLine({ role: 'yuki', text: '我……真的还能重新写吗？' })).toMatchObject({
      emotion: 'afraid', intensity: 0.45, pace: 0.92, pauseProfile: 'dramatic', source: 'auto',
    })
  })

  it('keeps locked author choices while refreshing the text hash', () => {
    const result = directVoiceLine({ role: 'yuki', text: '这一次，我会留下。', existing: {
      emotion: 'whisper', intensity: 0.3, pace: 0.8, pauseProfile: 'short', delivery: '贴近耳语',
      lockedFields: ['emotion', 'delivery'], source: 'manual', textHash: 'old',
    } })
    expect(result.emotion).toBe('whisper')
    expect(result.delivery).toBe('贴近耳语')
    expect(result.textHash).toBe(voiceTextHash('这一次，我会留下。'))
  })
})
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm --filter @dreamchord/story-domain test -- voiceDirection.test.ts`  
Expected: FAIL because `voiceDirection.js` does not exist.

- [ ] **Step 3: Implement the shared type and deterministic analyzer**

```ts
export type VoiceEmotion = 'neutral' | 'warm' | 'joy' | 'sad' | 'tense' | 'angry' | 'afraid' | 'resolve' | 'whisper'

export interface VoiceDirection {
  emotion: VoiceEmotion
  intensity: number
  pace: number
  pauseProfile: 'short' | 'natural' | 'dramatic'
  delivery: string
  lockedFields: Array<keyof Omit<VoiceDirection, 'lockedFields' | 'source' | 'textHash'>>
  source: 'manual' | 'auto'
  textHash: string
}
```

Implement `voiceTextHash()` with SHA-256-compatible deterministic logic available in both Node and browser by using a small FNV-1a hexadecimal hash; this is change detection, not security. Implement `directVoiceLine()` with ordered signals: explicit stage words, anger, fear/question+hesitation, sadness, resolve, joy/warmth, then role defaults. Clamp intensity to `0..1` and pace to `0.75..1.2`. Merge only unlocked fields from an existing direction.

- [ ] **Step 4: Run domain tests and confirm GREEN**

Run: `pnpm --filter @dreamchord/story-domain test -- voiceDirection.test.ts`  
Expected: all new tests pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/story-domain/src/voiceDirection.ts packages/story-domain/src/voiceDirection.test.ts packages/story-domain/src/types.ts packages/story-domain/src/index.ts
git commit -m "feat: add deterministic voice direction"
```

### Task 2: Stateful branch effects in the runtime

**Files:**
- Modify: `apps/web/src/engine/types.ts`
- Modify: `apps/web/src/engine/converter.ts`
- Modify: `apps/web/src/engine/converter.test.ts`
- Modify: `apps/web/src/engine/runtime.ts`
- Modify: `apps/web/src/engine/runtime.test.ts`

- [ ] **Step 1: Write failing runtime tests**

```ts
it('applies a selected choice effect before entering its target', () => {
  const engine = createRuntimeEngine(storyWithChoiceEffects)
  expect(engine.choose(2)).toBe(true)
  expect(engine.state.variables.authorStance).toBe('agency')
  expect(engine.currentScene()?.id).toBe('agency-echo')
})

it('resolves a conditional target from current variables', () => {
  const engine = createRuntimeEngine(storyWithConditionalTargets)
  engine.choose(1)
  expect(engine.currentScene()?.dialogue?.text).toContain('保留修改历史')
})
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `pnpm --filter dreamchord-web test -- src/engine/runtime.test.ts src/engine/converter.test.ts`  
Expected: FAIL because `WorldState.variables`, `choiceEffects`, and `conditionalTargets` are absent.

- [ ] **Step 3: Add runtime types and choice application**

```ts
export type RuntimeValue = string | number | boolean
export type RuntimeEffect = { kind: 'setVariable'; variable: string; value: RuntimeValue }
export type RuntimeCondition = { variable: string; operator: '==' | '!='; value: RuntimeValue; target: string }

export interface WorldState {
  // existing fields
  variables: Record<string, RuntimeValue>
}
```

Add `choiceEffects?: RuntimeEffect[][]` and `conditionalTargets?: RuntimeCondition[]` to `RuntimeScene`. In `choose(index)`, apply the selected effect before resolving the target. In `next()`, test conditions in declaration order and use the first match, otherwise use `nextSceneId`.

- [ ] **Step 4: Compile `choiceEffects` and condition nodes**

For choice node data, accept `effects: Array<Array<{ kind: 'setVariable'; variable: string; value: RuntimeValue }>>`. Update `resolvePlayableTargetId()` so it traverses background, character, transition, delay, setVariable, condition, and jump nodes without creating blank runtime scenes. When traversing a `condition`, attach its true/false playable destinations to the preceding playable scene as conditional targets.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run: `pnpm --filter dreamchord-web test -- src/engine/runtime.test.ts src/engine/converter.test.ts`  
Expected: all runtime and converter tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/engine/types.ts apps/web/src/engine/converter.ts apps/web/src/engine/converter.test.ts apps/web/src/engine/runtime.ts apps/web/src/engine/runtime.test.ts
git commit -m "feat: preserve story choices in playback"
```

### Task 3: Rewrite the official nine-scene demo

**Files:**
- Modify: `packages/story-domain/src/officialDemo.ts`
- Modify: `packages/story-domain/src/officialDemo.test.ts`
- Modify: `packages/story-domain/src/schemas.ts`

- [ ] **Step 1: Add failing story-quality tests**

```ts
it('uses actions, cues, and voice direction throughout the official demo', () => {
  const dialogues = OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'dialogue')
  expect(dialogues.length).toBeGreaterThanOrEqual(52)
  expect(dialogues.every((node) => node.data.voiceDirection)).toBe(true)
  expect(OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'subtitle').length).toBeGreaterThanOrEqual(4)
  expect(OFFICIAL_DEMO.graph.nodes.filter((node) => node.type === 'transition').length).toBeGreaterThanOrEqual(3)
})

it('stores the first choice and pays it off with three distinct echoes', () => {
  const choice = OFFICIAL_DEMO.graph.nodes.find((node) => node.id === 's3-choice')
  expect(choice?.data.effects).toEqual([
    [{ kind: 'setVariable', variable: 'authorStance', value: 'fear' }],
    [{ kind: 'setVariable', variable: 'authorStance', value: 'rewrite' }],
    [{ kind: 'setVariable', variable: 'authorStance', value: 'agency' }],
  ])
  expect(['fear', 'rewrite', 'agency'].every((value) =>
    OFFICIAL_DEMO.graph.nodes.some((node) => node.data.conditionValue === value),
  )).toBe(true)
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `pnpm --filter @dreamchord/story-domain test -- officialDemo.test.ts`  
Expected: FAIL on dialogue count, missing directions, and missing branch effects.

- [ ] **Step 3: Extend schemas for declarative cues**

Add strict schemas for `voiceDirection`, dialogue `audio`, choice `effects`, and condition routing fields. Reuse shared field schemas rather than accepting unrestricted records. Existing node payloads must continue to parse unchanged.

- [ ] **Step 4: Rewrite the story with focused helpers**

Add helpers that prevent repetitive unsafe objects:

```ts
function dialogue(id: string, scene: Scene, role: Role, text: string, overrides: Partial<VoiceDirection> = {}) {
  return add(id, 'dialogue', scene.id, scene.title, {
    role,
    text,
    voiceDirection: directVoiceLine({ role, text, overrides }),
    audio: { bgm: { action: 'keep' } },
  })
}
```

Implement the exact nine-scene narrative in the approved design, including: disappearing text as action, Miyako's lost memory, two handwriting evidence, Sora's sacrifice cost, Yuki's identity flicker, the ghost/autosave reveal, three stance echoes, and three separate endings. Keep each dialogue at 12–36 Chinese characters unless a system line requires a compact timestamp.

- [ ] **Step 5: Run domain tests and graph health checks**

Run: `pnpm --filter @dreamchord/story-domain test`  
Expected: all story-domain tests pass; no danger-level graph issues.

- [ ] **Step 6: Commit**

```powershell
git add packages/story-domain/src/officialDemo.ts packages/story-domain/src/officialDemo.test.ts packages/story-domain/src/schemas.ts
git commit -m "feat: rewrite the official demo story"
```

### Task 4: Curate and install the human-composed soundtrack

**Files:**
- Create: `assets/music-packs/ternox-vn/manifest.json`
- Create: `assets/music-packs/ternox-vn/LICENSE-SOURCE.md`
- Create: `scripts/install-official-soundtrack.ps1`
- Create: `scripts/official-soundtrack-manifest.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `apps/server/prisma/seedStarterMusic.ts`

- [ ] **Step 1: Write a failing manifest test**

```js
test('official soundtrack is human-composed, CC0, hashed, and role-complete', () => {
  assert.equal(manifest.sourceLicense, 'CC0-1.0')
  assert.equal(manifest.generativeAiUsed, false)
  assert.deepEqual(new Set(manifest.tracks.map((track) => track.role)), new Set([
    'twilight', 'erasure', 'ren', 'miya', 'sora', 'finale',
  ]))
  for (const track of manifest.tracks) {
    assert.match(track.sha256, /^[a-f0-9]{64}$/)
    assert.match(track.outputFile, /^runtime\/[a-z0-9-]+\.ogg$/)
  }
})
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test scripts/official-soundtrack-manifest.test.mjs`  
Expected: FAIL because the curated manifest does not exist.

- [ ] **Step 3: Download and audition before selection**

The installer downloads only from the recorded TERNOX itch.io distribution URL, verifies the archive hash, extracts to a temporary directory, and never executes downloaded content. Use `ffprobe` to list duration/sample rate and create 30-second audition derivatives. Select six tracks by listening for scene fit; do not select from filenames alone.

- [ ] **Step 4: Build the traceable manifest and compact runtime files**

For every selected track record `id`, `name`, `originalFile`, `role`, `mood`, `scenes`, `author`, `sourceUrl`, `license`, `sha256`, `durationSeconds`, and `loop`. Transcode to OGG Vorbis quality 5, normalize integrated loudness to approximately `-18 LUFS`, and keep peaks below `-1 dBTP`. Commit the compact OGG files only if the pack license allows redistribution; otherwise install them into ignored local assets and surface setup status in the app.

- [ ] **Step 5: Seed stable asset IDs and run twice**

Run:

```powershell
pnpm music:official:install
pnpm music:seed
pnpm music:seed
```

Expected: six official tracks exist once in the library; the second seed changes no counts.

- [ ] **Step 6: Run manifest tests and commit**

Run: `pnpm test:voice-runtime`  
Expected: soundtrack and existing runtime tests pass.

```powershell
git add .gitignore package.json assets/music-packs/ternox-vn scripts/install-official-soundtrack.ps1 scripts/official-soundtrack-manifest.test.mjs apps/server/prisma/seedStarterMusic.ts
git commit -m "feat: add curated official soundtrack"
```

### Task 5: Production-style audio mixing

**Files:**
- Modify: `apps/web/src/player/audioDirector.ts`
- Modify: `apps/web/src/player/audioDirector.test.ts`
- Modify: `apps/web/src/player/VisualNovelPlayer.tsx`
- Modify: `apps/web/src/player/VisualNovelPlayer.test.tsx`

- [ ] **Step 1: Write failing fake-audio tests**

```ts
it('ducks BGM while voice plays and restores it on ended', () => {
  const director = createAudioDirector(factory, scheduler)
  director.playScene({ bgm: { action: 'play', url: '/theme.ogg', volume: 0.6 }, voice: { url: '/line.wav' } }, fullMix)
  expect(created[0]!.volume).toBeCloseTo(0.3)
  created[1]!.emit('ended')
  scheduler.flush()
  expect(created[0]!.volume).toBeCloseTo(0.6)
})

it('fades out the old voice when the player advances', () => {
  director.playScene({ voice: { url: '/old.wav' } }, fullMix)
  director.stopTransient({ fadeOutMs: 120 })
  scheduler.advance(120)
  expect(created[0]!.pause).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm --filter dreamchord-web test -- src/player/audioDirector.test.ts src/player/VisualNovelPlayer.test.tsx`  
Expected: FAIL because the fake audio contract lacks events/fades and the player does not coordinate voice completion.

- [ ] **Step 3: Implement scheduler-driven fades and ducking**

Extend `AudioLike` with optional `addEventListener` and `removeEventListener`. Inject a small scheduler so tests never sleep. Duck BGM to 50% of its current mixed volume while voice is active, restore on `ended`, and cancel listeners when advancing or disposing. Apply `fadeInMs`/`fadeOutMs` in 30ms volume steps with a final exact value.

- [ ] **Step 4: Coordinate player auto/manual behavior**

Expose `isVoicePlaying()` and an `onVoiceEnded()` subscription. Auto mode waits for both typing completion and voice completion plus a 350ms reading tail. Manual advance fades the voice over 100ms. Skip mode stops current voice immediately.

- [ ] **Step 5: Run focused and full web tests**

Run: `pnpm --filter dreamchord-web test`  
Expected: all web tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/player/audioDirector.ts apps/web/src/player/audioDirector.test.ts apps/web/src/player/VisualNovelPlayer.tsx apps/web/src/player/VisualNovelPlayer.test.tsx
git commit -m "feat: direct voice and music playback"
```

## Phase 2 — expressive generation and chapter workflow

### Task 6: Provider capabilities and CosyVoice runtime

**Files:**
- Modify: `apps/server/src/voice/provider.ts`
- Create: `apps/server/src/voice/cosyVoiceProvider.ts`
- Create: `apps/server/src/voice/cosyVoiceProvider.test.ts`
- Modify: `apps/server/src/voice/gptSovitsProvider.ts`
- Modify: `apps/server/src/voice/gptSovitsProvider.test.ts`
- Create: `scripts/cosyvoice-runtime-config.mjs`
- Create: `scripts/cosyvoice-runtime-config.test.mjs`
- Create: `scripts/setup-cosyvoice.ps1`
- Modify: `apps/server/src/voice/providerConfig.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing capability and request tests**

```ts
expect(cosy.capabilities).toMatchObject({ instructionEmotion: true, voiceClone: true, speedControl: true })
expect(gptSovits.capabilities).toMatchObject({ instructionEmotion: false, emotionReference: true })

await cosy.synthesize({
  text: '我不会再把你删掉。', textLanguage: 'zh', referencePath: 'C:\\voices\\yuki.wav',
  promptText: '这是参考台词。', promptLanguage: 'zh', speed: 0.94,
  direction: { emotion: 'resolve', intensity: 0.65, delivery: '克制但坚定' },
})
expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/inference'), expect.objectContaining({ method: 'POST' }))
```

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm --filter dreamchord-server test -- src/voice/cosyVoiceProvider.test.ts src/voice/gptSovitsProvider.test.ts`  
Expected: FAIL because capabilities, direction input, and CosyVoice provider are absent.

- [ ] **Step 3: Implement provider-neutral expressive input**

Add `VoiceProviderCapabilities` and optional `direction` to `VoiceSynthesisInput`. CosyVoice maps direction to one concise Chinese instruction. GPT-SoVITS ignores free-form instructions but records the selected emotion-reference fallback in result metadata.

- [ ] **Step 4: Implement isolated runtime configuration**

Use `D:\DreamChordRuntime\cosyvoice` by default, port `50000`, loopback-only binding, a dedicated `.conda` environment, and `Fun-CosyVoice3-0.5B-2512`. The setup script verifies Git, Conda, CUDA visibility, required model files, provider health, and available disk space before reporting success. It never modifies the GPT-SoVITS environment.

- [ ] **Step 5: Install and benchmark one line**

Run:

```powershell
pnpm voice:cosy:setup
pnpm voice:cosy:smoke
```

Expected: a valid Chinese WAV is generated; record runtime seconds, peak VRAM, audio duration, and provider version. If the 8GB GPU cannot run reliably, keep the adapter but set GPT-SoVITS as local fallback and report the measured failure instead of hiding it.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter dreamchord-server test -- src/voice` and `pnpm test:voice-runtime`  
Expected: all voice tests pass.

```powershell
git add apps/server/src/voice package.json scripts/cosyvoice-runtime-config.mjs scripts/cosyvoice-runtime-config.test.mjs scripts/setup-cosyvoice.ps1
git commit -m "feat: add expressive CosyVoice provider"
```

### Task 7: Chapter voice direction and stale-audio detection

**Files:**
- Create: `apps/server/src/voice/voiceDirectionService.ts`
- Create: `apps/server/src/voice/voiceDirectionService.test.ts`
- Modify: `apps/server/src/routes/voices.ts`
- Modify: `apps/server/src/routes/voices.test.ts`
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/voice/ChapterVoiceDirector.tsx`
- Create: `apps/web/src/voice/ChapterVoiceDirector.test.tsx`
- Modify: `apps/web/src/voice/VoiceLibrary.tsx`

- [ ] **Step 1: Write failing service and route tests**

```ts
it('marks an accepted take stale when its text hash differs', () => {
  expect(reviewLine({ text: '新台词', acceptedMetadata: { textHash: voiceTextHash('旧台词') } }).status).toBe('stale')
})

it('returns every dialogue line grouped by character and review state', async () => {
  const response = await request(app).get('/api/voice/projects/project/chapters/chapter/director').set(auth)
  expect(response.status).toBe(200)
  expect(response.body.characters[0].lines[0]).toMatchObject({ nodeId: 's1-d1', status: 'missing' })
})
```

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm --filter dreamchord-server test -- src/voice/voiceDirectionService.test.ts src/routes/voices.test.ts`  
Expected: FAIL because review service and chapter endpoints are absent.

- [ ] **Step 3: Implement review and batch APIs**

Add:

- `GET /api/voice/projects/:projectId/chapters/:chapterId/director`
- `POST /api/voice/projects/:projectId/chapters/:chapterId/analyze`
- `POST /api/voice/projects/:projectId/chapters/:chapterId/generate`
- `POST /api/voice/jobs/:jobId/approve-and-bind`

The batch endpoint accepts explicit node IDs, never silently generates the entire chapter, and reuses the serial queue. Approved assets store `nodeId`, `textHash`, `direction`, provider capability snapshot, reference provenance, and quality result.

- [ ] **Step 4: Write failing UI tests**

```tsx
expect(await screen.findByText('台词已变化')).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: '重新分析本句' }))
await waitFor(() => expect(api.analyzeChapterVoice).toHaveBeenCalledWith('project', 'chapter', ['s1-d1']))
```

- [ ] **Step 5: Implement the chapter director UI**

Display per-character counts and rows with text, inferred emotion, pace, delivery, provider, reference, and status. Provide row-level analyze/generate/audition/approve actions plus selected-row batch generation. The default filter is “需要处理”; approved current takes are collapsed.

- [ ] **Step 6: Run server and web tests, then commit**

Run: `pnpm --filter dreamchord-server test` and `pnpm --filter dreamchord-web test`  
Expected: both suites pass.

```powershell
git add apps/server/src/voice/voiceDirectionService.ts apps/server/src/voice/voiceDirectionService.test.ts apps/server/src/routes/voices.ts apps/server/src/routes/voices.test.ts apps/web/src/api/client.ts apps/web/src/voice/ChapterVoiceDirector.tsx apps/web/src/voice/ChapterVoiceDirector.test.tsx apps/web/src/voice/VoiceLibrary.tsx
git commit -m "feat: add chapter voice direction workflow"
```

### Task 8: Bind official audio and run end-to-end acceptance

**Files:**
- Modify: `apps/server/src/demo/officialDemoSeed.ts`
- Create: `apps/server/src/demo/officialDemoSeed.test.ts`
- Create: `scripts/generate-official-demo-voices.mjs`
- Modify: `README.md`
- Modify: `docs/CREATOR_WORKFLOW.md`
- Modify: `docs/GPT_SOVITS_SETUP.md`

- [ ] **Step 1: Write failing seed-resolution tests**

```ts
it('resolves official audio keys without storing machine paths', async () => {
  const project = await refreshOfficialDemo(client, owner)
  const nodes = await client.storyNode.findMany({ where: { chapter: { projectId: project.id } } })
  const dialogue = JSON.parse(nodes.find((node) => node.nodeId === 's1-d1')!.data)
  expect(dialogue.audio.bgm.url).toMatch(/^\/uploads\//)
  expect(JSON.stringify(dialogue)).not.toMatch(/[A-Z]:\\/)
})
```

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm --filter dreamchord-server test -- src/demo/officialDemoSeed.test.ts`  
Expected: FAIL because stable cue keys are not resolved.

- [ ] **Step 3: Resolve cues and create the production script**

Resolve `musicKey`, `sfxKey`, and approved `voiceKey` inside a cloned graph before database insertion. The production script logs in as the demo owner, verifies every character binding, generates only missing/stale lines, polls jobs with bounded backoff, runs technical checks, accepts passing candidates, and writes their URLs back through the seed resolver. It stops for manual review rather than auto-approving expressive quality.

- [ ] **Step 4: Generate and review the official demo**

Run:

```powershell
pnpm db:seed
pnpm voice:official:generate
pnpm dev
```

Manually play all three stance echoes and all three endings. Reject and regenerate any line with wrong stress, robotic pauses, mispronunciation, clipping, or character drift. Record accepted job IDs in the local production report; do not commit user-specific absolute paths.

- [ ] **Step 5: Run the full verification gate**

Run:

```powershell
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
pnpm test:voice-runtime
git diff --check
```

Expected: all commands exit `0`. Then confirm no listeners or orphan model processes remain after QA.

- [ ] **Step 6: Update documentation and commit**

Document setup commands, fallback behavior, license/source display, chapter director usage, and the rule that human voice samples require explicit cloning permission.

```powershell
git add apps/server/src/demo/officialDemoSeed.ts apps/server/src/demo/officialDemoSeed.test.ts scripts/generate-official-demo-voices.mjs README.md docs/CREATOR_WORKFLOW.md docs/GPT_SOVITS_SETUP.md
git commit -m "feat: ship the directed official demo"
```

## Final review checklist

- [ ] Every accepted requirement in the design maps to a task above.
- [ ] No downloaded executable or model weight is committed.
- [ ] No human voice is used for cloning without explicit permission covering model training or synthesis.
- [ ] The official demo remains editable after seeding and the seed remains idempotent.
- [ ] Formal playback, not only library preview, has been tested with actual audio.
- [ ] All local commits remain unpushed until the user requests a GitHub push.
