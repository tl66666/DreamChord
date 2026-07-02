# DreamChord AI Handoff

Last updated: 2026-07-02 (rev 5)

This file is the practical handoff for future agents and developers. Read it before changing the editor.

---

## Product Direction

DreamChord is a visual novel authoring tool for non-technical users. The user writes stories as:

1. Project
2. Chapter
3. Scene
4. Shot card
5. Runtime nodes and edges

The node graph is still the storage/runtime source of truth, but it is not the primary writing interface. The primary editor is the scene workspace: chapter tree on the left, shot cards in the middle, live preview on the right.

**Core value proposition**: Hide node-graph complexity behind a card-writing UI. The user writes "who says what"; the system builds the nodes and edges.

---

## Current Architecture

### Important files

| File | Role |
|---|---|
| `apps/web/src/editor/FlowEditor.tsx` | Main editor shell: chapter switching, save/preview, three-column layout, state management (Zustand single source) |
| `apps/web/src/editor/SceneTree.tsx` | Left column: chapter/scene list, add/delete/rename scene and chapter |
| `apps/web/src/editor/ShotCardEditor.tsx` | Middle column: shot-card authoring UI with inline AI buttons, card CRUD, manuscript import, quick append |
| `apps/web/src/editor/ShotCardItem.tsx` | Shot card display component: collapsed/expanded views, choice warning badges |
| `apps/web/src/editor/CardEditor.tsx` | Shot card edit form: background/character/dialogue/choice editing, branch target management |
| `apps/web/src/editor/MiniPreview.tsx` | Right column default: live card preview |
| `apps/web/src/editor/AssetPanel.tsx` | Right column (when open): asset library with built-in + uploaded materials |
| `apps/web/src/editor/AIAssistantPanel.tsx` | Right column (when open): AI assistant linked to selected card |
| `apps/web/src/editor/StoryFlowchart.tsx` | Flow view: galgame-style story flowchart with convergence visualization |
| `apps/web/src/editor/SceneCard.tsx` | Flowchart scene card component with branch/convergence badges |
| `apps/web/src/editor/ProjectHealthPanel.tsx` | Project health checker: 12-item diagnostic report |
| `apps/web/src/editor/sceneGraph.ts` | Scene/card/node conversion utilities, chapter numbering, type-safe accessors |
| `apps/web/src/editor/flowEditorUtils.ts` | Extracted FlowEditor utilities (autosave, convergence detection, etc.) |
| `apps/web/src/engine/converter.ts` | Converts saved React Flow nodes into runtime scenes (DFS traversal) |
| `apps/web/src/engine/runtime.ts` | Runtime state machine: next(), choose(), emit() |
| `apps/web/src/engine/types.ts` | RuntimeStory / RuntimeScene / WorldState type definitions |
| `apps/web/src/engine/characters.ts` | Character registry, sprite URL resolution |
| `apps/web/src/engine/demo.ts` | Official demo story RuntimeStory data |
| `apps/web/src/player/VisualNovelPlayer.tsx` | Visual novel player: typewriter, sprites, choices, audio |
| `apps/web/src/components/FeedbackProvider.tsx` | Global Toast/Confirm system replacing native alert/confirm |
| `apps/web/src/lib/libraryData.ts` | Local library defaults and localStorage keys |
| `apps/web/src/lib/safeJsonParse.ts` | Type-safe JSON.parse wrapper |
| `apps/server/src/routes/projects.ts` | Backend: project/chapter CRUD, asset upload, chapter delete |

### Deprecated files (do not use for new work)

- `apps/web/src/editor/WorkbenchPanel.tsx`
- `apps/web/src/editor/NodePalette.tsx`
- `apps/web/src/editor/PropertyPanel.tsx`

---

## State Management

### Single source of truth (Zustand)

The editor uses Zustand (`useEditorStore`) as the **single data source**. `FlowEditor` reads `store.nodes` and `store.edges` directly. All updates go through `store.setNodes()` / `store.setEdges()`.

> **Design decision (rev 5)**: Removed `useNodesState` / `useEdgesState` local copies and their sync effects. The previous dual-state-source pattern caused race conditions where local and global state could diverge. Now there is exactly one source.

### Key state flows

```
User edits card → ShotCardEditor.onUpdateGraph(nodes, edges)
                              ↓
                    FlowEditor.handleUpdateGraph()
                              ↓
                    store.setNodes() + store.setEdges()
                              ↓
                    triggerAutoSave() (debounced)
```

### Async state reads

In async functions (e.g., `handleSave`), use `useEditorStore.getState()` to read the latest state, since the component closure may be stale.

---

## Three-Column Layout

The editor uses a three-column layout:

