# Managed Voice Runtime and Starter Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install a project-managed GPT-SoVITS runtime on the best local disk, generate three license-traceable synthetic Chinese reference voices, and seed them into DreamChord's private voice library.

**Architecture:** A tested Node utility owns deterministic path, checksum, manifest, and `.env` logic; PowerShell performs Windows downloads and process installation using those decisions. A focused TypeScript seeder validates a checked-in starter manifest, copies generated WAV files into the private upload tree, and upserts voice profiles/references for the demo user. The existing managed engine remains the only runtime process owner.

**Tech Stack:** PowerShell 7, Node.js 24, TypeScript, Prisma 5, Vitest, Miniforge, GPT-SoVITS API v2, Kokoro 82M.

---

### Task 1: Runtime path and configuration utilities

**Files:**
- Create: `scripts/voice-runtime-config.mjs`
- Create: `scripts/voice-runtime-config.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for drive selection, SHA parsing, and `.env` updates**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseRuntimeRoot, parseSha256, upsertEnvText } from './voice-runtime-config.mjs'

test('chooses the roomiest fixed drive with at least 40 GiB', () => {
  assert.equal(chooseRuntimeRoot([{ root: 'C:\\', free: 30 }, { root: 'D:\\', free: 136 }]), 'D:\\DreamChordRuntime')
})

test('parses the official versioned Miniforge checksum', () => {
  assert.equal(parseSha256('abc123  Miniforge3-26.9.4-0-Windows-x86_64.exe'), 'abc123')
})

test('updates one env key without discarding comments', () => {
  assert.match(upsertEnvText('# local\nPORT=3001\n', 'GPT_SOVITS_HOME', 'D:/DreamChordRuntime/gpt-sovits'), /# local\nPORT=3001\nGPT_SOVITS_HOME="D:\/DreamChordRuntime\/gpt-sovits"/)
})
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `node --test scripts/voice-runtime-config.test.mjs`

Expected: FAIL because `voice-runtime-config.mjs` does not exist.

- [ ] **Step 3: Implement the pure utility module**

```js
export function chooseRuntimeRoot(drives, minimumGiB = 40) {
  const eligible = drives.filter((drive) => drive.free >= minimumGiB).sort((a, b) => b.free - a.free)
  if (!eligible.length) throw new Error(`声音运行时至少需要 ${minimumGiB}GB 可用空间`)
  return `${eligible[0].root}DreamChordRuntime`
}

export function parseSha256(text) {
  const value = text.trim().split(/\s+/)[0]
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('Miniforge SHA256 文件无效')
  return value.toLowerCase()
}

export function upsertEnvText(source, key, value) {
  const line = `${key}="${value.replaceAll('\\', '/')}"`
  const expression = new RegExp(`^${key}=.*$`, 'm')
  return expression.test(source) ? source.replace(expression, line) : `${source.replace(/\s*$/, '')}\n${line}\n`
}
```

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `node --test scripts/voice-runtime-config.test.mjs`

Expected: 3 tests pass.

- [ ] **Step 5: Add `test:voice-runtime` and commit**

```json
"test:voice-runtime": "node --test scripts/voice-runtime-config.test.mjs"
```

```powershell
git add scripts/voice-runtime-config.mjs scripts/voice-runtime-config.test.mjs package.json
git commit -m "test: define managed voice runtime configuration"
```

### Task 2: Self-contained Miniforge and GPT-SoVITS installer

**Files:**
- Modify: `scripts/setup-gpt-sovits.ps1`
- Modify: `docs/GPT_SOVITS_SETUP.md`
- Test: `scripts/voice-runtime-config.test.mjs`

- [ ] **Step 1: Extend the failing test with pinned official artifacts**

```js
import { MINIFORGE_RELEASE } from './voice-runtime-config.mjs'

test('pins a versioned Miniforge installer and checksum', () => {
  assert.match(MINIFORGE_RELEASE.installer, /Miniforge3-\d+\.\d+\.\d+-\d+-Windows-x86_64\.exe$/)
  assert.equal(MINIFORGE_RELEASE.checksum, `${MINIFORGE_RELEASE.installer}.sha256`)
})
```

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test scripts/voice-runtime-config.test.mjs`

Expected: FAIL because `MINIFORGE_RELEASE` is not exported.

- [ ] **Step 3: Add the pinned release manifest**

```js
export const MINIFORGE_RELEASE = {
  tag: '26.9.4-0',
  installer: 'Miniforge3-26.9.4-0-Windows-x86_64.exe',
  checksum: 'Miniforge3-26.9.4-0-Windows-x86_64.exe.sha256',
  baseUrl: 'https://github.com/conda-forge/miniforge/releases/download/26.9.4-0',
}
```

- [ ] **Step 4: Rewrite the PowerShell setup stages**

Implement these exact stages in `setup-gpt-sovits.ps1`:

```powershell
param([ValidateSet('AUTO','CU126','CU128','CPU')][string]$Device='AUTO', [string]$RuntimeRoot='')
$ErrorActionPreference = 'Stop'
# 1. Resolve the roomiest drive when RuntimeRoot is empty.
# 2. Download the versioned Miniforge installer and .sha256 from conda-forge.
# 3. Compare Get-FileHash SHA256 before Start-Process -Wait with /S and /D=<local path>.
# 4. Use only <runtime>\miniforge3\Scripts\conda.exe; never mutate PATH.
# 5. Clone GPT-SoVITS and create <repo>\.conda with Python 3.10.
# 6. Invoke the repository's official install.ps1 inside that prefix.
# 7. Verify api_v2.py, tts_infer.yaml, .conda\python.exe, and pretrained_models.
# 8. Update apps/server/.env with GPT_SOVITS_HOME and GPT_SOVITS_PYTHON.
```

