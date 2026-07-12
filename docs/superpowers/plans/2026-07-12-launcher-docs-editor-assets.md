# DreamChord Launcher, Chinese Docs, And Editor Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one-click startup robust on Windows, make user documentation Chinese, and complete the path from uploaded/processed images to playable story scenes and characters.

**Architecture:** Add side-effect-free DreamChord instance probes to the PowerShell launcher and stop before dependency or Prisma work when an existing API owns the client DLL. Keep the current asset processing and project-character models, widening scene image selection to accepted background/CG assets and preserving the existing graph save/render path.

**Tech Stack:** PowerShell 5.1+, Node.js 20, pnpm 9.1.0, React 18, TypeScript, Vitest, Testing Library, Prisma, Vite.

---

## File Map

- Modify `start-dreamchord.ps1`: detect healthy DreamChord instances before any mutating setup step and reuse or block safely.
- Modify `start-dreamchord.bat`: present Chinese failure guidance.
- Modify `scripts/doctor.ps1`: report project, runtime, ports, and DreamChord state in Chinese while preserving machine-readable status tags.
- Modify `scripts/workspace-readiness.test.mjs`: launcher ordering and localization regression checks.
- Modify `README.md`: replace the English user guide with the complete Chinese product and workflow guide.
- Modify `apps/web/src/editor/ProjectAssetPicker.tsx`: treat BACKGROUND and CG as full-screen scene images.
- Modify `apps/web/src/editor/ProjectAssetPicker.test.tsx`: cover both scene image types and exclude unrelated types.
- Modify `apps/web/src/editor/FlowEditor.tsx`: give new scenes a valid built-in background and keep accepted project characters immediately available.
- Modify or create a focused `apps/web/src/editor/flowEditorUtils.test.ts`: cover the default scene draft through an extracted pure helper only if direct component testing is impractical.
- Modify `apps/web/src/editor/AssetPanel.tsx`: clarify background/CG and accepted-sprite feedback without changing processing semantics.

### Task 1: State-Aware Windows Launcher

**Files:**
- Modify: `scripts/workspace-readiness.test.mjs`
- Modify: `start-dreamchord.ps1`

- [ ] **Step 1: Write failing launcher regression assertions**

Add assertions that locate `Find-DreamChordServer`, the first call to it, and `prisma generate`, then require the probe call to appear first. Assert the script validates `service -eq 'dreamchord-server'`, has an existing-instance success message, blocks `SetupOnly` when a server is active, and still contains no `Stop-Process`.

- [ ] **Step 2: Run readiness test and confirm RED**

Run: `pnpm test:readiness`

Expected: FAIL because the launcher does not yet define or invoke the DreamChord health probe.

- [ ] **Step 3: Implement the minimal instance probes and early exits**

In `start-dreamchord.ps1`, add:

```powershell
function Find-DreamChordServer([int[]]$Candidates) {
  foreach ($port in $Candidates) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
      if ($health.service -eq 'dreamchord-server') { return $port }
    } catch { }
  }
  return $null
}
```

Add an equivalent frontend probe that checks candidate HTML for the DreamChord marker. Invoke both after project-file validation but before Node/pnpm/install/backup/Prisma work. For normal startup, open and return success when both exist. If a server exists without a reusable frontend, or when `-SetupOnly` is used, throw a Chinese message explaining that the running DreamChord service must be closed before setup can replace Prisma Client.

- [ ] **Step 4: Run readiness test and confirm GREEN**

Run: `pnpm test:readiness`

Expected: PASS with `workspace readiness scripts are configured`.

- [ ] **Step 5: Exercise the active-instance path**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .\start-dreamchord.ps1 -NoBrowser`

Expected with the current dev instance: exit code 0, a Chinese “已在运行” message, and no Prisma generation output.

- [ ] **Step 6: Commit**

```bash
git add start-dreamchord.ps1 scripts/workspace-readiness.test.mjs
git commit -m "fix: reuse running DreamChord instance safely"
```

### Task 2: Chinese Launcher Diagnostics And README

**Files:**
- Modify: `start-dreamchord.bat`
- Modify: `scripts/doctor.ps1`
- Modify: `scripts/workspace-readiness.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Add failing localization assertions**

Read the batch and doctor scripts in `workspace-readiness.test.mjs`. Assert that the batch includes `启动失败` and the doctor includes `DreamChord 环境诊断`, `项目文件完整`, and `检测到 DreamChord` while retaining `[PASS]`, `[WARN]`, and `[FAIL]`.

- [ ] **Step 2: Run readiness test and confirm RED**

Run: `pnpm test:readiness`

Expected: FAIL on the new Chinese message assertions.

- [ ] **Step 3: Translate diagnostics without changing exit behavior**

Replace the batch fallback and doctor user text with concise Chinese. Keep exit code 1 for hard failures, exit code 0 for warnings, and retain the status tags used by tests and support screenshots.

- [ ] **Step 4: Rewrite README as the Chinese user entry point**