- **Left (w-56)**: SceneTree — chapter/scene tree with add/delete/rename
- **Center (flex-1)**: ShotCardEditor — shot card list with inline editing and AI buttons
- **Right (w-80)**: Context-switching panel — defaults to MiniPreview, swaps to AssetPanel or AIAssistantPanel when their toolbar buttons are toggled. Each panel has a close button to return to preview.

The right panel is NOT a floating overlay. It replaces MiniPreview in the same column, preventing overlap issues.

---

## Scene And Shot Card Rules

Each scene is a group of nodes sharing `sceneGroupId`.

Each shot card compiles to:
- one background node (can be shared across consecutive cards)
- zero or more character nodes
- one dialogue/subtitle/choice node

Key data fields: `sceneGroupId`, `sceneCode`, `sceneTitle`, `chapterTitle`, `lensType`, `characterId`, `expression`, `position`, `action`, `choices`, `autoStageSpeaker`.

### Scene start node detection

Always use `findSceneStartNode(sceneGroupId, nodes, edges)` — never `nodes.find()`. The start node is defined as the node with no incoming edge from the same scene. Using array order causes bugs when text nodes precede background nodes.

### Shot card grouping

`groupNodesToCards` tracks `lastBg` so consecutive text nodes sharing the same background are grouped correctly. Do not reset `currentGroup` to `sceneNodes[0]`.

### Shared background handling

When multiple cards share a bg node:
- **Fast path 2** (bg-only change): Creates a new bg node instead of modifying the shared one.
- **Full rebuild path**: Finds the incoming edge before removing old char edges, removes it, rebuilds the chain without bg (since bg is shared), reconnects the incoming edge to the new chain's first node.

### Card insertion into existing chains (rev 5 fix)

When `addCard` or `quickAppendDialogue` adds a new card to a scene whose last node already has an outgoing edge (to the next scene), the new nodes must be **inserted into the chain**:

1. Find the outgoing edge from `lastSceneNode`
2. Remove it
3. Connect `lastSceneNode → newNodes[0]`
4. Connect `newNodes[last] → oldTarget`

The previous "skip if hasOutgoing" logic created orphaned nodes that DFS couldn't reach, causing choices and dialogue to silently disappear in the player.

### Chapter numbering

Chapter titles use Chinese numerals via `toChineseNumber(n)`: 一、二、...十、十一、...二十、二十一. The `normalizeChapterTitle(title, index)` function in FlowEditor.tsx converts old Arabic numeral titles to Chinese on display. `buildChapterList` in sceneGraph.ts also uses `toChineseNumber`.

### Chapter delete

Backend: `DELETE /:id/chapters/:chapterId` — protects last chapter (400 if only 1 remains).
Frontend: `handleDeleteChapter` in FlowEditor.tsx — confirms, deletes, refreshes project, switches to first remaining chapter.
UI: Trash icon on each chapter tab (top bar) and in SceneTree chapter header, visible when `canDeleteChapter` is true (more than 1 chapter).

### Scene transition (character exit)

When creating a new scene, `handleAddScene` checks the previous scene's last card with characters, carries them over with `action: 'hide'`, and generates a "——场景切换，角色退场——" narration card. This follows galgame convention of clearing the stage on scene change.

### Background defaults

New scenes start with empty background (`background: ''`). The preview shows a "请选择背景" placeholder. The bg dropdown has a "请选择背景..." first option. No default bg-starry or bg-classroom is forced.

---

## Choice / Branch System

### How choices work

1. A choice card creates a `choice` node with `data.choices: string[]`
2. Each choice option can have a `choiceEdge` with `sourceHandle: "choice-N"` connecting to a branch scene
3. The converter's DFS follows all outgoing edges, including choice edges
4. `resolvePlayableTargetId` follows the branch scene's node chain to find the first playable node (dialogue/subtitle/choice)
5. The runtime's `choose(index)` looks up `choiceTargets[index]` and jumps to that scene

### Choice target warnings (rev 5)

When a choice option has no target set:
- **CardEditor (expanded)**: Shows an amber warning badge "未设置去向" next to the option, plus a summary bar at the top: "N 个选项尚未设置分支去向"
- **ShotCardItem (collapsed)**: Shows an amber "未设置" label next to the option text, plus a header badge with count

This helps users spot incomplete branches at a glance, preventing the "flow ends directly" problem.

### Choice target management

- **"写这条分支" button**: Calls `onCreateBranch(index, choiceText)` → creates a new scene, removes old choice edge, adds new `choiceEdge`
- **"跳转到已有场景" dropdown**: Calls `onSetChoiceTarget(index, sceneId)` → connects choice to an existing scene
- **"断开" button**: Calls `onSetChoiceTarget(index, '')` → removes the choice edge
- **"前往编辑" button**: Calls `onNavigateToScene(targetSceneId)` → switches to the branch scene

