# Service Blueprint Tool — Spec

## 1. Core Goal

A structured, AI-assisted service blueprinting tool. Users provide raw input (transcript, voice, document) and receive a navigable, multi-resolution map of a service across actors and phases. Replaces freeform tools like Miro with a data model that has structure enforced by the tool.

**Problem it solves:** Current tools require manual layout, produce inconsistent output, force separate versions for different audiences, and are inaccessible to non-experts.

---

## 2. Architecture

### App structure
- Project root: `/Users/matthew.gibbery.adm/Documents/Work Claude/touchpoints/`
- App lives in `app/` subdirectory (Vite project)
- Context/docs in `context/`

### App modes
```
'onboarding' → chat overlay over blurred canvas
'canvas'     → full blueprint canvas + floating UI
'auth'       → email OTP login screen
```
Mode is stored in Zustand. App normally starts in `auth`; after login it loads the most recent blueprint or goes to `onboarding`. If the URL contains `?share=<token>`, auth is skipped — the blueprint is loaded via the `get-shared-blueprint` edge function and `isGuestView` is set to true.

### Canvas sub-modes (within 'canvas')
```
presentMode = false         → normal edit mode
presentMode = true          → read-only presentation/playback mode
presentationEditMode = false → normal
presentationEditMode = true  → slide editor mode (mutually exclusive with presentMode;
                               can be active while compareMode is true)
compareMode = false          → single canvas (BlueprintCanvas)
compareMode = true           → SplitCanvas rendered as canvas layer; other UI can overlay it
```

`presentMode` and `presentationEditMode` are mutually exclusive. `compareMode` can coexist with `presentationEditMode` (SlidePanel overlays SplitCanvas).

### Data flow
```
User input → AI (Claude tool use) → Blueprint (typed data model)
                                        ↓
                               Zustand store
                                        ↓
                               layout.ts (deterministic grid)
                                        ↓
                               ReactFlow nodes/edges
```

---

## 3. Stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite |
| Canvas | `@xyflow/react` v12 |
| State | Zustand (`subscribeWithSelector`) |
| Styling | CSS variables only (no Tailwind, no raw colors) |
| AI | Claude `claude-sonnet-4-6` via Supabase Edge Functions; tool use for blueprint generation |
| Persistence | Supabase Postgres (primary) + LocalStorage (offline cache/fallback) |
| Voice | Web Speech API (browser-native) |
| Icons | Lucide React |

---

## 4. Data Model

```typescript
// app/src/types/blueprint.ts

type Actor            = { id, name, color, order, bio?, goals?, portraitUrl? }
type Phase            = { id, name, order, substepCount?, description?, conditional?, conditionLabel? }
type ActionMedia      = { id, type: 'image'|'gif'|'video', url, caption? }
type Action           = { id, actorId, phaseId, label, labelDetailed?, labelAbstract?,
                          touchpointIds, painPointIds, opportunityIds, questionIds, order,
                          tags?,              // e.g. ['decision-point']
                          media?,             // ActionMedia[]
                          touchpointLabels?,  // per-action touchpoint tag selections
                        }
type Touchpoint  = { id, label, type: 'interface' | 'system' | 'human' }
type PainPoint   = { id, description, severity: 'low'|'medium'|'high', actionIds, aiGenerated?: true, guestContributed?: true, guestName?: string }
type Opportunity = { id, description, actionIds, painPointIds, effort?, aiGenerated?: true, guestContributed?: true, guestName?: string }
type Question    = { id, text, type?: 'technical'|'process', actionIds, aiGenerated?: true, guestContributed?: true, guestName?: string }
type EdgeMeta    = { label?, flowType?: 'sequence'|'dependency'|'decision' }
type CustomEdge  = { id, sourceActionId, targetActionId, sourceHandle?, targetHandle? }

type BlueprintVersion = { id, name, actions, painPoints, opportunities, questions }

type PresentationKeyframe = {
  id, label?,
  viewport: { x, y, zoom },
  versionId?,          // which blueprint version to display (null = base)
  canvasView?,         // 'edit'|'pain-points'|'opportunities'|'questions'
  selectedNodeId?,     // open NodeInspector for this action
  compareMode?,        // show SplitCanvas
  compareVersionIds?,  // [string|null, string|null] — versions for SplitCanvas
}

type Presentation = { id, name, keyframes: PresentationKeyframe[] }

type Blueprint   = { id, name, actors, phases, actions, touchpoints,
                     painPoints, opportunities, questions, createdAt, updatedAt,
                     edgeMeta?,         // Record<edgeId, EdgeMeta>
                     customEdges?,      // user-drawn edges
                     removedEdgeIds?,   // auto-generated edges the user deleted
                     touchpointTags?,   // blueprint-wide touchpoint tag library
                     versions?,         // named content variants
                     activeVersionId?   // which version is active (null = base)
                     baseVersionName?   // display label for the base version (default: 'Current')
                     presentations?,    // saved slideshows
                     overviewActionIds?,       // IDs of AI-selected representative actions
                     overviewCellDescriptions?, // Record<"${actorId}-${phaseId}", string> — AI descriptions per cell
                     storyboards?,      // Journey Map storyboards
                     statusLanes?,      // StatusLane[] — horizontal lanes between phase header and actor rows
                     timelineLanes?,    // TimelineLane[] — horizontal lanes above phase header
                   }

// Lanes: horizontal tracks outside the actor swimlane region. Each lane has
// segments anchored to one or more contiguous columns on the existing phase
// grid (column index = global, same as `phaseColumns.startCol + order`).
type LaneSegment   = { id, label, startCol, endCol, color? }
type StatusLane    = { id, name, color, order, visible, segments: LaneSegment[] }
type TimelineLane  = { id, name, color, order, visible, segments: LaneSegment[] }

// Storyboard / Journey Map types
type StoryboardStyleGuide = { baseStyle: string, characterDescriptions: Record<actorId, string> }
type StoryboardFrame      = { id, order, sceneDescription, imagePrompt, imageUrl?, caption, phaseIds, actorIds }
type Storyboard           = { id, name, styleGuide, frames, createdAt, updatedAt }

// Style presets — stored INDEPENDENTLY of Blueprint in localStorage key 'touchpoints-style-presets'
// Lives in app/src/lib/styleLibrary.ts; contains only baseStyle (not character descriptions)
type StylePreset = { id, name, baseStyle, createdAt }
```

### Version scope
`BlueprintVersion` stores only **content**: `actions`, `painPoints`, `opportunities`, `questions`. Structural data (`actors`, `phases`) and edge data (`edgeMeta`, `customEdges`, `removedEdgeIds`) live on the base `Blueprint` and are shared across all versions.

Version content is accessed via `getBlueprintForVersion(bp, versionId)` in `layout.ts`, which returns the blueprint with the active version's content merged in. When `versionId` is null or missing, the base blueprint is returned unchanged.

**Semantic zoom** is encoded in the data (`labelDetailed` / `label` / `labelAbstract` per Action). Overview mode renders only `overviewActionIds` actions in a simplified compact layout. The `labelAbstract` field (3–6 words, AI-generated) is used as the card label in overview mode.

---

## 5. Canvas Layout

### Grid constants (`app/src/lib/layout.ts`)
```
PHASE_WIDTH             = 280px
ACTOR_LABEL_WIDTH       = 160px
PHASE_HEADER_HEIGHT     = 72px
ACTION_NODE_WIDTH       = 220px
ACTION_NODE_HEIGHT      = 140px   ← minimum card height (text-only baseline)
ACTION_NODE_HEIGHT_MEDIA= 240px   ← kept for reference; actual height now estimated
ROW_HEIGHT              = 200px   ← minimum row height bound
ROW_HEIGHT_MEDIA        = 300px   ← kept for reference; actual row height now dynamic
H_CELL_PAD              = 30px    ← (PHASE_WIDTH - ACTION_NODE_WIDTH) / 2
OVERVIEW_CARD_HEIGHT    = 56px    ← fixed card height for all action nodes in overview mode
TIMELINE_LANE_HEIGHT    = 44px    ← per-row height for timeline lanes (above phase header)
STATUS_LANE_HEIGHT      = 56px    ← per-row height for status lanes (between phase header and actors)
```

### Vertical regions
The canvas is divided into stacked horizontal regions (Y offsets accumulate top-down):
1. **Timeline lane region** — `timelineRegionHeight = visibleTimelineLanes * TIMELINE_LANE_HEIGHT`. Stacks above phase header. 0 height if no visible timeline lanes.
2. **Phase header** — `PHASE_HEADER_HEIGHT` at `y = timelineRegionHeight`.
3. **Status lane region** — `statusRegionHeight = visibleStatusLanes * STATUS_LANE_HEIGHT`. Below phase header, above actors. 0 height if no visible status lanes.
4. **Actor region** — swimlanes + action cards at `y = timelineRegionHeight + PHASE_HEADER_HEIGHT + statusRegionHeight`.

`computeLaneOffsets(blueprint, isOverview)` returns `{ tLanes, sLanes, timelineRegionHeight, statusRegionHeight, phaseHeaderY, statusRegionY, actorRegionY }`. In overview mode lanes are hidden (both regions collapse to 0). All Y-positions in `blueprintToFlow` derive from `phaseHeaderY` / `actorRegionY`. Hit-testing in `getCellFromPosition` shifts the actor lookup by `actorRegionY`.

