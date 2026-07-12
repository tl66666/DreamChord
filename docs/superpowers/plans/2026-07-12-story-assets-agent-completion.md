# DreamChord Story, Assets, and Agent Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the official story across editor and player, make local character cutout safe and explainable, and let the project Agent inspect and prepare real uploaded assets.

**Architecture:** Extend the existing Sharp inspection service with deterministic visual recommendations and reuse it from the asset API and Agent tools. Put the official demo graph in the shared story-domain package, seed the database from that graph, and make every player route load the same persisted project graph.

**Tech Stack:** TypeScript, React 18, Express, Prisma/SQLite, Sharp, Vitest, Testing Library, pnpm workspace, agent-browser.

---

## File Map

- `apps/server/src/assets/imageInspector.ts`: decode safety plus deterministic image analysis and recipe recommendation.
- `apps/server/src/assets/imageProcessor.ts`: edge-connected matte removal and format normalization.
- `apps/server/src/assets/assetService.ts`: owned-file inspection and persisted variant analysis metadata.
- `apps/server/src/routes/assets.ts`: authenticated asset inspection endpoint.
- `apps/server/src/agent/tools.ts`: expose real analysis through `inspect_asset` and apply recommended recipes.
- `apps/web/src/api/client.ts`: asset analysis response types and API call.
- `apps/web/src/assets/AssetProcessingSheet.tsx`: recommendation-first processing workflow.
- `packages/story-domain/src/officialDemo.ts`: the single official demo graph and metadata.
- `apps/server/prisma/seed.ts`: transactional refresh of the system-owned demo from the shared fixture.
- `apps/web/src/player/VisualNovelPlayer.tsx`: one API-backed loading path for demo and normal projects.
- `apps/web/src/engine/demo.ts`: removed after all consumers use the shared persisted graph.

### Task 1: Deterministic Image Analysis

**Files:**
- Modify: `apps/server/src/assets/imageInspector.ts`
- Modify: `apps/server/src/assets/imageProcessor.test.ts`
- Create: `apps/server/src/assets/imageInspector.test.ts`

- [ ] **Step 1: Write failing inspection tests**

Create Sharp fixtures for a transparent portrait, a white-background portrait, a noisy photographic background, and a wide opaque image. Assert the returned `analysis` includes the exact stable fields:

```ts
expect(result.analysis).toMatchObject({
  background: 'flat-light',
  recommendedPurpose: 'sprite',
  recommendedRecipe: { removeWhite: true, trim: true },
})
expect(result.analysis.confidence).toBeGreaterThanOrEqual(0.7)
expect(result.analysis.warnings).toEqual([])
```

For a transparent image, assert `background: 'transparent'` and `removeWhite: false`. For the noisy fixture, assert `background: 'complex'` and a warning explaining that local automatic cutout is unreliable.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter dreamchord-server test -- imageInspector.test.ts`  
Expected: FAIL because `ImageInspection.analysis` does not exist.

- [ ] **Step 3: Implement the analysis contract**

Add these exported types and calculate them from a downscaled RGBA sample capped at 256 pixels on its longest side:

```ts
export type ImageBackgroundKind = 'transparent' | 'flat-light' | 'flat-color' | 'complex'
export interface ImageAnalysis {
  alphaCoverage: number
  borderLuminance: number
  borderVariance: number
  background: ImageBackgroundKind
  foregroundBounds: { x: number; y: number; width: number; height: number } | null
  recommendedPurpose: 'sprite' | 'cg' | 'background'
  recommendedRecipe: { removeWhite: boolean; trim: boolean; whiteThreshold: number; feather: number }
  confidence: number
  reasons: string[]
  warnings: string[]
}
```

Use alpha coverage first, then border luminance/variance and aspect ratio. Round all ratios to four decimals so Agent outputs and tests are stable.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm --filter dreamchord-server test -- imageInspector.test.ts`  
Expected: all inspection tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/assets/imageInspector.ts apps/server/src/assets/imageInspector.test.ts
git commit -m "feat: analyze uploaded image suitability"
```

### Task 2: Edge-Connected Matte Removal

**Files:**
- Modify: `apps/server/src/assets/imageProcessor.ts`
- Modify: `apps/server/src/assets/imageProcessor.test.ts`

- [ ] **Step 1: Write a failing regression test**

Build a 9x9 opaque white image with a dark closed ring around a white 3x3 center. Process it as a sprite with `removeWhite: true`, then assert the corner alpha is zero and the enclosed center alpha remains 255. Add a feather assertion that only background-connected boundary pixels receive partial alpha.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter dreamchord-server test -- imageProcessor.test.ts`  
Expected: FAIL because the center white pixels are currently removed globally.

- [ ] **Step 3: Replace global removal with border flood fill**

Create a `Uint8Array` mask, seed a queue with qualifying pixels on all four edges, and visit four-connected neighbors. Clear alpha only for visited background pixels; compute feather alpha for visited pixels using the configured white threshold. Keep existing dimension limits and output formats unchanged.

- [ ] **Step 4: Run processor and inspector tests**

