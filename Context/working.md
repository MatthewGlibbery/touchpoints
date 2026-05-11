# Working — Current Session

## Current Objective

Session V — UI fixes and polish (10 items).

---

## Session V Plan

### V1 — Compare button same height as version selector
**Files:** `VersionBar.tsx`
- The outer pill container has `padding: 4px` + inner pill has `padding: 5px 10px` → total 9px top/bottom from container edge to text.
- Compare button is standalone (no container padding), currently `padding: '7px 12px'` → only 7px each side.
- Fix: change compare button to `padding: '9px 12px'`.

### V2 + V7 — Left panels below VersionBar
**Files:** `NodeInspector.tsx`, `ActorPanel.tsx`, `PhaseInspector.tsx`, `OverviewInspector.tsx`
- VersionBar is `top: 56`, height ≈ 38px → bottom edge ≈ 94px.
- All four panels currently have `top: 64`, which overlaps.
- Fix: change all to `top: 102` (≈ 8px gap below VersionBar).

### V3 — Onboarding vertical centering + bigger logo
**Files:** `OnboardingOverlay.tsx`
- Make the content layer use `justifyContent: 'center'` so the whole chat block is vertically centered.
- Wrap logo + subtitle + messages + input in a fixed-max-height centred container (`maxHeight: 'min(90vh, 740px)'`); messages area gets `flex: 1, minHeight: 0, overflowY: auto`.
- Increase logo: icon box `36×36` → `52×52`, inner SVG `18→26`, font-size `22→28`.
- Subtitle stays between logo and messages, shrink to `fontSize: 12`.

### V4 — Onboarding background: canvas dot grid with mouse proximity
**Files:** `OnboardingOverlay.tsx`
- Replace `AnimatedDotBackground` (wave animation) with a static-transform version of `DotBackground`:
  - Same `DOT_GAP = 16`, `DOT_BASE_RADIUS = 1`, `DOT_MAX_RADIUS = 1.55`, `EFFECT_RADIUS = 80`.
  - No ReactFlow `useStore`; use `tx = 0, ty = 0, zoom = 1` (identity transform).
  - Same mouse proximity smoothstep effect, same `--canvas-grid` CSS variable.
  - 60fps `requestAnimationFrame` loop.
- No wave animation; dots are static at rest, react to mouse proximity.

### V5 — Open existing projects from onboarding
**Files:** `OnboardingOverlay.tsx`
- On mount, load `loadAllBlueprints()` from `../../lib/storage`.
- If any saved blueprints exist, render a "Recent projects" row above the footer buttons.
- Each project: compact pill/card showing `blueprint.name` + relative date (`updatedAt`).
- Click → call `store.switchToBlueprint(id)` which loads and switches to canvas.

### V6 — Select card → smooth scroll to center
**Files:** `ActionNode.tsx`
- Normal mode card click (line 252): `setSelectedNode(action.id)` → also call `animateToNode(action.id)`.
- Import `animateToNode` from the store (already exists at line 844 of store).

### V8 — Editable text on overview cards (inline edit `labelAbstract`)
**Files:** `ActionNode.tsx`
- In overview mode card (lines 151-224): add `editingOverview` / `overviewDraft` local state.
- `onDoubleClick` on the card: enter inline edit mode (shows `<input>` replacing the `<p>` label).
- On blur/Enter: call `updateAction(action.id, { labelAbstract: draft.trim() || undefined })` and exit editing.
- On Escape: cancel.
- `updateAction` is already imported.

### V9 — Overview: each card opens its own view of the OverviewInspector
**Files:** `types/blueprint.ts` (store type), `blueprint.store.ts`, `ActionNode.tsx`, `OverviewInspector.tsx`
- Root cause: `selectedOverviewCell` is `{ actorId, phaseId }` — two cards in the same cell open identical content.
- Fix: add `actionId: string` to `selectedOverviewCell` type.
- Update `setSelectedOverviewCell(actorId, phaseId, actionId)` signature in store + call site in ActionNode.
- `OverviewInspector`: replace `repAction` computation (which used `overviewActionIds` heuristic) with a direct lookup of `selectedOverviewCell.actionId`. Header shows that specific action's `labelAbstract` / `label`.
- Steps tab, Pains/Opps/Questions tabs remain cell-aggregate (unchanged).
- Keep `App.tsx` condition `overviewMode && selectedOverviewCell ? <OverviewInspector /> : <NodeInspector />` as-is.