### Dynamic card and row heights
Card height is estimated per-action by `estimateActionHeight(action: Action): number`:
- Base: icon row + label + padding ≈ 64px, clamped to `ACTION_NODE_HEIGHT` minimum
- +44px if `labelDetailed` present (2-line description)
- +128px if `media` present (8px margin + 120px image)
- +49px if any badges present (divider + badge row)

Row height per actor is computed by `computeActorRowHeights(blueprint)`:
- Takes the maximum `estimateActionHeight` across all actions in that actor's row
- Adds 60px padding (30px top + 30px bottom)

All y-positions use `computeActorYOffsets`, which accumulates per-actor heights.
Per-action vertical padding: `Math.round((rowH - estimateActionHeight(action)) / 2)`.

**Overview mode layout:** `blueprintToFlow(blueprint, opts?)` accepts `{ overviewMode?: boolean }`. When true:
- All row heights are fixed at `OVERVIEW_CARD_HEIGHT + 60 = 116px`
- All action nodes use `OVERVIEW_CARD_HEIGHT = 56px` (instead of `estimateActionHeight`)
- Cards are centered in their rows; handles land exactly at the card border
- Only `overviewActionIds` actions are included (via `buildOverviewBlueprint`)

### Substep columns
Each phase can contain one or more **substep columns** (`substepCount` on Phase; derived from actions if not set). Each substep column is one `PHASE_WIDTH` unit wide. Phase headers span their full column count.

### Structure
- Actors define horizontal swimlane rows
- Phases define vertical column groups (one or more substep columns each)
- Actions are placed at `(actorId, phaseId, order)` intersections
- All structural nodes are `draggable: false, selectable: false` in ReactFlow
- **Pointer-events:** ReactFlow sets `pointer-events: none` on wrappers of non-draggable/non-selectable nodes. Any such node that must receive interaction (click, hover, mouse) must include `style: { pointerEvents: 'all' }` in its node definition in `layout.ts`. Applies to: `emptyCell`, `columnInserter`, `columnOverlay`, `phaseBoundary`, `phaseHeader`, `actorLabel`, `phaseAdder`.

### ReactFlow node types
| Type | Purpose | Interaction |
|---|---|---|
| `phaseHeader` | Phase label, top row | Click → opens PhaseInspector; drag anywhere → reorder phase (threshold 55%); double-click label → rename |
| `actorLabel` | Actor label, left column | Click anywhere to open ActorPanel or initiate row reorder (threshold drag); grip visual at left edge |
| `swimlane` | Colored row background | None |
| `action` | Primary interactive card | Click → inspector; double-click → inline edit (disabled in overview/present mode); drag to reposition (disabled in overview/present mode) |
| `emptyCell` | Click-to-add placeholder for empty grid cells | Click → `addAction`; hover shows "+ Add step to [Actor]" |
| `columnOverlay` | Invisible click-capture overlay per column (full column height, below cards/empty cells) | Click → `setSelectedColumnKey`; shows blue side borders + control bar (grip + delete ×) at top when selected and colCount > 1 |
| `columnInserter` | Insert a new substep column within a phase | Hover shows guide; click → `insertSubstep` |
| `phaseBoundary` | Drag handle between adjacent phases | Drag L/R → `movePhaseBoundary` |
| `phaseAdder` | "+" button after the last phase header | Click → `addPhase('New Phase')` |
| `statusLaneLabel` | Lane name in left column for status lane | Double-click → rename; hover → eye toggle + delete |
| `timelineLaneLabel` | Lane name in left column for timeline lane | Double-click → rename; hover → eye toggle + delete |
| `laneBody` | Click-to-add segment overlay spanning the lane row | Hover shows column highlight + `+`; click → `addStatusSegment`/`addTimelineSegment` at hovered column |
| `statusSegment` | Pill-style segment within a status lane | Drag body → move (snap to columns); drag edges → resize; double-click → rename label; hover delete (×) |
| `timelineSegment` | Dotted-line segment with centered duration label within a timeline lane | Same drag/resize/rename behaviors as statusSegment |

All node types are defined in `app/src/components/canvas/nodeTypes.ts` and shared between `BlueprintCanvas` and `SplitCanvas`.

`phaseAdder`, `columnOverlay` are filtered out in present mode (alongside `emptyCell`, `columnInserter`, `phaseBoundary`).

### Column overlay
`ColumnOverlayNode` receives `{ phaseId, order, colCount, height }`. One node per substep column, positioned at `(ACTOR_LABEL_WIDTH + colIndex * PHASE_WIDTH, PHASE_HEADER_HEIGHT)`, size `PHASE_WIDTH × totalCanvasHeight`.

- **z-index: 0**, placed before emptyCell/action nodes in layout array → emptyCell (same z-index, later DOM) wins in cell areas; overlay wins in blank margin/padding areas
- **Click** anywhere on the overlay → toggles `selectedColumnKey` (`"${phaseId}-${order}"`)
- **When selected**: subtle blue side borders + very light tint background
- **When selected + colCount > 1**: control bar at top (36px): grip (left) for threshold drag → `moveSubstep`; × button (right) → `deleteSubstep`
- Moves with phase drag: `coloverlay-${phaseId}-*` included in `displayNodes` `phaseDragOffset` check

### Phase header data
`PhaseHeaderNode` receives `{ phase, width, colCount }`. Click → `setSelectedPhase`; drag → `movePhase`; double-click label → rename. No column zone rendering — column selection is handled exclusively by `ColumnOverlayNode`.

### Action node drag
Action nodes use `dragHandle: '.action-drag-handle'`. The card div carries `className="action-drag-handle"`. Connection handles at the card edges have `pointer-events: all` (CSS-only) and never intercept the node-drag mousedown.

`onNodeDragStop` uses the **node center** (`position.x + WIDTH/2`, `position.y + estimateHeight/2`) for `getCellFromPosition` to ensure accurate drop-cell detection.

Action node dragging is disabled (`nodesDraggable={false}`) when `overviewMode` or `presentMode` is active.

### Multi-select lasso
`BlueprintCanvas` enables `selectionOnDrag={!presentMode}` with `panOnDrag={[1, 2]}` (middle/right pan), so left-drag on pane creates a rubber-band selection.

- `onSelectionChange` filters for `type === 'action'` nodes → updates local `selectedActionNodes` state + `multiSelectedNodeIds` store field
- When 2+ action nodes selected: closes NodeInspector/ActorPanel/PhaseInspector; renders `SelectionToolbar` inside `<ReactFlow>`
- `SelectionToolbar` uses `useStore(s => s.transform)` to convert node canvas positions → screen coordinates; positions itself above the bounding box with "X steps selected" + "Delete" button
- Delete shows `ConfirmDeleteModal`; on confirm calls `removeAction` for each selected ID

### BlueprintCanvas local node state
`BlueprintCanvas` maintains a local `nodes` state (`useState<Node[]>`) separate from the store's `rfNodes`. This is required for ReactFlow to visually update node positions during drag (controlled-flow pattern).

- `onNodesChange` applies ReactFlow's position change events to local state via `applyNodeChanges`
- `isDraggingRef` (ref, not state) is set `true` on action drag start and `false` on drag stop
- A `useEffect([storeNodes])` syncs store → local state, but is skipped while `isDraggingRef.current` is true

### displayNodes computation
`BlueprintCanvas` computes `displayNodes` via `useMemo` from local nodes + drag offset state. This is what is passed to ReactFlow.

- **Present mode filter**: `emptyCell`, `columnInserter`, `phaseBoundary`, `phaseAdder` nodes removed
- **Actor drag offset**: nodes belonging to `actorDragOffset.actorId` (label, swimlane, actions, empty cells) get `position.y += offsetY` and `transition: none`
- **Phase drag offset**: nodes belonging to `phaseDragOffset.phaseId` (header, actions, empty cells, inserters) get `position.x += offsetX` and `transition: none`
- **Action node drag**: the node matching `draggingNodeId` gets `transition: none`
- All other nodes are returned unchanged (CSS rule provides their transition)
- Dragged/offset nodes get `zIndex: 100`

### Reorder transition animation
CSS `transition: transform 320ms ease-in-out` is applied to all node type wrappers via class rules in `global.css` (`.react-flow__node-action`, `.react-flow__node-phaseHeader`, etc.). This animates non-dragged nodes smoothly to new positions on reorder. The `displayNodes` memo overrides with inline `transition: none` on cursor-following nodes, which takes higher specificity than the CSS rule.

### fitView on load
`BlueprintCanvas` uses the ReactFlow `onInit` callback (not the static `fitView` prop) to call `instance.fitView()` deferred by one `requestAnimationFrame`. This ensures nodes are measured before the viewport fits. A `didFitView` ref prevents double-firing.

A `useEffect` in `BlueprintCanvas` also calls `fitView({ padding: 0.12, duration: 700 })` whenever `canvasView` changes to a non-edit view (Pains / Opportunities / Questions), giving an animated zoom-to-fit of the full journey.

A `useEffect([overviewMode])` calls `fitView({ padding: 0.15, duration: 600 })` when entering overview mode (the simplified layout needs a zoom-to-fit).

The ReactFlow instance is stored in `rfInstanceRef` (local ref) for use by the view-change effect.