Run: `pnpm --filter dreamchord-server test -- imageProcessor.test.ts imageInspector.test.ts`  
Expected: both suites PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/assets/imageProcessor.ts apps/server/src/assets/imageProcessor.test.ts
git commit -m "fix: preserve enclosed whites during matte removal"
```

### Task 3: Asset API and Agent Tool Integration

**Files:**
- Modify: `apps/server/src/assets/assetService.ts`
- Modify: `apps/server/src/routes/assets.ts`
- Modify: `apps/server/src/agent/tools.ts`
- Modify: `apps/server/src/agent/service.ts`
- Modify: `apps/server/src/agent/tools.test.ts`
- Modify: `apps/server/src/routes/assets.test.ts`

- [ ] **Step 1: Write failing service and tool tests**

Test `PrismaAssetService.inspect(assetId, userId)` for ownership, missing files, and returned pixel analysis. Change the Agent registry test to inject:

```ts
inspectAsset: vi.fn(async () => ({
  id: 'asset',
  analysis: { background: 'flat-light', recommendedPurpose: 'sprite', confidence: 0.92 },
})),
```

Then assert `registry.inspect_asset.execute({ assetId: 'asset' })` returns that analysis rather than snapshot metadata.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter dreamchord-server test -- tools.test.ts assets.test.ts`  
Expected: FAIL because neither the service inspection method nor registry callback exists.

- [ ] **Step 3: Implement the owned inspection path**

Add `inspectAsset?: (assetId: string) => Promise<unknown>` to `createAgentToolRegistry`, wire it from the Agent service to `PrismaAssetService.inspect`, and add `GET /api/assets/:assetId/inspection`. Store `{ recipe, sourceAnalysis, outputAnalysis }` in variant metadata during processing. Keep `prepare_*` calls producing proposed variants only.

- [ ] **Step 4: Strengthen Agent guidance**

Update the existing Agent system instructions so it must call `inspect_asset` before a preparation tool, prefer existing transparency, use connected white removal only for `flat-light`, and warn rather than claim semantic cutout for `complex` backgrounds.

- [ ] **Step 5: Run Agent, asset, and e2e tests**

Run: `pnpm --filter dreamchord-server test -- tools.test.ts assets.test.ts agent.e2e.test.ts`  
Expected: all selected suites PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/assets apps/server/src/routes/assets.ts apps/server/src/agent
git commit -m "feat: give agent real asset inspection tools"
```

### Task 4: Recommendation-First Asset Studio

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/assets/AssetProcessingSheet.tsx`
- Modify: `apps/web/src/assets/AssetProcessingSheet.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Mock the inspection endpoint and assert that opening a flat-light portrait selects “角色立绘”, enables white removal, shows the confidence/reason text, and shows no complex-background warning. Add a complex-background case that disables automatic removal and renders the transparent-PNG/solid-background guidance.

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm --filter dreamchord-web test -- AssetProcessingSheet.test.tsx`  
Expected: FAIL because the sheet never fetches or renders analysis.

- [ ] **Step 3: Implement typed analysis loading**

Add `ImageAnalysis` and `AssetInspection` API types plus `inspectAsset(assetId)`. On sheet mount, load the inspection, set purpose and recipe from its recommendation once, and render loading/error states without blocking manual processing.

- [ ] **Step 4: Implement the compact recommendation UI**

Add an unframed recommendation band above the two-column preview area with a purpose icon, confidence label, reasons, and warnings. Use a segmented control for purpose, checkboxes for removal/trim, and keep the existing numeric sliders. Mark the current preview stale whenever recipe fields change and disable “接受并使用” until a new preview is generated.

- [ ] **Step 5: Run tests and web build**