### Runtime fallback (rev 5)

When `choose(index)` is called but the target is undefined/empty/not found, the runtime falls back to `moveToScene(sceneIndex + 1)` (next scene) instead of ending the story. This is more forgiving than the previous behavior of jumping to the end.

---

## Converter Details

### DFS traversal

`convertFlowToRuntime` does a DFS from `findStartNode` (node with no incoming edges). The `visited` Set prevents infinite loops and duplicate visits.

### Choice target resolution

```typescript
const targets = scene.choices.map((_, index) => {
  const edge = outEdges.find((item) => item.sourceHandle === `choice-${index}`)
  return edge?.target  // undefined if no choice edge
})
scene.choiceTargets = targets.map((target) =>
  target ? resolvePlayableTargetId(target) : undefined,
)
```

> **Rev 5 fix**: Removed the `|| outEdges[index]` fallback that incorrectly used normal edges as choice targets, causing all choices to point to the same scene.

### Node type mapping

| Editor node type | Runtime event | Playable? |
|---|---|---|
| dialogue | ON_NODE_VISUALIZE | Yes |
| subtitle | ON_NODE_VISUALIZE | Yes |
| choice | ON_BRANCH_SELECT | Yes |
| background | ON_REALITY_CHANGE | No (sets currentBackground) |
| character | ON_CHARACTER_SPAWN | No (updates onStage map) |

---

## AI Assistant

`AIAssistantPanel` receives `selectedCard` and `initialMode` props, linking AI operations to the currently selected shot card.

Modes: `polish`, `continue`, `choices`, `branchReplies`, `storyGraph`.

- **Empty text guard**: Polish mode shows "当前卡片没有文本，请先输入台词或旁白内容" if the card has no text.
- **No card selected**: Shows amber warning "未选中任何镜头卡" prompting user to select one.
- **Card-level AI buttons**: CardEditor has "AI 润色" and "AI 续写" buttons for dialogue cards; "AI 生成选项" and "AI 分支回应" for choice cards. Clicking sets `aiMode` and opens the AI panel.

AI providers are configured in Settings. Supports OpenAI-compatible APIs (GLM, DeepSeek, Kimi, OpenAI). The `BaseOpenAICompatibleProvider` base class unifies the interface; new providers only need `apiKey` and `baseUrl`.

---

## Asset Panel

Shows built-in library materials (backgrounds and characters) at the top, followed by uploaded project assets. The built-in section is collapsible. Clicking a built-in asset selects it for use.

---

## Story Flowchart

`StoryFlowchart.tsx` renders a galgame-style flowchart using div + SVG:
- Scenes grouped by chapter, laid out horizontally per chapter
- Normal connections: solid arrows
- Choice branches: dashed arrows with option text labels
- Convergence scenes: purple highlight with GitMerge icon badge
- Supports zoom (wheel), pan (drag), click-to-edit
- Choice nodes highlighted with pink border and branch count badge
- Supports drag-to-reorder scene cards
- Supports drag-to-create scene connections

### Convergence detection

`findConvergenceScenes(nodes, edges)` in `flowEditorUtils.ts` detects scenes that receive edges from multiple source scenes (branch merge points). The flowchart renders these with purple borders and badges.

---

## Project Health Panel

`ProjectHealthPanel.tsx` runs a 12-item diagnostic check:

1. Has nodes
2. Uses scene/shot-card structure
3. No invalid edges
4. Single start node
5. No broken choice exits
6. No empty text
7. No missing backgrounds
8. No missing characters
9. No orphaned nodes
10. No unreachable scenes
11. Has ending
12. Published status

---

## User Feedback System

`FeedbackProvider.tsx` provides `useToast()` and `useConfirm()` hooks:

- **Toast**: `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)` — auto-dismiss notifications
- **Confirm**: `const ok = await confirm(title, message)` — async confirmation dialog

All `alert()` and `confirm()` calls have been replaced (34 call sites across 9 files). **Never use native `alert()` or `confirm()` in new code.**

---

## Sprite Rules

### Generation phase: white background

AI generates characters with `flat white studio background`. White background is only for post-processing (background removal).

### Runtime phase: transparent PNG

Files in `apps/web/public/assets/characters/` must be transparent PNGs with backgrounds already removed.

### Post-processing pipeline

1. Generate with white background prompt
2. Remove background using remove.bg / Photoshop / rembg
3. Export as transparent PNG to `assets/characters/`
4. The checkered pattern in image viewers means "transparent", not a background