### Edges
- **Auto-generated** horizontal edges (sequential actions, same actor+phase), vertical edges (same phaseId+order, adjacent actors), and **cross-phase edges** (last action of phaseN → first action of phaseN+1, per actor; phases sorted by `phase.order`)
- **Custom edges** (`customEdges[]`): user-drawn via drag from connection handle; stored on Blueprint
- **Removed edges** (`removedEdgeIds[]`): auto-generated edges the user deleted; filtered out in `blueprintToFlow`
- Edge meta (`edgeMeta` keyed by edge ID): `flowType` ('sequence' / 'dependency' / 'decision') + optional label; dependency = purple, decision = amber dashed
- `ConnectionMode.Loose` and `edgesReconnectable` enabled
- **Z-index**: `.react-flow__edges { z-index: 1 }` raises the edges SVG layer above the nodes div within the ReactFlow viewport, so edges render at the same visual level as cards

### Canvas background
`DotBackground` is a custom `<canvas>`-based component (replaces ReactFlow's `<Background>`). Renders a dot grid drawn directly via Canvas 2D API; `position: absolute; inset: 0; pointer-events: none; z-index: 0`.

- **Grid**: `DOT_GAP = 16px`, dot positions computed from ReactFlow viewport transform `[tx, ty, zoom]` obtained via `useStore(s => s.transform)`
- **Radius scaling**: `r = base * zoom` — dots shrink/grow with viewport zoom, matching the natural scale of the canvas grid
- **Mouse proximity effect**: window-level `mousemove` listener tracks cursor position relative to the canvas. Dots within `EFFECT_RADIUS = 80px` (screen space) grow toward `DOT_MAX_RADIUS = 1.55` using smoothstep falloff: `r = zoom * (base + (max - base) * smoothstep(t))`
- **Colour**: reads `--canvas-grid` CSS variable once per theme change; redraws at 60fps via `requestAnimationFrame` loop
- Dot color and behavior respect light/dark theme

---

## 6. AI Service (`app/src/lib/ai.ts`)

- Model: `claude-sonnet-4-6`
- Method: tool use (`tool_choice: { type: 'any' }`)
- Tool: `create_blueprint` — Claude calls this with structured JSON matching the Blueprint schema
- Actor/phase name matching: actions reference actors and phases by name in the raw response; `normalizeBlueprintResponse()` resolves to IDs
- **Prompt constraint:** at most one action per actor per phase; AI instructed to pick the most representative step if multiple exist
- Actions carry `painPoints`, `opportunities`, and `questions` arrays (strings matching the top-level items by description/text); `normalizeBlueprintResponse` resolves these to IDs and back-fills `actionIds` on each item
- All AI-generated pain points, opportunities, and questions have `aiGenerated: true`; this flag is stripped from the data object by `updatePainPoint`/`updateOpportunity`/`updateQuestion` on any edit
- No streaming of the tool call JSON; status message shown while waiting

---

## 7. Zustand Store (`app/src/store/blueprint.store.ts`)

### State
| Field | Type | Purpose |
|---|---|---|
| `mode` | `'onboarding'\|'canvas'` | App screen |
| `canvasView` | `'edit'\|'pain-points'\|'opportunities'\|'questions'` | View filter |
| `blueprint` | `Blueprint\|null` | Source of truth (full data incl. all versions) |
| `rfNodes`, `rfEdges` | ReactFlow types | Derived layout, recalculated on every mutation |
| `selectedNodeId` | `string\|null` | Opens NodeInspector |
| `inspectorOpen` | `boolean` | |
| `selectedActorId` | `string\|null` | Opens ActorPanel |
| `actorPanelOpen` | `boolean` | |
| `dragTarget` | `{actorId,phaseId,order}\|null` | Nearest cell during action card drag |
| `draggingNodeId` | `string\|null` | Action being dragged (used to suppress transition) |
| `actorDragOffset` | `{actorId,offsetY}\|null` | Live Y offset during actor row drag; drives `displayNodes` |
| `phaseDragOffset` | `{phaseId,offsetX}\|null` | Live X offset during phase column drag; drives `displayNodes` |
| `selectedEdgeId` | `string\|null` | Opens EdgeInspector |
| `edgeInspectorOpen` | `boolean` | |
| `selectedColumnKey` | `string\|null` | Identifies selected column (`"${phaseId}-${order}"`); drives ColumnZone highlight |
| `dragOverInserterId` | `string\|null` | Inserter node near dragged card; triggers card-drop-to-new-column |
| `theme` | `'light'\|'dark'` | Persisted to localStorage |
| `activeVersionId` | `string\|null` | Active version; null = base content |
| `compareMode` | `boolean` | Side-by-side SplitCanvas active |
| `compareVersionIds` | `[string\|null, string\|null]` | Which two versions to compare |
| `isGuestView` | `boolean` | True when viewing via share link — hides all edit UI, disables interactions |
| `guestCanComment` | `boolean` | Whether this share token allows adding pains/opps/questions |
| `guestName` | `string\|null` | Name entered in GuestNamePrompt; stored in sessionStorage |
| `guestSessionId` | `string` | Unique session ID for this guest visit; stored in sessionStorage |
| `guestShareId` | `string\|null` | UUID of the `blueprint_shares` row (for writing `guest_comments`) |
| `guestBlueprintRowId` | `string\|null` | UUID of the `blueprints` row (for FK in `guest_comments`) |
| `shareToken` | `string\|null` | The share token from the URL (set when `isGuestView`) |
| `presentMode` | `boolean` | Read-only presentation/playback mode |
| `presentationEditMode` | `boolean` | Slide editor mode; mutually exclusive with `presentMode` |
| `activePresentationId` | `string\|null` | Which presentation is being edited/played |
| `currentKeyframeIndex` | `number` | Current slide index during playback |
| `lightboxUrl` | `string\|null` | URL shown in full-screen lightbox overlay |
| `multiSelectedNodeIds` | `string[]` | Action IDs currently selected via lasso (empty = no multi-select) |
| `overviewMode` | `boolean` | Overview (semantic zoom) mode active — manual toggle only via ZoomToolbar |
| `overviewGenerating` | `boolean` | AI overview generation in flight |
| `selectedOverviewCell` | `{actorId,phaseId,actionId}\|null` | Selected cell in overview mode; drives OverviewInspector |
| `compareSyncViewport` | `boolean` | Bidirectional pan/zoom sync active between SplitCanvas panels |
| `inspectorRequestedTab` | `string\|null` | Tab to auto-select when NodeInspector opens (set by badge click) |
| `storyboardMode` | `boolean` | Journey Map view active (replaces canvas) |
| `storyboardGenerating` | `boolean` | Full storyboard generation or `regenerateAllFrames` in flight |
| `storyboardGeneratingFrameId` | `string\|null` | Frame currently being image-generated; drives per-card spinner |
| `activeStoryboardId` | `string\|null` | Which storyboard is selected |
| `actorPortraitGenerating` | `string\|null` | `actorId` currently being portrait-generated; null when idle |
| `undoStack` | `Blueprint[]` | Up to 50 past blueprint snapshots for undo |
| `redoStack` | `Blueprint[]` | Up to 50 future snapshots for redo |

NodeInspector and ActorPanel are **mutually exclusive**: opening one always closes the other.

### Selector purity constraint (React 19 + Zustand 5)
Zustand 5 uses `useSyncExternalStore`. Inline selectors are new function references every render, so `getSnapshot` changes every render and React re-evaluates the snapshot. If the snapshot returns a **new object/array reference** on every call (e.g. `s.x?.y ?? []`, `s.x.filter(...)`, `{ a: s.a, b: s.b }`), React sees `Object.is(old, new) === false`, treats it as a store change, and schedules another synchronous re-render — causing an infinite loop and error #185. **Rule: selectors must return stable references.** Apply `?? []` / `?? {}` *outside* the `useBlueprintStore(...)` call.

### Version-aware mutation pattern
The store uses two factory-level closures (`vRead`, `vWrite`) so all content mutations are version-aware without per-mutation boilerplate:
- `vRead()` — returns `{actions, painPoints, opportunities, questions}` from the active version (or base if none active)
- `vWrite(bp, data)` — writes content data into the active version (or base if none active), returns updated Blueprint

**Content mutations** (updateAction, addAction, removeAction, insertSubstep, deleteSubstep, moveSubstep, all painPoint/opportunity/question/touchpointLabel mutations) route through `vRead`/`vWrite`.

**Structural mutations** (addActor, updateActor, moveActor, addPhase, updatePhase, movePhase, movePhaseBoundary, renameBlueprint) always operate on the base blueprint.

**Edge mutations** (updateEdgeMeta, removeEdge, addCustomEdge) always operate on the base blueprint (edges are shared across versions).

### Key actions
- `setBlueprint` — layout recalc + save + mode switch to canvas; restores `activeVersionId` from persisted blueprint
- `switchToBlueprint(id)` — load saved blueprint by ID; resets compareMode, presentMode, presentationEditMode
- `startFromScratch()` — creates a blank blueprint and resets ALL UI flags: compareMode, compareVersionIds, presentMode, presentationEditMode, storyboardMode, overviewMode, all panels/selection, undo/redo stacks
- `updateAction`, `addAction`, `removeAction`, `insertSubstep`
- `deleteSubstep(phaseId, order)` — removes actions in that column, shifts higher-order actions down, decrements `substepCount`; no-op if only one column remains
- `moveSubstep(phaseId, fromOrder, direction)` — swaps actions between two adjacent columns
- `renameBlueprint(name)` — updates `blueprint.name` on the base blueprint
- `addPainPoint/updatePainPoint/removePainPoint`
- `addOpportunity/updateOpportunity/removeOpportunity`
- `addQuestion/updateQuestion/removeQuestion`
- `addActor`, `updateActor`, `moveActor`, `addPhase`, `updatePhase`, `movePhase`, `movePhaseBoundary`
- `updateEdgeMeta`, `removeEdge`, `addCustomEdge`
- `addTouchpointTag`, `removeTouchpointTag`, `toggleActionTouchpointLabel`
- `createVersion`, `switchVersion`, `deleteVersion`, `renameVersion(versionId, name)` — inline rename of named version pill (double-click in VersionBar)
- `setSelectedNode`, `setSelectedActor`, `setSelectedEdge`, `toggleTheme`
- `setSelectedColumnKey(key)` — sets selected column; cleared on pane click
- `setMultiSelectedNodeIds(ids)` — set by BlueprintCanvas `onSelectionChange`; drives SelectionToolbar visibility
- `setDragOverInserterId(id)` — set during action card drag near column boundaries
- `togglePresentMode`, `toggleCompareMode`, `setCompareVersionIds`
- `setPresentationEditMode(on)` — enters/exits slide editor; when entering, auto-creates a default presentation if none exist
- `createPresentation(name)`, `deletePresentation(id)`, `renamePresentation(id, name)`, `setActivePresentationId(id)`
- `addKeyframe(presentationId, data)` — appends a keyframe capturing full UI state (`viewport`, `versionId`, `canvasView`, `selectedNodeId`, `compareMode`, `compareVersionIds`)
- `updateKeyframe`, `removeKeyframe`, `reorderKeyframes(presentationId, fromIdx, toIdx)`
- `setCurrentKeyframeIndex(idx)`
- `applyKeyframeState(kf)` — atomically applies a keyframe's full UI state: switches version (recalculates layout + saves), sets `canvasView`, `selectedNodeId`/`inspectorOpen`, `compareMode`/`compareVersionIds`
- `setLightboxUrl(url)` — sets `lightboxUrl` for the global lightbox overlay
- `setActorDragOffset(offset)` — set by ActorLabelNode on mousemove during row drag
- `setPhaseDragOffset(offset)` — set by PhaseHeaderNode on mousemove during phase drag
- `setOverviewMode(on)` — toggles overview mode; when `on`, recomputes layout via `blueprintToFlow(buildOverviewBlueprint(bp), { overviewMode: true })`; when off, recomputes normal layout
- `setSelectedOverviewCell(actorId, phaseId, actionId)` — set by ActionNode click in overview mode; drives OverviewInspector
- `updateCellDescription(actorId, phaseId, description)` — saves AI-generated or user-edited description into `blueprint.overviewCellDescriptions`
- `animateToNode(actionId)` — looks up rfNode position, computes center, calls `centerOnPoint` via viewportBridge; called on normal card click and inspector arrow navigation
- `renameBaseVersion(name)` — sets `blueprint.baseVersionName`, saves; called from VersionBar 'Current' pill double-click
- `openInspectorToTab(actionId, tab)` / `clearInspectorRequestedTab()` — badge-click routes NodeInspector to a specific tab (pains/opportunities/questions)
- `setCompareSyncViewport(on)` — toggles bidirectional pan/zoom sync in SplitCanvas; stored as `compareSyncViewport`
- `undo()` / `redo()` — pop from `undoStack`/`redoStack`; call `apply(prev/next)` to restore blueprint + recalculate layout; keyboard: Cmd+Z / Cmd+Shift+Z (or Ctrl+Y); blocked when cursor is in an input/textarea
- `addStatusLane(name, color?)` / `updateStatusLane(id, patch)` / `removeStatusLane(id)` / `reorderStatusLane(id, dir)` — manage `blueprint.statusLanes`. `updateStatusLane` patch can include `{ name, color, visible, order }`. `removeStatusLane` re-numbers `order` on remaining lanes. All call `pushHistory`.
- `addStatusSegment(laneId, startCol, endCol, label?)` / `updateStatusSegment(laneId, segmentId, patch)` / `removeStatusSegment(laneId, segmentId)` — segment CRUD for a status lane. Segments are clamped at render time if their cols exceed the current `totalColumns`. Patch typically `{ label, startCol, endCol, color }`.
- `addTimelineLane`, `updateTimelineLane`, `removeTimelineLane`, `reorderTimelineLane` — same shape as status lane equivalents, on `blueprint.timelineLanes`.
- `addTimelineSegment`, `updateTimelineSegment`, `removeTimelineSegment` — same shape as status segment equivalents.
- `generateOverview()` — calls Claude API to select representative actions (`overviewActionIds`) and generate `labelAbstract` per action; then calls `setOverviewMode(true)`
- `setStoryboardMode(on)` — enters/exits Journey Map view; exits present/compare/overview modes
- `createStoryboard(name)`, `deleteStoryboard(id)`, `setActiveStoryboard(id)`
- `updateStoryboardFrame(storyboardId, frameId, patch)` — partial update to a single frame
- `updateStoryboardStyleGuide(storyboardId, guide)` — saves new style guide AND rebuilds every frame's `imagePrompt` via `buildImagePrompt(frame, guide, actors)`
- `addBlankStoryboardFrame(storyboardId)`, `deleteStoryboardFrame(storyboardId, frameId)`
- `reorderStoryboardFrames(storyboardId, fromIdx, toIdx)`
- `loadBlueprintByShareToken(token)` — calls `get-shared-blueprint` edge function; sets `isGuestView`, `guestCanComment`, `guestShareId`, `guestBlueprintRowId`; loads guest comments via `loadGuestComments` on next tick
- `setGuestName(name)` — persists name to `sessionStorage`
- `addGuestPainPoint/Opportunity/Question(actionId, ...)` — adds item to in-memory blueprint with `guestContributed: true` + writes to `guest_comments` Supabase table
- `loadGuestComments()` — owner-only: fetches all `guest_comments` for this blueprint via FK embed and merges into in-memory blueprint; called automatically on boot and `switchToBlueprint`
- `generateStoryboard()` — full pipeline: generate style guide (Claude) → frame structure (Claude) → image prompts → images (DALL-E 3) sequentially
- `regenerateFrame(storyboardId, frameId)` — regenerates image for a single frame using stored `imagePrompt`
- `regenerateAllFrames(storyboardId)` — regenerates images for all frames sequentially; uses `storyboardGenerating` + `storyboardGeneratingFrameId` for progress tracking
- `generateActorPortrait(actorId)` — builds prompt from actor name+bio, calls `ai-storyboard` edge function (DALL-E 3), stores URL as `actor.portraitUrl`; `actorPortraitGenerating` tracks in-flight actorId

`removeAction` cascades: removes orphaned pain points / opportunities / questions (those with no other actionIds), removes custom edges involving that action (from base), and closes the inspector if it was open.

`deleteVersion` cascades: resets `activeVersionId` to null if the deleted version was active; removes the version from `compareVersionIds` if it appeared there.

Bootstraps from LocalStorage on module import.

---

## 8. Design System

### Rules
- **Never use raw colors — tokens only.** All colour references must use CSS variables.
- Light mode default; dark mode via `[data-theme="dark"]` on the root element, toggled by the theme button (bottom-left).

### Key tokens
```css
--canvas-bg, --canvas-grid
--surface-bg, --surface-bg-muted, --surface-bg-hover
--border-subtle, --border-strong
--text-primary, --text-secondary, --text-muted
--accent-primary (#3B82F6), --accent-primary-soft
--accent-success, --accent-success-soft
--accent-danger, --accent-warning
--action-primary-bg (#F97316)   ← orange, used for CTAs
--shadow-sm, --shadow-md
--radius-sm (6px), --radius-md (10px), --radius-lg (12px), --radius-pill (999px)
--transition-fast, --transition-normal, --transition-slow
```

### UI layout model
- Canvas is always primary / full-screen
- All controls float above it — nothing permanently docks or shrinks the canvas
- Floating zones (normal edit mode):

| Zone | Component | Contents |
|---|---|---|
| Top-left | ProjectBar | Blueprint name (editable inline, click to edit); project switcher chevron |
| Top-left (below ProjectBar) | VersionBar | "Current" (editable, double-click) + named version pills, fork (+), delete (×), Compare button; positioned `top: 56, left: 16` |
| Top-centre | ModeBar | Blueprints (Map icon) / Personas (Users icon, stub) / Journey Maps (Film icon → storyboardMode); no Present tab — Present is accessed via ViewBar dropdown |
| Top-right | ViewBar | Dropdown (pill + chevron, styled like ProjectBar): Edit / Pains / Opportunities / Questions + divider + Present; label shows 'Presenting' when in presentation context |
| Top-right (left of ViewBar) | LanesPanel | "Lanes" pill button (Layers icon, count badge); opens dropdown with two sections — Timelines and Statuses — each with add button + per-lane row (color swatch, name, ↑↓ reorder, eye visibility toggle, delete) |
| Left | NodeInspector | Opens on action click (normal mode); slides in from left; `App.tsx` renders `<OverviewInspector />` instead when `overviewMode && selectedOverviewCell` |
| Left | OverviewInspector | Replaces NodeInspector in overview mode; opens on action card click; editable `labelAbstract` + AI cell description; TabBar: Steps / Pains / Opps / Questions (cell-aggregated) |
| Left | ActorPanel | Opens on actor label click; slides in from left; mutually exclusive with NodeInspector |
| Bottom-centre | EdgeInspector | Opens on edge click; slides up from bottom |
| Bottom-centre | ZoomToolbar + MiniMap | Single pill `[− \| Details/Overview toggle \| +]`; center button toggles `overviewMode` (shows current mode label, highlighted blue when Overview active, spinner while generating); present mode: center shows fitView icon; ZoomToolbar inside ReactFlow at `bottom: 16` |
| Bottom-centre | SlidePanel | Shown when `presentationEditMode`; `bottom: 72`, `z-index: 55` |
| Bottom-centre | PresentationControls | Shown when `presentMode`; `bottom: 72`, `z-index: 60` |
| Bottom-left | Theme toggle | Sun/moon icon button; `position: fixed, bottom: 16, left: 16` in App.tsx; always visible; `border-strong`, `shadow-md` for canvas contrast |
| Bottom-left | DesignSystemModal toggle | Palette icon (dev tool); offset right of theme toggle at `left: 54` |

### Journey Map view (`storyboardMode`)
Full-screen replacement for the canvas when `storyboardMode: true`. Rendered as `<JourneyMapView />` in `App.tsx`; canvas and all floating canvas UI are hidden.

- **Top bar**: back arrow → blueprint, blueprint name, Present button (frames exist), Export all (images exist), journey map selector dropdown, Style Guide button, Generate button (spinner + frame progress while generating)
- **Filmstrip**: horizontally scrollable row of `240×(9:16)` frame cards; selected has blue border; drag-to-reorder (HTML drag); "+" add frame at end
- **Frame detail panel** (below filmstrip): image preview (click → lightbox), editable caption, read-only scene description, editable image prompt, actor + phase pills; Regenerate / Download / Delete buttons
- **Style Guide modal**: editable base style + per-actor character descriptions + live prompt preview
  - **Presets strip**: saved `StylePreset` pills below base style; click applies `baseStyle`; "Save as preset" inline input; × to delete; highlighted when active
  - **Footer**: Cancel | Save &amp; Regenerate All (only shown when frames exist + `VITE_OPENAI_API_KEY` set) | Save
  - "Save" rebuilds all frame `imagePrompt` strings from new guide (sync, no image calls); "Save &amp; Regenerate All" also triggers `regenerateAllFrames` after closing
- **JourneyMapPresenter**: full-screen overlay; keyboard ← / → / Esc nav; per-frame image + caption; frame counter + close button

### Style preset library
`StylePreset` entries are stored in localStorage key `touchpoints-style-presets` independently of any Blueprint. Presets carry only `baseStyle` (not character descriptions, which are actor-specific). CRUD via `app/src/lib/styleLibrary.ts` (`loadPresets`, `savePreset`, `deletePreset`). The Style Guide modal reads/writes presets directly — no store involvement.

### Conditional phases
A phase can be marked conditional (`phase.conditional = true`) via a toggle in `PhaseInspector` (Details tab). Conditional phases represent optional paths — e.g. a phase that only applies when a prior decision point goes a certain way.

- **PhaseHeaderNode**: amber tint background + dashed amber bottom border; "IF: {conditionLabel}" or "OPTIONAL" badge pill in the top-right corner
- **ColumnOverlayNode**: dashed amber side borders at rest; subtle amber diagonal stripe fill; amber selection highlight when selected
- `conditionLabel?: string` — optional descriptive text set in PhaseInspector; appears in the badge as "IF: …"
- `updatePhase` accepts `conditional` and `conditionLabel` in its patch type

### Status & timeline lanes
Status and timeline lanes live OUTSIDE the actor swimlane region — they are independent horizontal tracks that snap to the same column grid as actions.

- **Status lanes** render *between* the phase header and the first actor swimlane. Each visible lane is one row at `STATUS_LANE_HEIGHT (56px)`. Use case: tracking a status that progresses across the journey (e.g. "Public status: Available → Booked").
- **Timeline lanes** render *above* the phase header. Each visible lane is one row at `TIMELINE_LANE_HEIGHT (44px)`. Use case: durations between steps (e.g. "48 hours" with a dotted line spanning columns).

Each lane has `visible: boolean` — when `false`, the lane is omitted entirely from layout and the canvas reflows. Toggle via the LanesPanel eye icon or the canvas-side label hover button.

**Segments** are anchored by `(startCol, endCol)` inclusive on the global column index. Width = `(endCol - startCol + 1) * PHASE_WIDTH`. At render time segments are clamped to `[0, totalColumns - 1]`, so phase deletion never crashes — just visually clips.

**Status segment**: rounded pill with a 1.5px border in the lane color and a centered editable label. Drag body to move (snaps to columns); drag left/right edges to resize; double-click label to rename; hover-only × deletes.

**Timeline segment**: dot–dotted-line–dot pattern with the duration label centered above the line on a `--surface-bg` background. Same drag/resize/rename interactions.

**`laneBody` node** spans the full lane row beneath segments. Hovering shows a column highlight + `+` icon at the cursor's column; clicking adds a single-column segment at that position via `addStatusSegment` / `addTimelineSegment`.

**Lane management** is done in the floating LanesPanel (top-right, left of the ViewBar): two sections (Timelines, Statuses), each with an Add button and per-lane row (color swatch, editable name, reorder ↑/↓, visibility toggle, delete).

**Overview mode** hides all lanes (`computeLaneOffsets` returns empty arrays when `isOverview` is true) — the simplified zoom focuses on representative steps only.

### Confirmation modal (`ConfirmDeleteModal`)
All destructive delete actions show a `ConfirmDeleteModal` before executing. Applies to: deleting a step (NodeInspector), deleting an actor (ActorPanel), deleting a named version (VersionBar), deleting a presentation (SlidePanel), and deleting an individual slide (SlidePanel keyframe strip). The modal renders at `z-index: 9000` with a Trash2 icon, title, description, Cancel, and Delete buttons.

### Present mode
When `presentMode` is true:
- `emptyCell`, `columnInserter`, `phaseBoundary`, `phaseAdder` nodes filtered out before passing to ReactFlow
- `nodesDraggable={false}`, `nodesConnectable={false}`, `edgesReconnectable={false}`
- ActionNode, PhaseHeaderNode, ActorLabelNode guard their interaction handlers (click, dblclick, grip drag) with `presentMode` check
- **All floating UI hidden**: ProjectBar, ModeBar, VersionBar, ViewBar, ActorPanel, EdgeInspector hidden
- **NodeInspector shown** if `inspectorOpen` is true (a keyframe may have restored it to show action detail)
- `PresentationControls` shown at `bottom: 72`: ← slide / counter / → / Exit; Exit returns to `presentationEditMode`
- ZoomToolbar and MiniMap remain visible

### Slide editor mode (presentationEditMode)
When `presentationEditMode` is true and `presentMode` is false:
- Canvas remains fully interactive (pan, zoom, node interactions all active)
- `SlidePanel` appears at bottom: presentation selector pills; keyframe strip with canvas thumbnails; "Add slide" / "Play" / close
- `ModeBar` shown (Blueprints tab exits all presentation modes; Journey Maps tab exits to storyboard view)
- Overlays SplitCanvas when `compareMode` is also true (SlidePanel `z-index: 55` floats above SplitCanvas)

### Compare mode (SplitCanvas)
When `compareMode` is true, `SplitCanvas` renders as the canvas layer (no longer an early return — App.tsx renders it as the canvas background, allowing other UI to overlay). It renders two side-by-side read-only ReactFlow instances, each computing its own nodes/edges via `blueprintToFlow(getBlueprintForVersion(...))` — not from the store's `rfNodes`/`rfEdges`. Version selectors in the top bar allow changing which two versions are shown. "Exit compare" button in top-right.

A **Details/Overview** toggle button in the SplitCanvas top bar enables semantic zoom independently of the main canvas. Uses local `overviewMode` state in `SplitCanvas.tsx`. If `blueprint.overviewActionIds` is already populated it switches immediately; otherwise it triggers `generateOverview()` and auto-enables once generation completes. Both panels use `blueprintToFlow(buildOverviewBlueprint(bp), { overviewMode: true })`.

A **Sync** toggle button in the SplitCanvas top bar enables bidirectional pan/zoom sync between the two panels (highlighted when active). Sync is implemented via a module-level bridge in `SplitCanvas.tsx` (`_rfA`/`_rfB` instances + `_syncing` flag); each panel's `onMove` broadcasts to the other when `compareSyncViewport` is true.

When `compareMode && presentMode`: SplitCanvas is shown as canvas, PresentationControls floats above it; all other UI hidden.

### SlidePanel (`app/src/components/ui/SlidePanel.tsx`)
- Fixed: `bottom: 72px`, centred, `width: min(calc(100vw - 48px), 920px)`, `z-index: 55`
- **Header**: presentation selector pills (click to switch, double-click to rename, × to delete, + to create new); presentation delete shows `ConfirmDeleteModal`
- **Keyframe strip**: horizontal scrollable row of `156×88px` thumbnail cards + state badges
- **Thumbnail**: Canvas 2D drawing of simplified node layout (swimlanes + action colour rectangles) for the keyframe's version; viewport window overlaid as blue rectangle. Compare-mode slides show a left/right split thumbnail with a vertical divider.
- **State badges** below each thumbnail: version name (if not base), Compare indicator, view filter colour, inspector-open indicator
- **"Add slide"**: captures current viewport (`captureViewport()` from `viewportBridge`), `activeVersionId`, `canvasView`, `selectedNodeId` (if inspector open), `compareMode`, `compareVersionIds` — stored as a `PresentationKeyframe`
- **Drag-to-reorder**: HTML drag events (`draggable`, `onDragStart/Over/Drop`) reorder keyframes via `reorderKeyframes`
- Per-card play button (▶): starts `presentMode` from that slide
- Per-card delete button (×): shows `ConfirmDeleteModal` before calling `removeKeyframe`
- Click thumbnail: jumps camera to that keyframe's viewport and applies its state

### PresentationControls (`app/src/components/ui/PresentationControls.tsx`)
- Fixed: `bottom: 72px`, centred, pill shape, `z-index: 60`
- Shows: ← / (index / total) / optional slide label / → / divider / Exit
- On mount: calls `applyKeyframeState(kf)` + `animateToViewport(kf.viewport)` for the starting slide
- Navigation: calls `applyKeyframeState` then `animateToViewport`; compare→normal transition waits 350ms for `BlueprintCanvas` to remount before animating
- Exit: sets `presentMode: false, presentationEditMode: true` (returns to slide editor)

### Viewport bridge (`app/src/lib/viewportBridge.ts`)
Module-level singleton holding a `setter` and `getter` registered by `BlueprintCanvas.onInit`:
- `registerViewport(setter, getter)` — called in `BlueprintCanvas` `onInit`
- `animateToViewport(vp, duration?)` — calls `instance.setViewport(vp, { duration })`
- `captureViewport()` — calls `instance.getViewport()`
- `centerOnPoint(x, y, opts?)` — calls `instance.setCenter(x, y, opts)`; used by `animateToNode` store action
Decouples viewport control from React component hierarchy; works from any non-React context.

### VersionBar
- Fixed: `top: 56px`, `left: 16px`, `z-index: 49`
- Shows "Current" pill (the base blueprint) + one pill per named version; active version is highlighted
- Double-clicking "Current" opens an inline input that calls `renameBlueprint` on commit — renames the blueprint
- "+" button opens an inline input to name and create a new version (forks from current active state)
- Double-clicking a named version pill opens an inline input that calls `renameVersion(versionId, name)` on commit
- "×" appears on hover over any non-base version pill; shows `ConfirmDeleteModal` before deleting that version
- "Compare" button appears only when at least one named version exists

### ProjectBar
- Fixed: `top: 16px`, `left: 16px`, `z-index: 50`
- Blueprint name is rendered as a clickable text button; single click opens inline input → `renameBlueprint` on commit
- Chevron button opens the project switcher dropdown (separate from name editing)
- No theme toggle (moved to bottom-left)

### ModeBar
- Blueprints tab (Map icon): exits all canvas sub-modes (`storyboardMode: false, presentMode: false, presentationEditMode: false`)
- Personas tab (Users icon): disabled stub
- Journey Maps tab (Film icon): enters `storyboardMode`; highlighted when `storyboardMode` is true
- Present is not a ModeBar tab; it is accessed from the ViewBar dropdown

### NodeInspector
- Width: 420px; tabs: **Details**, **Pains**, **Opportunities**, **Questions**
- **Header layout**: Row 1 `[← →][spacer][×]` — prev/next arrows top-left, close button top-right, same horizontal line; 12px padding gap; Row 2 `[actor icon][step name]`
- Tab bar: not scrollable; divider scoped to content width (inside 18px horizontal padding), not full panel width
- Details tab: step name field, description textarea, decision-point toggle, touchpoints section, media section
- Media section: image/GIF items show 80px thumbnail (click → global lightbox via `setLightboxUrl`); video items show icon + URL
- **Global lightbox**: rendered in `App.tsx` (not inside NodeInspector); full-viewport overlay (`z-index: 9999`), no border-radius on image
- Delete button: full-width danger button at the bottom of the panel; **only visible on the Details tab**; shows `ConfirmDeleteModal` before removing
- Arrow navigation (`← →`) walks all actions sorted by `phase.order` then `action.order` — crosses phase boundaries; also calls `animateToNode` to center the canvas on the target card
- Visible in `presentMode` when `inspectorOpen` is true (a keyframe may have set it)

### Pain/Opportunity/Question pills (NodeInspector)
- **Severity picker** (pain points): all selected states use red (`#EF4444`) regardless of low/medium/high level
- **Effort picker** (opportunities): all selected states use green (`#22C55E`) regardless of level
- **Type picker** (questions): all selected states use amber (`#F59E0B`) regardless of type
- **Item X button**: `position: absolute; top: 8px; right: 8px` on each item card; circular `IconButton` (size 22); matches panel-close button pattern
- **AI badge**: items with `aiGenerated: true` show a small purple Sparkles + "AI" pill inline with the severity/effort/type picker row; the badge disappears as soon as any field is edited (store clears the flag on any update)

### Primitives (`app/src/ui/primitives.tsx`)
Shared: `Panel`, `IconButton`, `FieldBlock`, `Tag`, `TabBar`, `inputStyle` — all token-based, dark/light auto. `IconButton` accepts an optional `style` prop for positioning overrides.

### Animation keyframes (`global.css`)
`slideInLeft`, `slideInRight`, `fadeUp`, `scaleIn` + utility classes `.anim-slide-left` etc.

### DesignSystemModal (dev tool)
- Palette icon, bottom-left (at `left: 54` to clear theme toggle)
- Four tabs: Colors (live token editing), Spacing & Shape, Typography, Components preview
- Token changes write to CSS variables immediately; Reset Defaults restores spec values

---

## 9. Action Node Design

Card div (`className="action-drag-handle"`) with:
- `overflow: hidden` — clips edge-to-edge media image at border radius
- `1px solid var(--border-subtle)` border; selected: `var(--accent-primary)` + elevated shadow; view-highlighted: colored border + glow
- **Background**: normal state `var(--surface-bg)`; selected: `linear-gradient(rgba(59,130,246,0.12), rgba(59,130,246,0.12)), var(--surface-bg)`; view-highlighted: `linear-gradient(tint, tint), var(--surface-bg)` where tint is 22% opacity accent color. Layering preserves `var(--surface-bg)` as base so cards remain opaque in dark mode.
- **Actor icon box** (32×32, actor-color tinted bg): actor icon (User/Globe/Building2/Users cycling by order)
- **Decision point indicator**: amber Diamond icon next to label when tagged
- **Bold label** (13px, 600 weight)
- **Description** (12px, muted, 2-line clamp) — optional
- **Media preview** — first media item, edge-to-edge (negative side/bottom margins break out of 14px padding), max-height 120px; click on image/GIF → `setLightboxUrl` (opens global lightbox); sits flush at bottom of card when no badges, or above badges when badges present
- **Divider + badge pills**: divider (`1px var(--border-subtle)`) only shown when NO media is present; when media is present, badges appear with top spacing only (no divider line); badges only shown if count > 0: transparent bg, `1px solid var(--border-subtle)`, icon + count; red = pains, green = opps, amber = questions
- **Connection handles**: 12px circles at N/E/S/W edges; `opacity: 0` at rest; proximity-revealed via JS: a `mousemove` listener on the ReactFlow node wrapper sets `data-handle-near="<side>"` when the cursor is within 18px of an edge midpoint, CSS reveals only that handle at `opacity: 0.75`; on direct handle `:hover` or during active drag (`.connectingfrom` / `.connectingto`): `opacity: 1` + size grows to **16×16px**. `pointer-events: all !important` ensures handles receive events regardless of card stacking. **Do not use `.connectionindicator`** — in ReactFlow v12 that class is set on all connectable handles at idle ("valid connection point"), not only during an active drag.
- **Selected state**: driven by `selectedNodeId === action.id` read from the Zustand store — NOT from ReactFlow's `selected` node prop. This ensures the highlight follows programmatic navigation (inspector arrow buttons, keyboard nav) correctly and not just pointer-driven ReactFlow selection.

**Overview mode card** (when `overviewMode: true`): explicit `height: OVERVIEW_CARD_HEIGHT (56px)`, `box-sizing: border-box`; shows actor icon box + `labelAbstract || label` (2-line clamp); no description, badges, or media; cursor is `pointer`; click calls `setSelectedOverviewCell` → opens OverviewInspector; double-click enters inline edit mode for `labelAbstract` (saves via `updateAction`, Escape cancels); drag is disabled. The node height in the layout matches the card height exactly, so handles land at card borders.

View highlighting (Pains/Opportunities/Questions mode): non-matching cards dim to 30% opacity; matching cards get colored border + glow + tinted background overlay.

---

## 10. File Structure

```
app/src/
├── types/blueprint.ts
├── store/blueprint.store.ts
├── lib/
│   ├── ai.ts
│   ├── layout.ts
│   ├── storage.ts                 ← includes getShareToken, createShareToken, deleteShareToken
│   ├── viewportBridge.ts      ← module-level viewport setter/getter for presentation
│   ├── storyboard.ts          ← generateStyleGuide, generateFrameStructure, buildImagePrompt, generateImage
│   ├── styleLibrary.ts        ← StylePreset CRUD; localStorage key 'touchpoints-style-presets'
│   └── sample.ts              ← "Renew a Driving Licence" demo blueprint
├── components/
│   ├── auth/
│   │   ├── AuthScreen.tsx
│   │   └── GuestNamePrompt.tsx    ← "What should we call you?" modal; shown to guests with canComment
│   ├── onboarding/
│   │   └── OnboardingOverlay.tsx
│   ├── canvas/
│   │   ├── BlueprintCanvas.tsx
│   │   ├── DotBackground.tsx      ← custom canvas dot grid with mouse proximity effect
│   │   ├── SplitCanvas.tsx        ← side-by-side version comparison
│   │   ├── ZoomToolbar.tsx        ← single [− | Details/Overview | +] pill
│   │   ├── nodeTypes.ts           ← shared ReactFlow nodeTypes map
│   │   └── nodes/
│   │       ├── ActionNode.tsx
│   │       ├── ActorLabelNode.tsx
│   │       ├── ColumnInserterNode.tsx
│   │       ├── EmptyCellNode.tsx
│   │       ├── PhaseBoundaryNode.tsx
│   │       ├── PhaseAdderNode.tsx ← "Add Phase" button at end of phase header row
│   │       ├── PhaseHeaderNode.tsx
│   │       └── SwimlaneNode.tsx
│   ├── storyboard/
│   │   └── StoryboardView.tsx     ← JourneyMapView, FrameCard, FrameDetail, StyleGuideModal, JourneyMapPresenter
│   └── ui/
│       ├── ActorPanel.tsx
│       ├── ConfirmDeleteModal.tsx  ← shared confirmation dialog for all delete actions
│       ├── EdgeInspector.tsx
│       ├── NodeInspector.tsx
│       ├── OverviewInspector.tsx    ← cell click in overview mode; editable labelAbstract + AI description; 4-tab layout
│       ├── ViewPanel.tsx
│       ├── VersionBar.tsx         ← version tabs and compare trigger; top-left
│       ├── SlidePanel.tsx         ← slide editor (keyframe strip + thumbnails)
│       ├── PresentationControls.tsx ← present-mode playback bar
│       ├── primitives.tsx
│       └── DesignSystemModal.tsx
├── styles/
│   ├── tokens.css
│   └── global.css
└── main.tsx           ← mounts App; wraps in ErrorBoundary (friendly crash screen + Reload)
└── App.tsx            ← top-level mode router; renders canvas, onboarding, auth, lightbox overlay
```

---

## 11. Interaction Patterns

| Trigger | Result |
|---|---|
| Click action card | Opens NodeInspector (normal mode) or OverviewInspector (overview mode); also calls `animateToNode` for smooth canvas centering |
| Double-click action card | Inline label edit (Enter/blur saves, Escape cancels) — disabled in present mode; in overview mode, edits `labelAbstract` instead |
| Drag action card | Snaps to nearest `(actorId, phaseId, order)` cell on release — disabled in overview/present mode |
| Drag action card near column boundary | Card proximity activates column inserter; release inserts new substep column and places card there |
| Left-drag on empty pane (no key) | Creates rubber-band lasso selection of action nodes; `onSelectionChange` updates `selectedActionNodes`; SelectionToolbar appears when 2+ selected |
| Click pane | Deselects; closes NodeInspector, ActorPanel, EdgeInspector, clears selectedColumnKey |
| Click actor label | Opens ActorPanel (only if mouse did not drag past threshold — `didDrag` ref guards the click handler) |
| Drag actor label (anywhere) | Reorders actors (up/down); calls `moveActor`; threshold = 50% of row height; grip visual at left edge; entire row (label, swimlane, action cards, empty cells) visually follows cursor; other actor labels suppress hover highlight during drag |
| Double-click phase header label | Inline phase name edit |
| Drag phase header (anywhere) | Reorders phases (left/right); calls `movePhase`; threshold = 55% of phase width; entire phase column (header, action cards, empty cells, inserters) visually follows cursor |
| Click blank column body area (margin/padding around cards) | ColumnOverlayNode receives click → toggles `selectedColumnKey`; selected column shows blue side borders + control bar at top of body |
| Click grip in column control bar | `moveSubstep` threshold drag reorders column left/right; visible only when selected + colCount > 1 |
| Click × in column control bar | `deleteSubstep` removes that column (no-op if last column); visible only when selected + colCount > 1 |
| Click PhaseAdderNode | `addPhase('New Phase')` appended at end |
| Click edge | Opens EdgeInspector |
| Click image/GIF on action card | Opens global lightbox (`setLightboxUrl`) |
| Click badge pill on action card | Calls `openInspectorToTab(action.id, tab)` → opens NodeInspector to Pains / Opportunities / Questions tab |
| Draw new connection (drag from handle) | `onConnect` → `addCustomEdge` |
| Drag existing edge endpoint | `onReconnect` → `removeEdge` + `addCustomEdge` |
| Click empty cell | `addAction` at that cell |
| Hover/click column inserter | Shows guide line; click → `insertSubstep` |
| Drag phase boundary handle | `movePhaseBoundary` redistributes substep columns |
| Pan | Click-drag on empty canvas, or two-finger trackpad |
| Zoom | Trackpad pinch, mouse wheel, or ZoomToolbar |
| Click Details/Overview in ZoomToolbar center | Toggles `overviewMode`; Overview shows simplified fixed-height cards; Details restores normal layout; spinner shown while AI generates overview data |
| Click "Present" in ModeBar | Enters `presentationEditMode` (slide editor); auto-creates default presentation if none |
| Click "Blueprint" in ModeBar | Exits all presentation modes (`presentMode: false, presentationEditMode: false`) |
| Click version pill in VersionBar | Switches active version; layout recalculates |
| Double-click "Current" in VersionBar | Inline input → `renameBlueprint` (renames blueprint itself) |
| Click "+" in VersionBar | Inline input → creates named version (fork of current active state) |
| Hover version pill, click "×" | Shows `ConfirmDeleteModal`; confirms → deletes version, reverts to base if it was active |
| Click "Compare" in VersionBar | Sets `compareVersionIds` and opens SplitCanvas compare mode |
| "Exit compare" in SplitCanvas | Closes SplitCanvas; returns to regular canvas |
| Click blueprint title in ProjectBar | Inline input → `renameBlueprint` on commit |
| Switch view to Pains/Opps/Questions | `fitView({ padding: 0.12, duration: 700 })` to show full canvas |
| Click "Lanes" pill (top-right) | Opens LanesPanel dropdown with Timelines + Statuses sections |
| Click "+ Add" in a LanesPanel section | Creates a new lane (default name + cycled color) with `visible: true` |
| Click eye icon on lane row | Toggles `lane.visible` — hidden lanes are removed from layout |
| Click ↑/↓ on lane row | Reorders lane up/down within its kind (status or timeline) |
| Click trash on lane row | Deletes the lane and renumbers remaining lanes' `order` |
| Hover lane label on canvas | Reveals eye + delete buttons inline |
| Double-click lane label on canvas | Inline rename of lane name |
| Hover empty lane area on canvas | Shows column highlight at cursor — preview of where a new segment will land |
| Click empty lane area on canvas | Creates a single-column segment at that column |
| Drag segment body | Moves segment — snaps to whole columns; clamps to `[0, totalColumns-1]` |
| Drag segment left/right edge | Resizes segment by adjusting `startCol` or `endCol` (snaps to columns) |
| Double-click segment | Inline edit of segment label |
| Hover segment | Shows × delete button at top-right corner |
| Click theme toggle (bottom-left) | `toggleTheme`; persisted to localStorage |
| Reorder actor row or phase column | Non-moving nodes animate to new positions (`transform 320ms ease-in-out`) |
| Click "Add slide" in SlidePanel | Captures current viewport + `activeVersionId` + `canvasView` + `selectedNodeId` (if inspector open) + `compareMode`/`compareVersionIds`; appends as a new `PresentationKeyframe` |
| Click keyframe thumbnail in SlidePanel | Jumps camera to that keyframe's viewport; calls `applyKeyframeState` |
| Drag keyframe thumbnail in SlidePanel | Reorders slides via HTML drag events |
| Click ▶ on keyframe card | Enters `presentMode` from that slide |
| Click × on keyframe card | Shows `ConfirmDeleteModal`; confirms → removes that slide |
| Click "Play" in SlidePanel | Enters `presentMode` from current slide; animates to first keyframe viewport |
| Double-click presentation name pill | Inline rename of that presentation |
| Click "+" in SlidePanel header | Creates a new named presentation |
| ← / → in PresentationControls | Navigates to prev/next slide; calls `applyKeyframeState` + `animateToViewport`; compare→normal waits 350ms for canvas remount |
| "Exit" in PresentationControls | Returns to `presentationEditMode` (slide editor) |
| Any delete action (step/actor/version/presentation/slide) | Shows `ConfirmDeleteModal` before executing |

| Click "Share" in ProjectBar | Opens share dropdown; loads existing token from Supabase; shows generate/copy/revoke controls |
| Click "Generate share link" | Creates `blueprint_shares` row; displays shareable URL |
| Click "Copy link" | Copies `${origin}?share=<token>` to clipboard; brief "Copied!" confirmation |
| Click "×" in share dropdown | Revokes link by deleting `blueprint_shares` row |
| Open `?share=<token>` URL | Loads blueprint via `get-shared-blueprint` edge function; skips auth; `isGuestView: true` |
| First visit in guest view (canComment) | `GuestNamePrompt` modal — enter name or Skip |
| Click action card in guest view | Opens `NodeInspector` (read-only for owner fields; editable for own guest items) |
| Click "Add pain/opp/question" in guest view | Calls `addGuest*` store action → in-memory update + `guest_comments` Supabase insert |

All interaction handlers in ActionNode, PhaseHeaderNode, and ActorLabelNode are gated by `presentMode` — they are no-ops when presenting. `isGuestView` disables the same ReactFlow interaction props (`nodesDraggable`, `nodesConnectable`, `edgesReconnectable`, `selectionOnDrag`) and filters editing nodes from `displayNodes`. In guest view: `ModeBar` and `ViewBar` remain visible; `ProjectBar`, `VersionBar`, `ActorPanel`, `EdgeInspector`, and all edit-mode canvas controls are hidden.

---

## 12. Edge Functions

| Function | Auth required | Purpose |
|---|---|---|
| `ai-generate` | JWT | Anthropic proxy for `generateBlueprint` |
| `ai-overview` | JWT | Anthropic proxy for overview + cell description generation |
| `ai-storyboard` | JWT | Anthropic + DALL-E proxy; uploads images to Supabase Storage |
| `get-shared-blueprint` | None | Validates share token → returns `{ blueprint, canComment, shareId, blueprintRowId }` |

`get-shared-blueprint` uses the service role key internally. It checks `blueprint_shares.expires_at` and returns 410 if expired.

---

## 13. Environment

```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
Stored in `app/.env.local` (gitignored via `*.local` in `app/.gitignore`).

`ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are Supabase Edge Function secrets (set via `supabase secrets set`), not client env vars.

Template at `app/.env.example` (committed, no values).

### Supabase dashboard requirements
- **Authentication → Email Templates**: Both "Magic Link" and "Confirm Signup" templates must show ONLY the 6-digit OTP code (`{{ .Token }}`) — the magic link (`{{ .ConfirmationURL }}`) must be removed. Reason: magic links with a different domain than the sender domain are commonly flagged as phishing by spam filters and rewritten/stripped by corporate email scanners. The app verifies via OTP only (`verifyOtp({ type: 'email' })`); the magic link redirect is unused, so `sendOTP` does not pass `emailRedirectTo`.
- **Authentication → URL Configuration**: Site URL and Redirect URLs must include the deployed app URL (and `http://localhost:5173` for local dev)
- **Authentication → SMTP**: Custom SMTP provider required to avoid Supabase free-tier rate limit (2 emails/hour per project). Resend (`smtp.resend.com:465`, username `resend`) recommended.
- **Edge Functions deployed**: `ai-generate`, `ai-overview`, `ai-storyboard`, `get-shared-blueprint`

### Share link token generation
`blueprint_shares.token` is generated **client-side** in `storage.ts` (`generateToken()` — `crypto.getRandomValues` → URL-safe base64) and passed explicitly on insert. The DB column has no default. The Supabase PostgreSQL version does not support `encode(..., 'base64url')`.

### Hosting
- **Platform**: Vercel (static SPA deploy)
- **Root directory**: `app` (set in Vercel project settings — Vite project lives there, not repo root)
- **Build command**: `npm run build` (auto-detected)
- **Output directory**: `dist` (auto-detected)
- **Env vars in Vercel**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- No `vercel.json` needed — app uses `?share=` query params, not path routing, so no SPA rewrite rules required
- Every push to `main` auto-deploys

### Repository
- GitHub: `https://github.com/MatthewGlibbery/touchpoints` (public)
- Root `.gitignore` covers `.DS_Store`, `.claude/`, `node_modules/`, `*.local`

---

## 14. Non-Goals / Rejected Approaches

| Rejected | Reason |
|---|---|
| Freeform node placement | Product requires structured grid; placement rules are core |
| Custom canvas from scratch | ReactFlow handles pan/zoom/drag; months of work for no gain |
| Tailwind CSS | Style guide already defines a complete token system |
| Backend / database | LocalStorage sufficient for MVP; add later if needed |
| Semantic zoom rendering differences | Data model supports it; overview mode implemented manually — auto-switching on zoom removed as buggy |
| ReactFlow subflows for swimlanes | Pure coordinate layout in `layout.ts` is simpler and more predictable |
| SwimlaneBackground as plain div overlay | Doesn't follow viewport transform; must be a ReactFlow node |
| Emojis in UI | Replaced by Lucide React icons throughout |
| Left accent border on action cards | Removed in first design pass — visual noise, cluttered with badges |
| Touchpoint/pain/opportunity as canvas nodes | Removed — detail belongs in inspector panel, not floating on canvas |
| Chips/pills on action cards | Removed — replaced by compact badge pills |
| React state for handle hover visibility | Causes the card wrapper to intercept mouse events — CSS-only approach required |
| `position: relative` wrapper on ActionNode | Handles at card edges intercept mousedown, hijacking node drag — reverted to fragment |
| Version edge data (edgeMeta/customEdges per version) | Edges are shared across versions; per-version edge customisation deferred |
| `?? []` inside Zustand selectors | Creates a new array reference on every render. Zustand 5 wraps inline selectors in `useCallback`, so the `getSnapshot` changes every render; React 19's `useSyncExternalStore` tearing-check sees `Object.is([], []) === false` and schedules another synchronous re-render → infinite loop → error #185. Always place `?? []` / `?? {}` **outside** the selector: `useBlueprintStore((s) => s.x?.y) ?? []`. |
| Divider between media and badge pills on action card | Removed — media flows directly into badge area with spacing only |
| Fixed row heights (ROW_HEIGHT / ROW_HEIGHT_MEDIA as actuals) | Replaced by `estimateActionHeight`-based dynamic row heights that expand to fit content |
| Inline transition style on nodes from layout.ts | CSS class rules in global.css are more reliable for ReactFlow wrapper transforms; inline used only to suppress (transition: none) on cursor-following nodes |
| ReactFlow `<Background>` SVG dots | Replaced by custom canvas `DotBackground`; SVG pattern approach cannot support per-dot mouse proximity scaling |
| Canvas screenshot for slide thumbnails | html2canvas or similar not used; thumbnails are re-drawn from node data via Canvas 2D (simplified rectangles + viewport indicator) |
| `rfInstance` in Zustand store | Mutable object stored separately as module-level ref via `viewportBridge.ts`; avoids Zustand serialisation concerns |
| Early return for compareMode in App.tsx | Removed — SplitCanvas now renders as a canvas layer, allowing SlidePanel and PresentationControls to overlay it |
| Hover-based column zone reveal | Replaced by click-to-select (`selectedColumnKey`); hover was too easily triggered while dragging phases |
| Column zone only for multi-column phases | ColumnZone now renders for all column counts; single-column phases can still be selected (grip/delete are hidden since there's nothing to reorder/delete) |
| Pure transparent rgba fill for highlighted cards | Replaced by `linear-gradient(tint, tint), var(--surface-bg)` layering; pure rgba was nearly invisible in dark mode |
| `ColumnZone` component inside PhaseHeaderNode | Removed — column selection and grip/delete controls moved to `ColumnOverlayNode` in the column body area; phase header click now always opens PhaseInspector |
| `selectionOnDrag={false}` in BlueprintCanvas | Replaced by `selectionOnDrag={!presentMode}`; left-drag on pane creates rubber-band selection |
| `.connectionindicator` CSS hook for active-connection handle opacity | In ReactFlow v12 this class is set on all connectable handles at idle (means "valid connection point"), not only during active drag — use `.connectingfrom` / `.connectingto` instead |
| Auto-switching Overview/Details mode on zoom | Removed — zoom threshold detection (`onMoveEnd`) was buggy; overview mode is now manual-only via ZoomToolbar center button |
| Zoom percentage display in ZoomToolbar | Removed — ZoomToolbar is now a single `[− \| Details/Overview toggle \| +]` pill; no separate zoom % shown |
| Separate "Generating overview…" floating badge | Removed — generating state is now shown inline in the ZoomToolbar center button (spinner + "Generating…" label) |
| ReactFlow `selected` prop for ActionNode highlight | Replaced by store-derived `selectedNodeId === action.id`; ReactFlow's prop only updates on pointer interaction and lags behind programmatic navigation |
| Arrow key node movement (ReactFlow default) | Disabled via `disableKeyboardA11y={true}` on `<ReactFlow>`; cards are grid-constrained and should never be nudged by keyboard |
| DB-generated share tokens via `encode(gen_random_bytes(24), 'base64url')` | Supabase's PostgreSQL does not support the `base64url` encoding — token generated client-side via `crypto.getRandomValues` and passed explicitly on insert |
| Per-action `Action.statusTransition` field + `Blueprint.statuses` vocabulary + `'status'` canvasView + `StatusPanel` + status badge on action card + `StatusTransitionSection` in NodeInspector | Replaced by independent `statusLanes` (and `timelineLanes`) above/below the actor region. Status is now a horizontal track that snaps to the column grid, independent of any specific action — better matches how blueprints actually visualise status changes spanning multiple steps. The old per-action transition coupled status data to a single cell, which couldn't represent "available throughout phase X". |