- [ ] **Step 5: Validate syntax and rerun utility tests**

Run:

```powershell
pwsh -NoProfile -Command '$source = Get-Content -Raw scripts/setup-gpt-sovits.ps1; $null = [scriptblock]::Create($source)'
pnpm test:voice-runtime
```

Expected: syntax command exits 0; all Node tests pass.

- [ ] **Step 6: Update the beginner guide and commit**

Document D-drive automatic selection, the 40GB minimum, resumability, checksum verification, and `-RuntimeRoot` override.

```powershell
git add scripts/setup-gpt-sovits.ps1 scripts/voice-runtime-config.mjs scripts/voice-runtime-config.test.mjs docs/GPT_SOVITS_SETUP.md
git commit -m "feat: bootstrap a project-managed voice runtime"
```

### Task 3: Install and verify the real runtime

**Files:**
- Local-only: `apps/server/.env`
- Ignored runtime: `D:\DreamChordRuntime`

- [ ] **Step 1: Run the installer**

Run: `pnpm voice:setup`

Expected: Miniforge checksum passes, CUDA 12.6 is selected for the RTX 4060, GPT-SoVITS finishes its official installer, and `.env` receives absolute paths.

- [ ] **Step 2: Start the server and wait on health rather than sleeping**

Run: `pnpm --filter dreamchord-server dev`

Poll: authenticated `GET /api/voices/provider/health` until `ok: true` or the engine reports `failed`.

Expected: `{ ok: true, provider: 'gpt-sovits', engine: { state: 'running' } }`.

- [ ] **Step 3: Stop the server and confirm the managed child exits**

Run: Ctrl-C in the owning terminal, then inspect port 9880.

Expected: no listener remains on 9880.

### Task 4: Starter voice manifest and generator

**Files:**
- Create: `assets/voice-packs/dreamchord-starter/manifest.json`
- Create: `scripts/generate-starter-voices.py`
- Create: `scripts/starter-voice-manifest.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Write the failing manifest contract test**

The test must assert exactly three stable ids, `Apache-2.0`, `syntheticSource: true`, Chinese transcript text, a source voice id, and an output filename under the ignored generated directory.

- [ ] **Step 2: Run and confirm RED**

Run: `node --test scripts/starter-voice-manifest.test.mjs`

Expected: FAIL because the manifest does not exist.

- [ ] **Step 3: Add the three-entry manifest**

Use stable ids `dreamchord-xingli`, `dreamchord-wulan`, and `dreamchord-muchuan`; map them to three Mandarin Kokoro voice ids and store one 8–15 second transcript per entry.

- [ ] **Step 4: Implement generation with provenance checks**

`generate-starter-voices.py` must load `hexgrad/Kokoro-82M`, refuse a non-Apache model card, generate 24kHz WAV files, reject files outside 3–30 seconds, compute SHA256, and update only the hash/duration fields of the manifest.

- [ ] **Step 5: Run RED→GREEN and commit**

```powershell
node --test scripts/starter-voice-manifest.test.mjs
git add assets/voice-packs/dreamchord-starter/manifest.json scripts/generate-starter-voices.py scripts/starter-voice-manifest.test.mjs .gitignore package.json
git commit -m "feat: define licensed DreamChord starter voices"
```

### Task 5: Idempotent starter voice database seed

**Files:**
- Create: `apps/server/prisma/seedStarterVoices.ts`
- Create: `apps/server/src/voice/starterVoiceManifest.ts`
- Create: `apps/server/src/voice/starterVoiceManifest.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing validation and stable-key tests**

Tests must prove that non-synthetic or non-Apache entries are rejected and that each entry produces stable profile/reference keys on repeated loads.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `pnpm --filter dreamchord-server test -- src/voice/starterVoiceManifest.test.ts`

Expected: FAIL because the loader is missing.

- [ ] **Step 3: Implement strict manifest validation**

Use Zod to require `sourceModel === 'hexgrad/Kokoro-82M'`, `sourceLicense === 'Apache-2.0'`, `syntheticSource === true`, a 64-character hash, and safe relative WAV paths.

- [ ] **Step 4: Implement the transactional seed**

The script must locate user `demo`, verify every WAV hash, copy it into `uploads/library/<user>/voice-starter/`, and transactionally upsert `Asset(type=VOICE_SAMPLE)`, `VoiceProfile`, and `VoiceReference`. Store provenance JSON in the asset metadata and a visible synthetic-source authorization note in the profile.

- [ ] **Step 5: Add and run `voice:seed`**

```json
"voice:seed": "pnpm --filter dreamchord-server exec tsx prisma/seedStarterVoices.ts"
```

Run twice and verify that the second run reports updates, not duplicates.

- [ ] **Step 6: Commit**

```powershell
git add apps/server/prisma/seedStarterVoices.ts apps/server/src/voice/starterVoiceManifest.ts apps/server/src/voice/starterVoiceManifest.test.ts package.json
git commit -m "feat: seed licensed starter voice profiles"
```

### Task 6: End-to-end voice verification

**Files:**
- Modify when required by evidence: `docs/GPT_SOVITS_SETUP.md`

- [ ] **Step 1: Open the DreamChord voice library**

Confirm all three profiles show a synthetic-source badge, source model, reference audio player, transcript, and zero real-person naming.

- [ ] **Step 2: Bind one profile and generate one Chinese sentence per profile**

Accept none automatically. Verify candidate WAVs play and provenance remains attached.

- [ ] **Step 3: Run complete verification**

Run: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:readiness`, `git diff --check`.

Expected: all commands exit 0.