> Never use `transparent background` as a generation prompt — it produces fake checkered backgrounds, not real alpha transparency.

---

## Recent Iterations

### Rev 5 (current)

- **Choice bug fix**: Fixed orphaned choice nodes when `addCard`/`quickAppendDialogue` adds to a scene with an existing outgoing edge. New nodes are now inserted into the chain.
- **Converter fix**: Removed `|| outEdges[index]` fallback that caused all choices to point to the same scene.
- **Runtime fix**: `choose()` now falls back to next scene instead of ending story when target is unset/invalid.
- **Type fix**: `choiceTargets` changed to `(string | undefined)[]`.
- **Visual warnings**: Choice options without targets show amber warnings in both expanded and collapsed card views.
- **State management**: Removed dual state source (`useNodesState` + `useEdgesState`), Zustand is now the single source of truth.
- **End-to-end test**: Created and verified test script confirming choice/branch flow works end-to-end.

### Rev 4

- Chapter delete: Full stack implementation (backend API + frontend + UI).
- Chapter numbering: Unified to Chinese numerals.
- Chapter switch fix: `handleSwitchChapter` rewritten for formal + draft mode.
- Panel layout: AssetPanel and AIAssistantPanel moved into right column.
- Background defaults: New scenes start with empty background.
- Scene transition: New scenes auto-add character exit.
- AI assistant: Linked to selected card, empty text guard, card-level AI buttons.
- Story flowchart: New galgame-style flowchart replacing logic graph.

### Rev 3 and earlier

- Scene editing bug fixes: `findSceneStartNode`, `groupNodesToCards` lastBg tracking, updateCard fast paths, shared bg edge handling, `autoStageSpeaker` persistence.
- Convergence visualization (Batch 5): Purple highlighting in flowchart and scene cards.
- Code health: FeedbackProvider system, type-safe accessors, component splitting, Vite chunk optimization.

---

## Verification Checklist

```powershell
# Frontend
cd C:\Users\唐乐\Desktop\实训2\项目\apps\web
npx tsc --noEmit
npx vite build

# Backend
cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
npx tsc --noEmit
```

Manual smoke test:

1. Open `http://localhost:5173/editor/new`.
2. Create first scene — card auto-expands, bg dropdown shows "请选择背景...".
3. Type text, select background, add character — all work without card collapsing.
4. Add a choice card with options A and B — amber "未设置去向" warnings appear.
5. Click "写这条分支" for option A — new scene created, warning replaced with green target label.
6. Save and preview — choices appear, selecting option A jumps to the branch scene.
7. Create second scene — auto includes character exit from scene 1.
8. Click "素材库" — right panel shows assets, no overlap. Close returns to preview.
9. Click "AI助手" — right panel shows AI assistant with current card info.
10. Switch to "剧情流程图" — flowchart shows scene cards, connections, convergence points.
11. Chapter tabs show Chinese numerals. Delete button visible on each tab (if >1 chapter).
12. No alert popups during editing (Toast notifications only).

---

## Next Best Iterations

1. **Playwright regression test**: Automated browser test covering the choice/branch flow.
2. **Scene drag sorting**: In SceneTree, drag to reorder scenes, then rewrite `sceneCode`.
3. **Manuscript import preview**: Show generated cards before committing.
4. **Full-chapter import**: Split headings into scenes automatically.
5. **Batch background setter**: One-click apply a background to all cards in a scene.
6. **Asset Library search**: Search and tags across characters/scenes/templates.
7. **Import/export project bundle**: For sharing and backup.
8. **Mobile responsive**: Three-column collapse on narrow screens.
9. **Vitest unit tests**: For converter, runtime, and sceneGraph utilities.
10. **Tailwind darkMode**: Implement dark theme toggle.

---

## Avoid

- Editing generated `apps/web/dist` or `apps/server/dist` as source.
- Using white-background sprite files in runtime character paths.
- Using `transparent background` as an AI image generation prompt.
- Making AI mandatory for basic project creation.
- Letting preview read stale editor state without saving first.
- Using `opacity-0` + `group-hover:opacity-100` for critical action buttons — users can't find them.
- Forcing a default background on new scenes — let users choose.
- Using `useNodesState` / `useEdgesState` alongside Zustand store — causes race conditions.
- Using `nodes.find()` for scene start detection — use `findSceneStartNode()`.
- Using native `alert()` / `confirm()` — use `useToast()` / `useConfirm()`.
- Using `as Record<string, unknown>` for node data — use type-safe accessors from `sceneGraph.ts`.
- Using `JSON.parse` directly — use `safeJsonParse<T>(str, fallback)`.