Run: `pnpm --filter dreamchord-web test -- AssetProcessingSheet.test.tsx && pnpm --filter dreamchord-web build`  
Expected: tests PASS and Vite build exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/assets/AssetProcessingSheet.tsx apps/web/src/assets/AssetProcessingSheet.test.tsx
git commit -m "feat: guide asset preparation with image analysis"
```

### Task 5: Shared Official Demo Graph

**Files:**
- Create: `packages/story-domain/src/officialDemo.ts`
- Create: `packages/story-domain/src/officialDemo.test.ts`
- Modify: `packages/story-domain/src/index.ts`
- Modify: `apps/server/prisma/seed.ts`
- Create: `apps/server/src/demo/officialDemoSeed.ts`
- Create: `apps/server/src/demo/officialDemoSeed.test.ts`

- [ ] **Step 1: Write failing graph contract tests**

Assert the fixture has nine distinct `sceneGroupId` values, every node has a non-empty `sceneTitle`, all edge endpoints exist, each three-choice node has exactly `choice-0`, `choice-1`, and `choice-2`, and `analyzeStoryGraph(OFFICIAL_DEMO.graph).summary.danger === 0`.

- [ ] **Step 2: Run the domain test and verify RED**

Run: `pnpm --filter @dreamchord/story-domain test -- officialDemo.test.ts`  
Expected: FAIL because `OFFICIAL_DEMO` does not exist.

- [ ] **Step 3: Define the complete narrative graph**

Create the nine-scene story from the approved design with stable node IDs, scene titles, explicit choice handles, `setVariable` nodes for the first choice, conditional callback dialogue, a final thematic choice, and a resolved epilogue. Reuse only existing public backgrounds and character sprite IDs so a clean install renders every scene.

- [ ] **Step 4: Run graph tests and verify GREEN**

Run: `pnpm --filter @dreamchord/story-domain test -- officialDemo.test.ts health.test.ts`  
Expected: all domain tests PASS.

- [ ] **Step 5: Write a failing seed refresh test**

Extract `refreshOfficialDemo(client)` and test that it replaces stale official nodes/edges while preserving an unrelated user project. Assert the project remains public/published and all new edges retain `sourceHandle`.

- [ ] **Step 6: Implement transactional official-demo refresh**

Upsert the fixed demo user and project, then in one transaction delete/recreate only the official demo chapters, nodes, edges, and official character records from `OFFICIAL_DEMO`. Call this helper from `prisma/seed.ts`; remove the old inline demo graph.

- [ ] **Step 7: Run seed tests and build**

Run: `pnpm --filter dreamchord-server test -- officialDemoSeed.test.ts && pnpm --filter dreamchord-server build`  
Expected: test PASS and TypeScript build exits 0.

- [ ] **Step 8: Commit**

```bash
git add packages/story-domain apps/server/prisma/seed.ts apps/server/src/demo
git commit -m "feat: publish one coherent official story graph"
```

### Task 6: One Player Loading Path

**Files:**
- Modify: `apps/web/src/player/VisualNovelPlayer.tsx`
- Modify: `apps/web/src/pages/PlayerPage.tsx`
- Delete: `apps/web/src/engine/demo.ts`
- Create: `apps/web/src/player/VisualNovelPlayer.test.tsx`

- [ ] **Step 1: Write a failing player test**

Mock `getProject` for `dreamchord-first-thread`, render the player route, and assert `getProject('dreamchord-first-thread')` is called. Add a rejected request case that renders a visible load error and a return action rather than an empty finished overlay.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter dreamchord-web test -- VisualNovelPlayer.test.tsx`  
Expected: FAIL because the demo bypasses `getProject`.

- [ ] **Step 3: Remove the demo special case**

Delete `DEMO_ID`, `DEMO_RUNTIME_STORY`, and the hardcoded project object. Always fetch the project, merge persisted chapters, convert the graph, and create the runtime engine. Track a load error string separately from `finished`, and render a focused error state with return/home controls.

- [ ] **Step 4: Keep navigation behavior data-driven**

Show “工作台” only when the current authenticated user owns the project, using project ownership data already available to the app rather than the project ID. Keep public anonymous playback working through the existing optional-auth project route.

- [ ] **Step 5: Run player tests and build**

Run: `pnpm --filter dreamchord-web test -- VisualNovelPlayer.test.tsx && pnpm --filter dreamchord-web build`  
Expected: tests PASS and no import references `engine/demo`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/player apps/web/src/pages/PlayerPage.tsx apps/web/src/engine/demo.ts
git commit -m "fix: play the persisted story shown in the editor"
```

### Task 7: Full Verification, Browser QA, and Cleanup

**Files:**
- Modify only files required by defects found during verification.

- [ ] **Step 1: Refresh generated database state**

Run: `pnpm --filter dreamchord-server prisma db seed`  
Expected: seed exits 0 and reports the official demo refresh.

- [ ] **Step 2: Run the complete quality suite**

Run: `pnpm test && pnpm build && pnpm lint && pnpm test:readiness`  
Expected: every command exits 0 with no failing suite.

- [ ] **Step 3: Verify the portable launcher**

Run the repository readiness/launcher checks from a path containing Chinese characters and spaces. Confirm dependency discovery, database migration/seed, upload directory, web/API health checks, and browser opening logic do not depend on the original machine path.

- [ ] **Step 4: Browser-test the asset workflow**

At desktop and mobile viewports, upload a transparent PNG, the bundled white-background source portrait, and a complex image. Verify recommendation, warning, preview, stale-preview gate, acceptance/rejection, and character binding. Confirm enclosed white clothing/details survive the cutout.

- [ ] **Step 5: Browser-test editor and story routes**

Open the official demo editor and confirm nine named scenes and every first-choice branch. Play two routes from start to epilogue and confirm the editor and player text match, branch callbacks differ, sprites/backgrounds load, and controls do not overlap.

- [ ] **Step 6: Clean QA data**

Reject proposed test variants and delete uploaded QA originals from the temporary user project. Confirm no unreferenced upload files remain.

- [ ] **Step 7: Final diff and repository checks**

Run: `git diff --check && git status --short && git log --oneline -12`  
Expected: no whitespace errors, only intentional changes, and all implementation commits present.

- [ ] **Step 8: Publish**

Push `main` to the configured GitHub remote after all verification evidence is current. Confirm the remote branch points at the final local commit.