### V10 — Compare mode shows version name, not blueprint name
**Files:** `SplitCanvas.tsx`
- Line 49: `const baseLabel = blueprint.baseVersionName || blueprint.name || 'Current'`
  → `const baseLabel = blueprint.baseVersionName || 'Current'`
- The `blueprint.name` is the project name, not a version label; 'Current' is the correct fallback (matching VersionBar.tsx).

---

## Session V Progress — COMPLETE

- [x] V1 — Compare button height fix (`padding: '9px 12px'`)
- [x] V2+V7 — Left panels top position changed to `top: 102`, `maxHeight: calc(100vh - 118px)` (NodeInspector, ActorPanel, PhaseInspector, OverviewInspector)
- [x] V3 — Onboarding vertical centering (`justifyContent: 'center'`), bigger logo (52×52, font 28px), subtitle 12px
- [x] V4 — Onboarding canvas dot grid background with mouse proximity effect (matches DotBackground, no wave animation)
- [x] V5 — Recent projects section in onboarding (loaded from localStorage, shows up to 4, click → switchToBlueprint)
- [x] V6 — Card click → smooth canvas centering (ActionNode normal click calls `animateToNode`)
- [x] V8 — Double-click edits `labelAbstract` inline on overview cards
- [x] V9 — `selectedOverviewCell` now includes `actionId`; OverviewInspector header uses that specific action; each card in same cell opens distinct view
- [x] V10 — Compare mode base label uses `baseVersionName || 'Current'` (drops `blueprint.name` fallback)

---

## Session T Plan

### T1 — No add-steps/phases in overview mode
**Files:** `BlueprintCanvas.tsx`
- In `displayNodes` useMemo, extend the `presentMode` filter to also filter `emptyCell`, `columnInserter`, `phaseAdder` when `overviewMode` is true.
- `const base = (presentMode || overviewMode) ? nodes.filter(n => !EDITING.includes(n.type ?? '')) : nodes`

### T2 — More padding between nav arrows and icon+title row
**Files:** `NodeInspector.tsx`, `PhaseInspector.tsx`, `OverviewInspector.tsx`
- In header, increase bottom padding of the arrows/close row from `8px` → `0px` and top padding of icon+title row from `0` → `10px` (visual gap appears between the two rows).
- Apply same treatment to PhaseInspector and OverviewInspector headers.

### T3 — Zoom transition fix (zooms out before zooming in when entering overview)
**Files:** `BlueprintCanvas.tsx`
- Root cause: CSS node transitions (320ms) run simultaneously with fitView animation; ReactFlow's internal measurement may see partially-transitioned bounds.
- Fix: replace `requestAnimationFrame` with `setTimeout(fn, 360)` for the overviewMode fitView call. Nodes settle first, then fitView animates cleanly.
- Same fix for the `canvasView` fitView call.

### T4 — Arrow navigation → highlight + center canvas card
**Files:** `viewportBridge.ts`, `NodeInspector.tsx`, `blueprint.store.ts`
- Add `centerOnNode(nodeId: string)` to viewportBridge: calls `instance.setCenter(cx, cy, { zoom: currentZoom, duration: 350 })` using the rfInstance getter.
- Add `animateToNode(actionId)` store action: looks up rfNode position, computes center, calls `centerOnNode`.
- In `navigateToAction` inside NodeInspector: also call `animateToNode(targetActionId)` after `setSelectedNode`.

