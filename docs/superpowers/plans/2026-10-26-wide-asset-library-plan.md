# Wide Asset Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cramped two-column character dossiers with a responsive visual gallery and accessible character-detail panel that uses wide desktop space effectively.

**Architecture:** Extract the character library from the oversized page into a focused component. The page owns persisted character data; the gallery owns selection and preview mode only. A reusable responsive detail panel shows the full dossier without duplicating it in every card, while `StageCharacters` remains the single source of sprite framing behavior.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Testing Library, Vitest, Lucide icons.

---

### Task 1: Character gallery behavior contract

**Files:**
- Create: `apps/web/src/library/CharacterGallery.tsx`
- Create: `apps/web/src/library/CharacterGallery.test.tsx`
- Modify: `apps/web/src/pages/LibraryPage.tsx`

- [ ] **Step 1: Write failing interaction tests**

Tests must render two characters and assert: both gallery cards exist; full/bust/stage changes `data-preview-mode`; clicking a card opens a dialog titled with the character name; Escape/close removes it; deleting the selected character calls the supplied callback and closes the dialog.

- [ ] **Step 2: Run targeted test and confirm RED**

Run: `pnpm --filter dreamchord-web test -- src/library/CharacterGallery.test.tsx`

Expected: FAIL because `CharacterGallery` does not exist.

- [ ] **Step 3: Implement the minimal extracted component**

Define explicit props for characters, selected expressions, edit/delete/reset/create callbacks, and expression selection. Keep selection internal as `selectedCharacterId: string | null`. Use semantic `article`, `button`, and `role="dialog" aria-modal="true"` elements.

- [ ] **Step 4: Make the test GREEN**

Run: `pnpm --filter dreamchord-web test -- src/library/CharacterGallery.test.tsx`.

Expected: all new tests pass.

- [ ] **Step 5: Replace the inline `CharacterLibrary` and commit**

Delete the old local component from `LibraryPage.tsx`, import `CharacterGallery`, and preserve the existing editor above the gallery.

```powershell
git add apps/web/src/library/CharacterGallery.tsx apps/web/src/library/CharacterGallery.test.tsx apps/web/src/pages/LibraryPage.tsx
git commit -m "refactor: extract the character library gallery"
```

### Task 2: Wide responsive library shell

**Files:**
- Modify: `apps/web/src/pages/LibraryPage.tsx`
- Modify: `apps/web/src/pages/LibraryPage.test.tsx`

- [ ] **Step 1: Add failing layout assertions**

Add stable `data-testid` attributes and assert that the shell uses a 1760px maximum width, the navigation can scroll horizontally below desktop, and the main content does not force the old 1280px cap.

- [ ] **Step 2: Run and confirm RED**

Run: `pnpm --filter dreamchord-web test -- src/pages/LibraryPage.test.tsx`.

Expected: FAIL on the new width assertions.

- [ ] **Step 3: Implement the shell**

Use `max-w-[1760px]`, `lg:grid-cols-[232px_minmax(0,1fr)]`, a sticky desktop aside, and a horizontally scrollable tab row on smaller screens. Remove the single giant white content card; each active library section provides its own surface.

- [ ] **Step 4: Run and confirm GREEN**

Run both `LibraryPage.test.tsx` and `CharacterGallery.test.tsx`.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/pages/LibraryPage.tsx apps/web/src/pages/LibraryPage.test.tsx
git commit -m "feat: widen the responsive asset library shell"
```

### Task 3: Visual-novel character cards and detail panel

**Files:**
- Modify: `apps/web/src/library/CharacterGallery.tsx`
- Modify: `apps/web/src/library/CharacterGallery.test.tsx`

- [ ] **Step 1: Add failing visual-structure assertions**

Assert a responsive `md:grid-cols-2 2xl:grid-cols-3` gallery, portrait regions with `aspect-[4/5]`, two-line names/descriptions, visible expression count, and that biography/outline/conflicts occur only in the selected detail panel.

- [ ] **Step 2: Run and confirm RED**

Run the component test and confirm failures reference missing classes/content placement.

- [ ] **Step 3: Implement the visual direction**

Build editorial character-index cards: large neutral portrait stage, subtle paper-like surface, name/role footer, two-line synopsis, expression count, and preview segmented control. The desktop detail panel is a right-side sheet no wider than 720px; mobile uses the full viewport. Keep edit/delete inside the sheet and add visible focus rings.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `pnpm --filter dreamchord-web test -- src/library/CharacterGallery.test.tsx src/pages/LibraryPage.test.tsx`.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/library/CharacterGallery.tsx apps/web/src/library/CharacterGallery.test.tsx
git commit -m "feat: redesign character assets as a visual gallery"
```

### Task 4: Browser verification at three viewports

**Files:**
- Modify only if defects are reproduced: `apps/web/src/library/CharacterGallery.tsx`, `apps/web/src/pages/LibraryPage.tsx`

- [ ] **Step 1: Start the real application and log in as demo**

Run `pnpm dev`, open `/library`, and use the existing demo account.

- [ ] **Step 2: Verify 2560×1600**

Capture the role gallery and open detail sheet. Confirm substantial use of width, portraits at least 240px wide, no vertical character-name wrapping, and no horizontal scrollbar.

- [ ] **Step 3: Verify 1440×900**

Confirm two gallery columns remain readable and the detail sheet does not cover its close/edit controls.

- [ ] **Step 4: Verify 390×844**

Confirm one column, horizontally scrollable tabs, a full-screen detail panel, and tap targets at least 40px tall.

- [ ] **Step 5: Inspect console and commit any evidence-based fixes**

Do not make speculative tweaks. If a defect is observed, first add a failing component test, then fix and commit.

### Task 5: Complete repository verification

**Files:**
- None unless verification reveals a defect.

- [ ] **Step 1: Run full checks**

```powershell
pnpm lint
pnpm test
pnpm build
pnpm test:readiness
git diff --check
```

Expected: all commands exit 0; test output contains no failures.

- [ ] **Step 2: Confirm repository state**

Run `git status --short` and `git log -8 --oneline`. Ensure only intentional commits are present and no generated model/audio files are tracked.