Document product capabilities, requirements, one-click startup, repeat-start behavior, demo account, story workflow, assets, transparent/white/complex background guidance, manual and Agent-assisted processing, privacy and local storage, backup behavior, troubleshooting, developer commands, directory layout, and showcase link. Do not promise semantic cutout for complex backgrounds.

- [ ] **Step 5: Verify diagnostics and documentation**

Run: `pnpm test:readiness`

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1`

Expected: tests pass and doctor output is Chinese with clear status tags.

- [ ] **Step 6: Commit**

```bash
git add README.md start-dreamchord.bat scripts/doctor.ps1 scripts/workspace-readiness.test.mjs
git commit -m "docs: localize setup and user guide"
```

### Task 3: Make Background And CG Assets Selectable In Stories

**Files:**
- Modify: `apps/web/src/editor/ProjectAssetPicker.test.tsx`
- Modify: `apps/web/src/editor/ProjectAssetPicker.tsx`
- Modify: `apps/web/src/editor/AssetPanel.tsx`

- [ ] **Step 1: Write failing picker tests**

Render a background target with BACKGROUND, CG, BGM, and OTHER assets. Assert both image buttons are present, audio/other buttons are absent, selecting CG returns the original explicit background target, and the heading says `选择背景 / CG`.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `pnpm --filter dreamchord-web test -- ProjectAssetPicker.test.tsx`

Expected: FAIL because CG is currently filtered out for a background target.

- [ ] **Step 3: Implement the scene-image filter**

For `target.field === 'background'`, filter with `['BACKGROUND', 'CG'].includes(asset.type)`. Keep character sprites on the accepted project-character path and remove misleading UI text that suggests arbitrary CG files are injected into character nodes. Update the AssetPanel tab copy to distinguish project character source images from full-screen CG.

- [ ] **Step 4: Run focused test and confirm GREEN**

Run: `pnpm --filter dreamchord-web test -- ProjectAssetPicker.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/ProjectAssetPicker.tsx apps/web/src/editor/ProjectAssetPicker.test.tsx apps/web/src/editor/AssetPanel.tsx
git commit -m "feat: use project CG assets in story scenes"
```

### Task 4: Safe New Scenes And Immediate Sprite Availability

**Files:**
- Modify: `apps/web/src/editor/FlowEditor.tsx`
- Modify: `apps/web/src/editor/projectCharacters.test.ts`
- Modify: `apps/web/src/editor/AssetPanel.tsx`

- [ ] **Step 1: Add the smallest behavior assertions**

Extend the accepted-character test to assert a newly accepted named sprite can be merged into selectors immediately and replaces the same character/expression deterministically. Add a static or pure-helper test asserting the new-scene draft uses `bg-classroom`, matching the existing library ID resolved by `resolveBgUrl`.

- [ ] **Step 2: Run focused tests and confirm RED where applicable**

Run: `pnpm --filter dreamchord-web test -- projectCharacters.test.ts ProjectAssetPicker.test.tsx`

Expected: accepted-character behavior remains green; the new default-background assertion fails before implementation.

- [ ] **Step 3: Implement the default and feedback**

Change the new-scene draft background from an empty string to `bg-classroom`. Preserve `handleProjectCharacterAccepted` as the immediate state update path. In `AssetPanel`, after accepting a sprite, refresh assets, notify the parent, close the processing sheet, and show a concise success toast indicating the character is now available in the story card.

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter dreamchord-web test`

Expected: all web tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/editor/FlowEditor.tsx apps/web/src/editor/projectCharacters.test.ts apps/web/src/editor/AssetPanel.tsx
git commit -m "feat: complete sprite and scene editor workflow"
```

### Task 5: Browser QA And Release Gates

**Files:**
- Modify only if QA exposes a reproducible defect.
- Update screenshots under `docs/showcase/` only when existing tracked showcase assets are stale and the repository already references them.

- [ ] **Step 1: Read and use the browser QA skill**

Use the project’s supported browser automation workflow. Test desktop `1440x900` and mobile `390x844`, checking console errors and failed requests.

- [ ] **Step 2: Verify the complete editor workflow**

Log in with `demo / demo123`, open the official project, create a scene, select a BACKGROUND asset, select a CG asset, confirm preview updates, save, and run full preview. Upload a white-background character source, inspect/process/accept it with a character name, and confirm it appears in the current card selectors without reloading.

- [ ] **Step 3: Clean QA data through application APIs**

Reject or delete temporary assets using the UI/service boundary. Do not delete upload files directly.

- [ ] **Step 4: Run full verification**

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

Expected: every command exits 0 with no test, build, lint, readiness, or whitespace errors.

- [ ] **Step 5: Review repository hygiene**

Run `git status --short`, inspect the complete diff, and verify no `.env`, SQLite database, upload, log, coverage, `node_modules`, or generated secret is staged.

- [ ] **Step 6: Commit any QA-only fixes and push**

```bash
git push origin main
```

Expected: the remote `main` contains every implementation commit and the local branch reports no unpushed commits.