### T5 — Pains/Opps/Questions view: X close button + canvas click exits
**Files:** `ViewBar.tsx`, `BlueprintCanvas.tsx`
- In `ViewPanel` header (ViewBar.tsx): add an `IconButton` with X icon, positioned top-right (absolute). Calls `setCanvasView('edit')`.
- In BlueprintCanvas `onPaneClick`: if `canvasView !== 'edit'`, call `setCanvasView('edit')` and return (don't close inspector, let the view just exit).

### T6 — Consistent floating menu heights
**Files:** `VersionBar.tsx`, `ProjectBar.tsx`
- VersionBar container: `padding: '4px'` (from `3px`). Current pill: `padding: '5px 10px'` (from `4px 10px`). Plus button: `padding: '5px 7px'`.
- ProjectBar title button: `padding: '7px 12px'` (from `6px 12px`) to align with ModeBar height.
- Compare button: `padding: '7px 10px'` (from `5px 10px`).

### T7 — Compare mode: remove ModeBar
**Files:** `App.tsx`
- In the `compareMode && !presentMode` block, remove `<ModeBar />`.

### T8 — Compare mode: correct base version label
**Files:** `SplitCanvas.tsx`
- Line 24: `'Base'` → `blueprint.baseVersionName ?? blueprint.name ?? 'Current'`
- Line 43 in versionOptions: `{ id: null, label: 'Base' }` → `{ id: null, label: blueprint.baseVersionName ?? blueprint.name ?? 'Current' }`

### T9 — Rename base version independently from blueprint
**Files:** `types/blueprint.ts`, `blueprint.store.ts`, `VersionBar.tsx`, `SplitCanvas.tsx`
- Add `baseVersionName?: string` to Blueprint type.
- Add `renameBaseVersion(name: string)` store action: sets `blueprint.baseVersionName = name`, saves.
- VersionBar: Current pill label = `blueprint.baseVersionName || 'Current'`. Double-click → `setCurrentDraft(blueprint.baseVersionName || 'Current')`, commit → `renameBaseVersion(draft)` (NOT `renameBlueprint`).
- SplitCanvas: update `'Base'` references to use `blueprint.baseVersionName`.

### T10 — Auto cross-phase connectors
**Files:** `layout.ts`
- After the horizontal within-phase edges loop, add cross-phase edges:
  - For each actor, sort phases by `phase.order`.
  - For consecutive phase pairs, find the last action in phaseN (max order in its substeps) and the first action in phaseN+1 (min order).
  - Create a horizontal edge `x-${lastInPrev.id}-${firstInNext.id}` with same style as normal h-edges.
  - These are filterable via `removedEdgeIds` (same as other auto-generated edges).

---

## Session U Progress — **COMPLETE**

- [x] U1 — OverviewInspector overhaul: editable labelAbstract (inline, saves via updateAction), editable AI description (click-to-edit, saves via new updateCellDescription store action), TabBar (Steps/Pains/Opps/Questions with counts), Steps tab is existing list, Pains/Opps/Questions tabs aggregate from all cell actions (read-only, ViewPanel-style cards)
- [x] U2 — Compare mode pan/zoom sync: module-level sync bridge in SplitCanvas.tsx (\_rfA/\_rfB instances + \_syncing flag); onInit registers each instance; onMove broadcasts to other panel when compareSyncViewport=true; Sync toggle button in top bar (highlighted when active); compareSyncViewport field + setCompareSyncViewport action in store

---

## Session T Progress — **COMPLETE**

- [x] T1 — No add in overview (displayNodes filters emptyCell/columnInserter/phaseAdder when overviewMode)
- [x] T2 — Header padding (NodeInspector/PhaseInspector/OverviewInspector: 12px gap between nav row and title row)
- [x] T3 — Zoom transition fix (fitView delayed 360ms when entering overview; 50ms for canvasView change)
- [x] T4 — Arrow navigation → canvas center (viewportBridge: centerOnPoint via setCenter; store: animateToNode)
- [x] T5 — View close button (X in ViewPanel header) + canvas pane click exits to edit view
- [x] T6 — Consistent floating menu heights (VersionBar: container 4px, pills 5px 10px; ProjectBar: 8px 12px)
- [x] T7 — ModeBar removed from compare mode block in App.tsx
- [x] T8 — Compare mode base label uses blueprint.baseVersionName (SplitCanvas.tsx)
- [x] T9 — baseVersionName field on Blueprint; renameBaseVersion store action; VersionBar double-click renames base version (not blueprint name)
- [x] T10 — Cross-phase edges: last action in phaseN → first action in phaseN+1, per actor (layout.ts)

---

---

## Session W Plan — Storyboard Mode

### Overview
New "Storyboard" mode accessible from ModeBar. Uses blueprint + overview data to generate a visual storyboard with consistent anime-style characters. Style guide (base: "anime key visual, crisp linework, cel shading, vibrant colors, clean background") + per-actor character descriptions stored on the storyboard. Images generated via DALL-E 3 (requires `VITE_OPENAI_API_KEY` in `app/.env.local`). Text is AI-generated (Claude) but editable by the user.

### Architecture
- `storyboardMode: boolean` — canvas sub-mode flag (like presentMode); set via ModeBar "Storyboard" tab
- `Storyboard` stored on `Blueprint.storyboards[]`, persisted to LocalStorage
- AI pipeline: Claude → frame structure + captions → DALL-E 3 → image URLs
- Character consistency via detailed textual character descriptions in every prompt

### Data model additions (`types/blueprint.ts`)
```
StoryboardStyleGuide = { baseStyle, characterDescriptions: Record<actorId, string> }
StoryboardFrame      = { id, order, sceneDescription, imagePrompt, imageUrl?, caption, phaseIds, actorIds }
Storyboard           = { id, name, styleGuide, frames, createdAt, updatedAt }
Blueprint            += storyboards?: Storyboard[]
```

### Session W tasks

#### W0 — Types + store + plan (this entry) ✓
- `types/blueprint.ts`: add StoryboardStyleGuide, StoryboardFrame, Storyboard; add `storyboards?` to Blueprint
- `blueprint.store.ts`: add storyboardMode, storyboardGenerating, storyboardGeneratingFrameId, activeStoryboardId fields + all storyboard actions
- `working.md`: this plan

#### W1 — ModeBar + App routing
- `ModeBar.tsx`: add "Storyboard" tab (Film icon); sets/clears storyboardMode; highlighted when active; exits present/compare/overview modes
- `App.tsx`: render `<StoryboardView />` when storyboardMode; hide standard canvas UI; keep theme toggle visible

#### W2 — AI service (`lib/storyboard.ts`)
- `generateStyleGuide(blueprint, baseStyle)`: Claude generates per-actor visual character descriptions (name, age, appearance, clothing, style) → returns StoryboardStyleGuide
- `generateFrameStructure(blueprint, styleGuide)`: Claude analyzes phases/actions → returns StoryboardFrame[] with sceneDescription, caption, phaseIds, actorIds (no imagePrompt yet)
- `buildImagePrompt(frame, styleGuide, actors)`: constructs full DALL-E prompt = baseStyle + scene + character descs for present actors
- `generateImage(prompt)`: POST to OpenAI images API (DALL-E 3, 1792×1024) → returns URL; no-ops gracefully if no VITE_OPENAI_API_KEY

#### W3 — StoryboardView UI (`components/storyboard/StoryboardView.tsx`)
- **Top bar**: back arrow → `setStoryboardMode(false)`, blueprint name, storyboard selector dropdown, "Style Guide" button, "Generate" button (spinner while generating)
- **Filmstrip**: horizontal scrollable row of frame cards (280×170px image + caption); selected frame has blue border; "+" card at end to add blank frame
- **Detail panel** (below filmstrip, shown when frame selected): larger image preview (click → lightbox), editable caption textarea, scene description (read-only), actor pills, "↺ Regenerate image" button, "× Delete frame" button
- **Style guide panel** (modal/sheet): base style text (editable), per-actor character description textareas (editable); "Regenerate descriptions" button
- Loading states: shimmer placeholder while image generating; progress indicator "Generating frame N of M"

### Session W Progress — COMPLETE

- [x] W0 — Types: StoryboardStyleGuide, StoryboardFrame, Storyboard added to blueprint.ts; storyboards? on Blueprint
- [x] W1 — Store: storyboardMode, storyboardGenerating, storyboardGeneratingFrameId, activeStoryboardId; all CRUD + generate + regenerate actions
- [x] W1 — ModeBar: "Storyboard" tab with Film icon; active state; exitToEdit updated
- [x] W1 — App.tsx: routes to <StoryboardView /> when storyboardMode; hides canvas UI
- [x] W2 — lib/storyboard.ts: generateStyleGuide (Claude → per-actor character descs), generateFrameStructure (Claude → scenes+captions), buildImagePrompt, generateImage (DALL-E 3 via fetch, VITE_OPENAI_API_KEY)
- [x] W3 — StoryboardView: filmstrip, frame cards, detail panel (editable caption, scene, actor/phase pills, regen+delete), style guide modal, storyboard selector, empty state, generate button with progress

### What carries to Session X
~~- Frame drag-to-reorder~~
~~- Export storyboard as image sequence~~
~~- Custom prompt override per frame~~
~~- Prompt preview in style guide modal ("test" prompt generation)~~

All Session X items completed — see Session X Progress below.

---

## Session X Progress — COMPLETE

- [x] X1 — Frame drag-to-reorder: `draggable` on FrameCard + HTML drag events; `reorderStoryboardFrames` store action; drag-over shows dashed blue border
- [x] X2 — Export storyboard: "Export all" button in top bar (fetch→blob→download, window.open fallback); per-frame Download icon in FrameDetail (only when imageUrl present)
- [x] X3 — Custom prompt override: editable "Image Prompt" section in FrameDetail; saves via `updateStoryboardFrame`; `regenerateFrame` already uses `frame.imagePrompt`
- [x] X4 — Prompt preview in style guide modal: live-computed `buildImagePrompt` output in readonly textarea; frame selector when multiple frames; updates as guide fields are edited

---

## What's Done

**Sessions 1–S:** Full app built: canvas, AI gen, layout, versions, presentations, compare, overview mode, OverviewInspector (cell click → AI description + steps table).

**Session T:** UI polish (10 items) — overview mode filters, header padding, zoom transition, arrow nav, view close button, menu height consistency, compare ModeBar removal, base version label, baseVersionName type, cross-phase edges.

**Session U:** OverviewInspector overhaul (editable fields + 4 tabs with aggregated items); compare mode pan/zoom sync (module-level bridge, sync toggle, store field).

---

## Session Y Progress — COMPLETE

- [x] Y1 — Bug fix: EmptyCellNode click now calls `e.stopPropagation()` so the event doesn't bubble to the ReactFlow pane and close the inspector that `addAction` had just opened
- [x] Y2 — Renamed Storyboard → Journey Map: all UI strings, component export (`JourneyMapView`), default name (`'Journey Map 1'`), selector placeholder, empty state copy; internal type/field names (`storyboardMode`, `Storyboard` type) unchanged
- [x] Y3 — ModeBar: "Blueprint" → "Blueprints" + `Map` icon; "Personas" stub + `Users` icon; "Storyboard" tab merged with "Journey Maps" stub → single "Journey Maps" tab with `Film` icon; "Present" tab removed
- [x] Y4 — ViewBar converted to dropdown styled like ProjectBar (pill + chevron); dropdown lists Edit, Pains, Opportunities, Questions + divider + Present; "Presenting" label shown when in presentation context
- [x] Y5 — Journey Map presentation mode: "Present" button in JourneyMapView top bar + per-frame "Present" badge on selected filmstrip card; `JourneyMapPresenter` full-screen overlay with prev/next arrows, frame counter, caption, keyboard nav (←/→/Esc), X to close

---

## Session Z Progress — COMPLETE

- [x] Z1 — Journey Map images no longer expire: switched DALL-E `response_format` from `'url'` to `'b64_json'` in `lib/storyboard.ts`; images stored as `data:image/png;base64,...` in LocalStorage and persist across sessions. Added `imgBroken` state + `onError` handler to `FrameCard` and `FrameDetail` in `StoryboardView.tsx` so any previously-stored expired URLs gracefully show `<ImageOff>` icon instead of `alt` text.
- [x] Z2 — Badge click on action card opens NodeInspector to the correct tab: added `inspectorRequestedTab: string | null` field and `openInspectorToTab(id, tab)` / `clearInspectorRequestedTab()` actions to store; badge `<span>` pills in `ActionNode` converted to `<button>` elements with `onMouseDown` stopPropagation (prevents drag) + `onClick` calling `openInspectorToTab`; `NodeInspector` consumes the tab hint via two `useEffect`s (one on action change, one for same-node badge re-click).
- [x] Z3 — Severity/effort/type picker labels now appear above the description text field in PainPointItem, OppItem, QuestionItem (NodeInspector).
- [x] Z4 — Delete button only visible on Details tab: `NodeInspector` and `PhaseInspector` delete footers gated with `{activeTab === 'details' && ...}`.
- [x] Z5 — PhaseInspector header redesigned to match NodeInspector: `[← →]` group top-left, `[×]` top-right on the same row, then 12px padding, then phase name left-aligned — replacing the old "Phase" label row + centered name row with flanking arrows.
- [x] Z6 — NodeInspector arrow navigation now crosses phases: replaced single-phase filter with full `blueprint.actions` sort by `phase.order` then `action.order`; arrows walk all cards in timeline order across the entire blueprint.

---

## Open Questions

- **"New project" state cleanup** — blueprint stays in store memory until new one is submitted; visually fine but slightly impure.
- **AI portrait** — ActorPanel placeholder styled and ready; AI image generation not yet wired.

---

## Future Backlog

- **Semantic zoom in compare mode** — overview mode only applies to main BlueprintCanvas
- **SplitCanvas pan sync** — U2 above
- **AI portrait** — wire up image generation for actor avatars
