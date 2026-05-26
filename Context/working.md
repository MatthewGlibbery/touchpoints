# Working — Current Session

## Current Objective

**Session AN: Edge ordering + AI badges + UI restructure** — four workstreams covering connector polish, AI-generated indicator badges, navigation/menu rearrangement, and user avatar/profile area.

### Plan

#### AN.1 — Edge ordering at shared handles (connector cleanliness)
**Problem:** When two connectors leave the same handle (e.g. one goes straight right, one goes up-then-right), they can cross visually because the ordering is arbitrary.

**Fix:** In the handle-offset computation in `layout.ts`, sort edges at each shared handle so that edges going "up" (negative Y delta) are assigned a negative offset (placed above center) and edges going "down" or straight are assigned a positive offset (placed below center). This ensures the upward edge is physically above the straight/downward edge, preventing crossings.

**Implementation:**
- In the `handleGroups` post-processing pass, when assigning offsets, sort by the edge's target Y relative to source Y (ascending — most-negative-dy first → gets the most-negative offset → visually on top).
- For target handles, sort by source Y relative to target Y.
- Keep the "straight edge stays centered" priority — if one edge is perfectly straight (dy ≈ 0), it gets offset 0 regardless.

**Scope:** ~20 lines in `layout.ts` edge-offset section.

#### AN.2 — AI-generated badges on action cards
**Problem:** AI-generated pains/opps/questions exist in the data but the card badges don't indicate which are AI-generated vs user-created.

**Fix:** Add a small sparkle indicator (✨ or `Sparkles` icon) on the badge pill when ALL items of that type on the action are `aiGenerated: true`. If it's a mix, show a half-sparkle or just the count (no indicator). This gives a quick visual signal without cluttering.

**Implementation:**
- `ActionNode.tsx`: for each badge type (pain/opp/question), check if every linked item has `aiGenerated: true`. If yes, render a tiny `Sparkles` icon (size 8) next to the count.
- Need to read `blueprint.painPoints` / `opportunities` / `questions` from the store to check the flag. Currently ActionNode only has the IDs — need to pass the items or a flag in node data.
- Simplest: pass `aiPainCount`, `aiOppCount`, `aiQuestionCount` in the node data from layout.ts (avoids store reads in the hot render path).

**Scope:** ~15 lines in `layout.ts` (data enrichment), ~20 lines in `ActionNode.tsx` (conditional sparkle render).

#### AN.3 — ViewBar → left-side vertical icon rail
**Problem:** The edit/pains/opps/questions menu is a dropdown pill in the top-right. User wants it as a vertical icon rail on the left side, icons-only until hover reveals labels, with the active item highlighted.

**Current:** `ViewBar.tsx` — fixed top-right pill with dropdown.

**Target:** New `ViewRail.tsx` — fixed left side, vertically centered, column of icon buttons. Each button:
- Shows only the icon (Pencil / AlertCircle / Lightbulb / HelpCircle) at rest
- On hover: expands to show the label text (tooltip or inline expand)
- Active item: highlighted background + accent color
- Also includes Present and Comment mode toggles at the bottom of the rail (separated by a divider)

**Implementation:**
- Create `app/src/components/ui/ViewRail.tsx`
- Replace `<ViewBar />` with `<ViewRail />` in `App.tsx`
- Remove or keep `ViewBar.tsx` (can delete since it's fully replaced)
- Position: `fixed, left: 16, top: 50%, transform: translateY(-50%)`, z-index 50
- Style: vertical pill container matching existing design system (surface-bg, border-subtle, shadow-sm, radius-pill)

**Scope:** New component (~80 lines), App.tsx import swap, ViewBar.tsx deletion.

#### AN.4 — User avatar + profile area (top-right)
**Problem:** Top-right currently has ViewBar (being moved). User wants an avatar circle with initials, clicking opens profile/notifications, with a way to access collaborators + share.

**Target:** New `UserMenu.tsx` — fixed top-right:
- Circle with user initials (derived from `displayName` or `userEmail`), colored background
- Click → dropdown with:
  - User name + email
  - Notifications section (inline list or link to bell)
  - Divider
  - "People" row (Users icon) → opens CollaboratorsPanel
  - "Share link" row (Link icon) → opens share panel
  - Divider
  - Sign out

**Implementation:**
- Create `app/src/components/ui/UserMenu.tsx`
- Move `NotificationsBell` logic into the dropdown (or keep bell as a separate icon next to the avatar)
- Move `CollaboratorsPanel` trigger into the dropdown
- Move Share link trigger into the dropdown
- Remove these from `ProjectBar` (ProjectBar becomes just the title pill + project switcher)
- Mount `<UserMenu />` in `App.tsx` where `<ViewBar />` used to be (top-right)

**Scope:** New component (~120 lines), ProjectBar simplification, App.tsx wiring.

### Execution order
1. **AN.1** — ✅ Done. Edge offsets sorted by direction per handle side.
2. **AN.2** — ✅ Done. Sparkle badges on AI-generated items.
3. **AN.3** — ✅ Done. ViewRail on left side replaces ViewBar dropdown.
4. **AN.4** — ✅ Done. UserMenu avatar top-right with collaborators, notifications, sign out.

### Out of scope
- Real-time presence (showing other users' cursors) — the avatar circle prepares for this but actual multiplayer is a separate feature
- Rearranging connector order manually (deferred — AN.1's automatic sorting should handle most cases; if it doesn't we revisit)

---

**Session AM: Lane / phase polish pass — DONE (2026-05-20)** — six UX cleanups + LanesPanel elimination, all shipped this session. Detail of what changed in "Done in Session AM" below; original plan kept further down for reference.

### Done in Session AM (2026-05-20)

- **AM.2 — `ConfirmDeleteModal` portaled** to `document.body` via `ReactDOM.createPortal`. Fixes both the lane-delete (modal positioned by transformed ReactFlow node) and the phase-delete (modal positioned by `position: fixed` PhaseInspector slide-in panel) bugs in one change. All callers (Actor, Phase, Step, Version, Presentation, Slide, Lane) now darken the full viewport identically.
- **AM.1 — Lane label controls moved OUTSIDE the highlight on the LEFT.** New `LaneLabelControls` component renders Trash + color-picker swatch when `selectedLaneId === lane.id`. Trash uses the `ActorPanel` red-bg/red-border style (`accent-danger` color, `rgba(239,68,68,0.06)` bg, `rgba(239,68,68,0.15)` border). Color picker reuses `SegmentColorPicker` (parameterized with `popoverStyle`/`buttonContent`/`buttonStyleOverride` props) — opens a 6-swatch palette below the button; pick → `updateStatusLane` / `updateTimelineLane` `{ color }`.
- **AM.3 — Phase delete modal verified** — automatically resolved by AM.2.
- **AM.6 — Phase comment badge** — `PhaseHeaderNode` `<CommentBadge>` moved to `top: -8, right: -8, zIndex: 5` so it floats half-off the top-right corner, matching `ActionNode` placement. Header has no `overflow: hidden` so the badge clips correctly.
- **AM.4 — Lane body hover preview uses lane color.** `layout.ts` now passes `color: lane.color` into the `laneBody` node data. `LaneBodyNode` renders the hover/draw preview as `${color}1A` fill + `1px dashed ${color}` border + `<Plus>` in `color`.
- **AM.5 — Click-and-drag to draw multi-column segment.** `LaneBodyNode` rewritten to handle mousedown → window-level `mousemove`/`mouseup`/`keydown` listeners. Tracks `startCol` from `screenToFlowPosition`, updates `drawRange` on each move (clamped via `clampThroughOccupied` so the range stops one column before any occupied col). On mouseup: if `didDrag` is false → 1-col segment at `startCol` (preserves the click-without-drag UX); else → multi-col segment `[min, max]`. Escape cancels in-flight draw. Mousedown on an occupied col aborts immediately (no segment). Live preview reuses the AM.4 lane-color styling.
- **LanesPanel eliminated.** With recolor + delete now on the lane label and add via `timelineAdder` / `statusAdder` buttons, the floating top-right "Lanes" pill+dropdown is fully redundant. Removed `LanesPanel.tsx`, removed import + render from `App.tsx`. `lane.visible` flag is preserved in the data model but no longer surfaced — users delete lanes they no longer want.

### Behavior changes worth flagging
- **No more lane visibility toggle.** With LanesPanel gone there's no UI for `lane.visible: false`. The flag is still respected by `computeLaneOffsets` and existing data with `visible: false` lanes will continue to load as hidden — but new lanes are always created visible and can only be deleted, not hidden.
- **Lane recolor moved off the panel.** Color picker now lives next to the trash on the selected lane label. Reuses `SegmentColorPicker` with custom popover positioning so it pops down-left under the swatch button.
- **Drag-to-draw is the primary multi-col affordance** — segments larger than one column no longer require creating a 1-col then dragging the right edge. Single click still creates 1-col.

### Edge polish (added late in session)

- **Action node connection handles re-anchored to the visible card.** `ActionNode` now uses a `ResizeObserver` on the card ref to track the card's actual `offsetWidth`/`offsetHeight`, then renders each `Handle` with explicit `top`/`left`/`right`/`bottom` overrides — so left/right handles sit at the card's vertical center and bottom sits at the card's bottom-center, regardless of how tall the row is (rows size to the tallest card in them; smaller cards previously had handles floating in the row's padding).
- **Visible endpoint markers when an edge is selected.** `CommentedSmoothStepEdge` renders two SVG `<circle>` markers at the source/target coordinates when `selected && !dragLocked`. They have `pointer-events: none` so the underlying ReactFlow `EdgeAnchor` (rendered as a sibling by `EdgeWrapper` whenever `edgesReconnectable` is true) still captures the drag. Drag flows through `onReconnect` → new atomic `reconnectEdge` store action.
- **`reconnectEdge(oldId, src, tgt, srcHandle?, tgtHandle?)` store action.** Atomically (single `pushHistory`) removes the old edge (filter from `customEdges` if custom, else add to `removedEdgeIds`), creates the new custom edge with a fresh id, and migrates `edgeMeta[oldId] → edgeMeta[newId]` so the rewired edge keeps its label and `flowType` color. Wired into `BlueprintCanvas.onReconnect`. Old two-step `removeEdge + addCustomEdge` flow lost meta because the new edge had a different id.
- **Slidable edge labels.** `EdgeMeta.labelOffset?: number` (0..1, default 0.5) added to the type. Layout passes `data: { labelOffset: meta?.labelOffset }` on every edge (sequence, cross-phase, vertical, custom). `CommentedSmoothStepEdge` renders a hidden `<path>` for measurement, computes label position via `getPointAtLength(totalLength * offset)`, and supports drag-to-move: mousedown on the label → window-level mousemove projects cursor (in flow coords via `screenToFlowPosition`) onto the path with a coarse-then-fine scan → mouseup commits via `updateEdgeMeta(id, { labelOffset })`. Labels show `cursor: grab`/`grabbing`, a hover hint, and a faint shadow while dragging. Read-only modes (present, guest, comment, collaborator) disable the drag.

### Open question (revisit later)
- **Where (if anywhere) does lane visibility toggling belong?** Current state: `lane.visible` is in the data model + honored by layout, but has no UI surface (LanesPanel was removed). Trade-off to weigh:
  - Keep as-is: simpler model. If you want a lane gone, delete it. Re-adding is cheap.
  - Re-introduce a third button on the selected lane label (eye / eye-off, alongside trash + color). Cheap to wire — just expose `updateStatusLane({ visible })` / `updateTimelineLane({ visible })` on a button that uses the existing `iconBtnStyle` pattern.
  - Re-introduce a slimmer LanesPanel with ONLY visibility toggles (essentially a "what's hidden" recovery surface).
  Punted for now per user request — flagging here so it doesn't get lost.

### Verification — manual
- [ ] Click a status lane label → trash + color-picker buttons appear OUTSIDE the highlight on the LEFT (trash leftmost). Click outside → both disappear.
- [ ] Click trash → centered confirm modal with full-screen dark backdrop. Cancel and Delete both work.
- [ ] Click color swatch → 6-color popover opens below the button → pick → lane recolors immediately.
- [ ] Repeat for timeline lane, phase header (delete via PhaseInspector), action card → all delete confirmations look identical (centered, full backdrop).
- [ ] Hover an empty cell in a status lane → preview rectangle is the lane's color (e.g. blue lane → blue preview), not the global accent.
- [ ] Same for timeline lane.
- [ ] Click-drag from one column to another in an empty lane area → live preview spans the dragged range; release creates a single multi-column segment.
- [ ] Click without drag → still creates a 1-col segment.
- [ ] Drag through an occupied col → range clamps one before; never creates an overlapping segment.
- [ ] Phase comment badge floats half-off the top of the phase header (matches step card badges); click-to-open-thread still works.

---

## Original plan — Session AM (kept for reference)


#### AM.1 — Lane delete button: move outside the highlighted area + match actor delete styling
**Where:** `app/src/components/canvas/nodes/LaneNodes.tsx` (`StatusLaneLabelNode`, `TimelineLaneLabelNode`).

**Current:** When a lane is selected (`selectedLaneId === lane.id`), a small `Trash2` icon button appears at the right edge of the label, inside the tinted hover region (`right: -10`, vertically centered).

**Target:** When selected, render the trash button to the LEFT of the label (negative left, outside the `ACTOR_LABEL_WIDTH` highlighted region). Style to match the actor-panel delete button (`ActorPanel.tsx:218–245`):
- `color: var(--accent-danger)`
- `background: rgba(239,68,68,0.06)` (hover → `rgba(239,68,68,0.12)`)
- `border: 1px solid rgba(239,68,68,0.15)`
- Same `radius-md`, transition.
- Icon-only (no text, since the row is short).

**Implementation notes:**
- Pull the trash-button render block out of the `<div>` wrapper or set `position: absolute; right: 100% + 6px` (or `left: -36px`).
- Make sure `pointer-events: all` so it stays clickable even though it sits outside the lane label's highlight.
- Remove `transform: translateY(-50%)` if we anchor with `top: 50%`.

#### AM.2 — Lane delete modal: render via portal so it appears center-screen with the dark backdrop
**Where:** `app/src/components/ui/ConfirmDeleteModal.tsx`.

**Root cause:** ReactFlow node wrappers apply `transform: translate(...)`, which creates a containing block for `position: fixed` descendants. So `ConfirmDeleteModal` (using `position: fixed; inset: 0`) ends up positioned relative to the lane label node, not the viewport — backdrop covers only the lane row, modal sits to the left.

**Fix:** Render `ConfirmDeleteModal` through `ReactDOM.createPortal(..., document.body)`. This escapes any transform-induced containing block. One change in the modal file lifts the bug for every caller.

**Verification:** After the fix, the existing lane-delete confirm path (and AM.3 below) will both render full-screen with proper darken-everything-else backdrop.

#### AM.3 — Phase delete modal: same portal fix (currently overlays the PhaseInspector slide-in panel)
**Where:** `app/src/components/ui/PhaseInspector.tsx` (line ~490 hosts the existing `<ConfirmDeleteModal>`).

**Current:** `PhaseInspector` is rendered as a slide-in panel at `position: fixed; left: ...`. Because it's `position: fixed`, the inspector itself is positioned correctly. But there's something about the inspector's stacking context (or the modal being rendered inside the panel's `position: fixed` element) that lets the inspector content remain visible "behind" the modal in the wrong way — user reports it overlays the popout instead of darkening the whole canvas like actor delete does.

**Fix:** Once AM.2 is in (portaling `ConfirmDeleteModal` to `document.body`), this should be resolved automatically. No `PhaseInspector` change required.

**Verification:** Confirm phase-delete looks identical to actor-delete after AM.2.

#### AM.4 — Empty status cell hover preview uses the lane's color (not accent-primary)
**Where:** `app/src/components/canvas/nodes/LaneNodes.tsx` `LaneBodyNode` and `app/src/lib/layout.ts` (data passed into `laneBody` nodes).

**Current:** `LaneBodyNode` hover preview renders with `background: var(--accent-primary-soft)` and `border: 1px dashed var(--accent-primary)` for both status and timeline lanes.

**Target:** Use the lane's own color (semi-transparent fill + solid border) — e.g. `${lane.color}1A` for fill, `${lane.color}` for the dashed border. Plus icon adopts `lane.color`.

**Implementation notes:**
- `layout.ts` currently passes `{ laneId, kind, width, height, totalColumns, segments }` to `laneBody`. Add `color: lane.color`.
- `LaneBodyNode` reads `data.color` and uses it for the preview rectangle's `background` (with alpha) and the dashed border / `+` icon color.
- Keep the soft alpha low enough to not overwhelm the canvas grid (try `1A` ≈ 10%).

#### AM.5 — Click-and-drag to draw a status segment across multiple columns
**Where:** `app/src/components/canvas/nodes/LaneNodes.tsx` `LaneBodyNode`.

**Current:** Single click on an empty area of a lane body creates a 1-column segment via `addStatusSegment(laneId, col, col)` (or timeline equivalent).

**Target:**
- `mousedown` on an unoccupied col captures `startCol`.
- `mousemove` while down updates `endCol` to the hovered col; render a live preview rectangle spanning `[min(start,end), max(start,end)]` in the lane color (reuses the AM.4 styling).
- `mouseup` calls `addStatusSegment(laneId, min, max)` (or timeline) once.
- If `mouseup` fires at the same col as `mousedown` with no movement, behaves identically to today's click → 1-col segment (no regression).

**Edge cases:**
- Range overlapping an existing segment: clamp the range to stop one column before the nearest occupied col. If `startCol` itself is occupied, abort.
- Drag outside the lane body (off-canvas, into the actor region, into another lane row): clamp `endCol` to `[0, totalColumns - 1]`; treat mouse-leave as "freeze at last valid col" rather than canceling.
- Cancel via `Escape` → drop the in-flight drag without creating a segment.
- Deselect any selected segment / lane on the new mousedown so the toolbars don't flicker.

**Implementation notes:**
- Mirror the click-vs-drag pattern in `LaneNodes.tsx` `useDragHandle` (4-px threshold can be reused or simplified — for a draw operation the user is intentionally dragging from the start).
- Use `getColFromXSnap` (already imported) to map cursor X to column.
- Do the live preview as a single absolutely-positioned rectangle inside `LaneBodyNode`, using `lane.color` (passed in from AM.4).

#### AM.6 — Phase comment badge: half-off-the-top, like step cards
**Where:** `app/src/components/canvas/nodes/PhaseHeaderNode.tsx` (line 207 hosts the `<CommentBadge>`).

**Current:** Badge sits inside the header, using its own corner positioning that keeps it within the header's top edge.

**Target:** Match `ActionNode` placement — badge floats half off the top of the header (e.g. `top: -8, right: -8`, no clipping from the header's `overflow`).

**Implementation notes:**
- Verify the phase header's container doesn't have `overflow: hidden`. If it does, either remove it or move the badge render to a sibling node positioned via layout.ts at the phase header's top-right corner. Likely just a style tweak.
- `CommentBadge` accepts a `style` prop — pass `{ position: 'absolute', top: -8, right: -8, zIndex: 5 }`.
- Ensure `getAnchorPos` still resolves correctly so click-to-open thread anchors at the header midline (or update the anchor to the badge's screen position — whichever feels right; current behavior clicks back at the badge).

### AM execution order (suggested)
1. AM.2 (portal modal) — unblocks AM.1 + AM.3 visual verification.
2. AM.1 (move trash + restyle).
3. AM.3 (verify phase delete now darkens correctly — likely no code change beyond AM.2).
4. AM.6 (phase badge position) — small, isolated.
5. AM.4 (lane body hover color) — prep for AM.5's preview reuse.
6. AM.5 (click-drag to draw segment) — biggest piece, builds on AM.4.

### AM verification checklist
- [ ] Click a status lane label → trash button to the LEFT of the label, semi-transparent red fill + red border. Click outside → trash disappears.
- [ ] Click trash → modal appears centered with full-screen dark backdrop. Cancel and Delete both work.
- [ ] Repeat for timeline lane, phase header, action card → all delete confirmations look identical (centered, darkened backdrop).
- [ ] Hover an empty cell in a status lane → preview rectangle is the lane's color (e.g. blue lane → blue preview), not the global accent.
- [ ] Same for timeline lane.
- [ ] Click-drag from one column to another in an empty lane area → live preview spans the dragged range; release creates a single multi-column segment.
- [ ] Click without drag → still creates a 1-col segment.
- [ ] Drag through an occupied col → range clamps; never creates an overlapping segment.
- [ ] Phase comment badge floats half-off the top of the phase header (matches step card badges); click-to-open-thread still works.

### AM out-of-scope
- Touching the LanesPanel UI (eye, reorder, color picker stay where they are).
- Any backend / Supabase / RLS work.
- Status / timeline segment selection model — already in `selectedLaneSegmentId`, untouched.
- Replacing the click-to-add-status-segment in `LanesPanel` (adding via canvas drag is a parallel affordance, not a replacement).

---

## Previous Objective

**Session AL: Comment mode + collaborators + notifications** — introduce a dedicated commenting mode, a real collaborator system, and per-event email + in-app notifications. Plan finalised; implementation in progress across multiple sessions.

### Implementation progress (2026-05-18)

Slices 1–5b are all code-complete (see sections below). What remains is:
1. Apply the two SQL migrations + deploy the two new edge functions + set Resend secrets (commands listed under "Manual test plan" → Pre-flight).
2. Run through the manual test plan against live Supabase.
3. (Optional polish) the "Open follow-ups" items.

**⚠ Required before testing — apply BOTH migrations in order:**
1. `supabase/migrations/20260518_comments.sql` — creates `blueprint_collaborators`, `comments`, `comment_reactions`, `notifications` + RLS + `auth.users` reconcile trigger + `is_collaborator(uuid)` helper. Without it every comment query 404s.
2. `supabase/migrations/20260518_collaborator_blueprint_select.sql` — widens the `blueprints` SELECT policy so accepted collaborators can read invited rows. Without it the email CTA / bell deep-links land on the app root for collaborators.

**Done (this session — Slices 1–3 complete):**

- *Data layer (slice 1):*
  - `supabase/migrations/20260518_comments.sql` — all four tables + RLS policies + `is_collaborator(bp_id)` helper + `reconcile_collaborator_invites_trg` on `auth.users` insert/update.
  - Types in `app/src/types/blueprint.ts`: `Comment`, `CommentReaction`, `Collaborator`, `Notification`, `CommentAnchor`, `CommentAnchorType`, `CommentMention`, `COMMENT_REACTION_EMOJIS`.
  - `app/src/lib/comments.ts` — full CRUD wrappers (fetch/insert/update/delete for comments, reactions, collaborators, notifications) + `triggerNotifyComment` invoke + `inviteCollaboratorViaEdge` invoke.
  - `app/src/store/comments.store.ts` — Zustand slice with `comments`/`reactions`/`collaborators`/`notifications`, filter, open-thread anchor + screen position, plus mutation actions and pure selectors (`commentsForAnchor`, `rootCommentForAnchor`, `repliesForRoot`, `reactionsForComment`, `commentCountForAnchor`, `unreadNotificationCount`).
  - `app/src/lib/storage.ts` — exported `getBlueprintRowId` (was private).
  - `blueprint.store.ts` wiring: new fields `commentMode`, `blueprintRowId`; `setCommentMode(on)` enforces mutual exclusion with present/presentationEdit/storyboard modes and closes inspectors. `setBlueprint`/`switchToBlueprint` resolve the blueprint row id and call `useCommentsStore.loadAll(rowId, userId)` on load. `signOut` and `setStoryboardMode` clear comment state.

- *Comment mode core + action anchor (slice 2):*
  - `app/src/styles/global.css` — `body.comment-mode` cursor (inline SVG message-circle), hover outline+glow rules for action/phase/actor/lane/segment nodes, suppression of action handles, `.comment-thread-popover`, `.comment-badge`, `.comment-reaction-pill` styles.
  - `app/src/components/ui/CommentBadge.tsx` — count pill (resolved variant); always visible when comments exist; click opens thread at the anchor position.
  - `app/src/components/ui/CommentThread.tsx` — fixed popover (`z-index: 9500`), header with anchor label + Resolve/Reopen toggle + close, scrollable body listing root + replies, per-comment reaction pills + `+` picker (6 emojis from spec), composer (Cmd/Ctrl+Enter to post). Closes on Escape or pointer-down outside.
  - `App.tsx` — `<CommentThread />` mounted globally; body class effect toggles `comment-mode`.
  - `ViewBar` — new "Comment" / "Exit comment mode" entry in dropdown; pill label flips to `Commenting` when active.
  - `BlueprintCanvas` — `commentMode` extends the gating set: `nodesDraggable`, `nodesConnectable`, `edgesReconnectable`, `selectionOnDrag` all `false`; editing-only nodes filtered from `displayNodes`.
  - `ActionNode` — renders `CommentBadge` (top-right, `-8`/`-8`); click in comment mode opens thread instead of inspector; double-click is a no-op in comment mode. Overview-mode click likewise routes to thread.

- *Other anchors (slice 3 — partial):*
  - `PhaseHeaderNode` — comment-mode click opens thread on `{type: 'phase', id}`; drag/select gated; badge bottom-right.
  - `ActorLabelNode` — comment-mode click opens thread on `{type: 'actor', id}`; drag gated; badge right edge.

- *Slice 3 finished (later in same session):*
  - **Edge anchor**: new `app/src/components/canvas/edges/CommentedSmoothStepEdge.tsx` — wraps `getSmoothStepPath` + `BaseEdge` and renders existing string label + a `CommentBadge` at the path midpoint via `EdgeLabelRenderer`. Registered in `nodeTypes.ts` as `edgeTypes.smoothstep` (overrides default), wired into `BlueprintCanvas` and `SplitCanvas` via `edgeTypes={edgeTypes}`. `BlueprintCanvas.onEdgeClick` routes edge clicks to `openThread({type:'edge', id})` in commentMode instead of `setSelectedEdge`. `EdgeInspector` early-returns null in commentMode.
  - **Lane anchors**: `LaneNodes.tsx` — `StatusLaneLabelNode`, `TimelineLaneLabelNode`, `StatusSegmentNode`, `TimelineSegmentNode` all gain (a) commentMode added to `readOnly` so drag/rename/select disable, (b) outer-div `onClick` that opens the appropriate comment thread when in commentMode, (c) `CommentBadge` rendered at corner positions. `LaneBodyNode` gates its add-segment click on commentMode.
  - **CommentFilterBar**: new `app/src/components/ui/CommentFilterBar.tsx` mounted in `App.tsx`; visible only in commentMode. Pills: All · @Me · Unresolved · Resolved · Detached, each with thread-count badge. Drives `useCommentsStore.filter`.
  - **Filter applied to badges**: `CommentBadge` reads `filter` + `userId` + `blueprint`; computes `hiddenByFilter` per-anchor (resolved/unresolved use root.resolvedAt; me uses authorUserId/mentions; detached uses `isAnchorDetached`).
  - **Filter helpers in store**: `comments.store.ts` gains `buildAnchorRegistry(bp)`, `isAnchorDetached(anchor, registry, actionIds)`, `filterComments(...)`. Edges resolve via `[hxv]-{src}-{tgt}` regex against the action-id set; custom edges register directly.
  - **Read-only enforcement**:
    - `App.tsx` keyboard handler — when `commentMode || isGuestView`, blocks undo/redo (Cmd+Z, Cmd+Shift+Z, Cmd+Y) and Backspace/Delete (lane segment delete).
    - `LanesPanel` early-return now includes `commentMode` (panel hidden).
    - `NodeInspector` introduces `editLocked = isGuestView || commentMode`; replaces `isGuestView` in label/detail input gates and add-button branches; passes `commentMode` prop into `PainPointItem`/`OppItem`/`QuestionItem` (their `readonly = (isGuestView && !item.guestContributed) || commentMode`); delete-step button hidden when editLocked.
    - `ActorPanel`, `PhaseInspector` — added `editLocked` and gated name/bio/goals/description/condition inputs (readOnly + cursor); delete buttons hidden when editLocked. `PhaseInspector.generateDescription` button hidden too.
    - `EdgeInspector` — early-return null when commentMode (edges open thread instead).
    - `VersionBar` — `editLocked` short-circuits "Current" rename, "+" fork button hidden, named-version `startEdit` no-ops, hover × button hidden.
    - `ProjectBar` — `startEditTitle`, `commitTitle`, `handleNew`, `handleDelete` all early-return on editLocked; title button cursor reflects lock state.

**Manual test path:** Apply the SQL migration → log in as the owner of a blueprint → toggle ViewBar → "Comment" → click an action card / phase header / actor label / lane label / lane segment / edge → composer opens at the right anchor → post → badge appears at correct position → click badge from any mode → thread reopens with reactions + Resolve toggle. While in commentMode: title rename / version pills / lane panel / delete buttons / undo / redo all disabled.

### Slice 4 (done — collaborators + mentions)

- *Edge function:* `supabase/functions/invite-collaborator/index.ts` — JWT-required, verifies caller owns the blueprint via service-role client, looks up an existing `auth.users` row by email (so an already-registered invitee is auto-accepted), upserts a `blueprint_collaborators` row keyed on `(blueprint_id, email)`, and sends an on-brand HTML invite email via Resend (best-effort; missing `RESEND_API_KEY` / `RESEND_FROM_EMAIL` skips email and returns `emailWarning` without failing the request).
- *MentionInput* (`app/src/components/ui/MentionInput.tsx`) — textarea + `@`-autocomplete popover over accepted collaborators (must have `userId`) + the owner; ↑↓ navigates, Enter/Tab picks, Escape dismisses; auto-drops mentions whose `@<name>` token no longer appears in the text. Exposes `serialize()` (returns `{ body, mentions }` with body-tokens encoded as `@[name](userId)`), `clear()`, `focus()` via `forwardRef`. Also exports `renderCommentBody(body, currentUserId)` which renders `@[name](userId)` tokens as styled chips (highlighted when the mention targets the current user).
- *CommentThread wiring* — composer textarea replaced with `MentionInput`; `handlePost` calls `serialize()` and posts `{ body, mentions }`; switching anchors clears the composer; comment bodies render via `renderCommentBody`.
- *CollaboratorsPanel* (`app/src/components/ui/CollaboratorsPanel.tsx`) — pill button in `ProjectBar` (right of the title pill, before Share). Visible only when `blueprintRowId` is resolved + `userId` set + not guest view (i.e. owner of a saved blueprint). Dropdown shows: invite-by-email form (validates format, blocks self-invite), owner row, accepted collaborators (Active), pending collaborators (Pending). Hover row → trash to remove.

### Slice 5 (done — notifications + detached threads + Comments tab)

- *Email template:* `Context/email-templates/comment-notification.html` — branded comment-notification email with placeholders (`{{ACTOR_NAME}}`, `{{KIND_LABEL}}`, `{{BLUEPRINT_NAME}}`, `{{ANCHOR_DESC}}`, `{{SNIPPET}}`, `{{CTA_URL}}`). Documentation only — the edge function inlines the same markup as a TS template literal.
- *Edge function:* `supabase/functions/notify-comment/index.ts` — JWT-required, service-role for inserts. Two paths:
  - `commentId`: loads the comment, computes recipients = mentions ∪ (thread root author + other thread authors when it's a reply), excludes the comment author, dedupes against existing notifications for the same comment, writes a notification row per new recipient + sends Resend email. Mention recipients get `kind: 'mention'`; everyone else gets `kind: 'reply'` (mention beats reply on collisions).
  - `reactionId`: loads the reaction + comment, recipient = comment author (skipped when self-reaction), 5-min debounce checks `notifications` for recent `kind: 'reaction'` rows on the same `(comment_id, user_id)`. If clear, inserts notification + sends email.
  - Both paths look up recipient emails via `admin.auth.admin.getUserById`. Resend missing → email skipped silently, notification row still written.
- *NotificationsBell* (`app/src/components/ui/NotificationsBell.tsx`) — bell pill mounted in `ProjectBar`. Unread count badge (red dot, `99+` cap). Dropdown lists notifications newest-first with kind icon, actor name + verb, snippet (2-line clamp), and relative time. Same-blueprint clicks open the thread; cross-blueprint clicks switch via `switchToBlueprintByRowId` + open thread. "Mark all read" in the header. Notifications are loaded via `setUser` (so the bell is correct even before a blueprint is loaded).
- *NodeInspector "Comments" tab* — new fifth tab after Questions. Subscribes to `comments` slice and shows count badge in the tab. Renders `<ThreadView anchor={{ type: 'action', id }} />` (extracted reusable inner thread + composer; the popover `CommentThread` was refactored to use the same component).
- *DetachedThreadsModal* (`app/src/components/ui/DetachedThreadsModal.tsx`) — full-screen modal, lists detached root comments (anchor element no longer in blueprint), shows author + body + original anchor type, per-row "Re-attach to…" select (lists all current actions/phases/actors with friendly labels) and "Delete thread" with inline confirm. Re-attach updates root + all replies' `anchor_type`/`anchor_id` via new `updateCommentAnchor` lib helper + `reattachThread` store action. Mounted globally in `App.tsx`. Opened from a "Manage…" pill that appears in `CommentFilterBar` when the **Detached** filter is active (or by clicking the Detached pill a second time).

### Slice 5b (done — collaborator-side viewing + deep links)

- *RLS migration:* `supabase/migrations/20260518_collaborator_blueprint_select.sql` — drops the old owner-only SELECT policy on `public.blueprints` and replaces it with `using (public.is_collaborator(id))`. INSERT/UPDATE/DELETE remain owner-only — collaborators are read-only at the blueprint level (they get write access to `comments`/`comment_reactions` via separate RLS).
- *Storage:*
  - `fetchBlueprintsFromCloud()` no longer filters by `owner_id` — RLS now returns owned + invited rows together.
  - New `fetchBlueprintByRowId(rowId)` returns `{ blueprint, ownerId, rowId }` for any blueprint the current user can SELECT.
  - `saveBlueprintCloud(bp)` silently no-ops when the blueprint exists in the cloud under a different owner (so collaborator-side mutations stop spamming the console with RLS denials).
- *Store:*
  - New `isCollaboratorView: boolean` flag (cleared on signOut/setBlueprint/switchToBlueprint, set when `switchToBlueprintByRowId` resolves a non-owned row). Treated as `editLocked` everywhere alongside `commentMode`/`isGuestView`: NodeInspector, ActorPanel, PhaseInspector, VersionBar, ProjectBar, LanesPanel, BlueprintCanvas drag/select gates, App.tsx undo/redo/Backspace handler. CollaboratorsPanel hides for non-owners. The user lands in commentMode by default and can toggle it off, but writes still no-op.
  - New `switchToBlueprintByRowId(rowId, opts?)` action. Resolves the row via `fetchBlueprintByRowId`, sets `isCollaboratorView` if `ownerId !== userId`, replaces store state, calls `useCommentsStore.loadAll(rowId, userId)`, and (when `opts.openCommentId` is supplied) opens that thread anchored at screen center. Returns `false` on RLS denial / not found.
- *Boot:* `completeBoot()` now checks `?b=<rowId>&comment=<commentId>` first. If `b` is present it calls `switchToBlueprintByRowId` and falls through to default loading on failure. The params are stripped from the URL via `history.replaceState` so a refresh doesn't re-trigger.
- *NotificationsBell:* clicks on rows whose `blueprintId` differs from `blueprintRowId` now call `switchToBlueprintByRowId(n.blueprintId, { openCommentId: n.commentId })` instead of just marking read. The hint shown on those rows is "Open blueprint →" in primary color.

### Open follow-ups

**Done in this pass (2026-05-19):**
2. ✅ **`updated_at` bumped on anchor re-attach** — `updateCommentAnchor` now sets `updated_at: new Date().toISOString()` alongside `anchor_type`/`anchor_id`.
3. ✅ **Collaborator viewing pill** — `isCollaboratorView` now surfaces as a "Viewing as collaborator" pill in `ProjectBar` (Eye icon, accent-primary tint) sitting between the project title pill and `NotificationsBell`. Tooltip explains: "You can comment but not edit."
4. ✅ **`isOwner` → `canParticipate`** — variable renamed in both `CommentThread` (popover) and `ThreadView` (NodeInspector "Comments" tab) with a comment explaining the semantics ("owner OR accepted collaborator; RLS gates writes").
5. ✅ **Spec.md sync** — added `isCollaboratorView`, `blueprintRowId`, `commentMode` rows to the §7 state table; added `switchToBlueprintByRowId` and `setCommentMode` to key actions; added the widened `blueprints` SELECT RLS note + boot-time deep-link parsing to §13.
7. ✅ **Bell tab refresh** — `NotificationsBell` now polls `loadNotifications` every 60s while the tab is visible, and refreshes immediately on `visibilitychange` when the tab regains focus.

**Done in this pass (2026-05-19, second batch):**
1. ✅ **Display names** — New store fields `displayName` + `pendingNameCapture`; `AuthScreen` adds a "What should we call you?" step that calls `submitDisplayName` (writes to `auth.user_metadata.display_name`); both the OAuth-listener and `getSession` fallback read `user_metadata.display_name` and pass it to `setUser`. Comment posts use `displayName?.trim() || userEmail` for `authorName`. New SQL migration `20260519_collaborator_display_names.sql` adds a `name` column to `blueprint_collaborators` and updates the `reconcile_collaborator_invites` trigger to denormalise `display_name` from `auth.users.raw_user_meta_data`. `MentionInput` reads `Collaborator.name` (preferred) over `email`; `CommentThread` passes `displayName` as `ownerName`. `notify-comment` edge function uses a new `getUserDisplayName(userId)` helper for reaction `actor_name` (comment notifications already use `c.author_name`, which is now the display name).
6. ✅ **Guest comment reads** — `get-shared-blueprint` now also returns `comments` + `reactions` (service-role reads). Client `loadBlueprintByShareToken` mirrors `guestBlueprintRowId` into `blueprintRowId` (so `CommentBadge`/`CommentThread` work without guest-specific code paths) and calls a new `useCommentsStore.loadFromGuestPayload(rowId, rawComments, rawReactions)` to hydrate the slice. Writes remain gated by `canParticipate = !!userId && !!blueprint`, so guests stay read-only.

**Still deferred:**
- (none of the original list)

### Session AL.1 polish (2026-05-19, after open-followups pass)
Quick UX clean-up requested mid-session:
- **Removed dev tools** — `DebugPanel` (Bug + Palette icons) unmounted from `App.tsx`. The `DebugPanel.tsx` and `DesignSystemModal.tsx` source files are kept but unused; spec §8 row removed.
- **Keyboard shortcuts** — App.tsx top-level keydown extended:
  - `←` / `→`: prev/next step within the selected action's actor row (sorted by `phase.order`, `action.order`)
  - `↑` / `↓`: prev/next step within the same column (same `phaseId` + `order`, sorted by `actor.order`)
  - `Escape`: closes the topmost open inspector, then column selection, then multi-select
  - All arrow nav skipped in present/storyboard/overview/compare; deletion of action cards via keyboard is intentionally NOT bound (deletion still goes through `ConfirmDeleteModal`).
  - Present mode: `PresentationControls` now owns its own keyboard handler — `←`/`PageUp`, `→`/`PageDown`/`Space`, `Home`/`End`, `Escape`.
- **Cursors fixed** — canvas pane shows default arrow at rest (overrides ReactFlow's `grab`); `grabbing` while panning. Action cards: `pointer` at rest, `grabbing` while dragging (via `.react-flow__node-action.dragging` CSS rule). Phase headers: `pointer` at rest (was `grab`/`default` flicker on hover). Lane / column grips keep `grab`/`grabbing` since they ARE drag handles.
- Spec.md §11 updated with a Keyboard Shortcuts table + Cursor Conventions block.

### Manual test plan (Slices 4 + 5 + 5b — needs live Supabase)

**Pre-flight (DB):**

- [ ] Run `supabase/migrations/20260518_comments.sql` in the Supabase SQL editor (creates `blueprint_collaborators`, `comments`, `comment_reactions`, `notifications`, RLS, `is_collaborator`, `reconcile_collaborator_invites_trg`).
- [ ] Run `supabase/migrations/20260518_collaborator_blueprint_select.sql` to widen the `blueprints` SELECT policy so collaborators can read invited rows. **Note:** the migration drops a few likely existing policy names — if your project's policy is named differently, the drop may not match and you'll have a redundant policy. Sanity-check with `select * from pg_policies where tablename = 'blueprints';` after running and clean up any stragglers manually. Also confirm INSERT/UPDATE/DELETE remain owner-only.
- [ ] Run `supabase/migrations/20260519_collaborator_display_names.sql` to add the `name` column on `blueprint_collaborators` and update the reconcile trigger to denormalise `display_name`. Backfills any existing accepted rows.
- [ ] Confirm Resend (or chosen SMTP) is verified for the sender domain so emails actually deliver.

**Pre-flight (Edge functions):**

- [ ] `supabase functions deploy invite-collaborator`
- [ ] `supabase functions deploy notify-comment`
- [ ] `supabase functions deploy get-shared-blueprint` (now returns comments + reactions for guest read access)
- [ ] `supabase secrets set RESEND_API_KEY=re_…`
- [ ] `supabase secrets set RESEND_FROM_EMAIL=noreply@<verified-domain>`
- [ ] (Optional) `supabase secrets set APP_URL=https://<your-deploy-url>` — used as fallback when the request has no `Origin` header.

**Slice 4 — collaborators + mentions:**

- [ ] Sign in as owner. Open a blueprint. The "People" pill is visible in `ProjectBar` next to Share.
- [ ] Click People → enter your own email → "You already own this blueprint" error.
- [ ] Enter a non-existent email like `nobody@example.com` → row created with status "Pending"; email is sent (or `emailWarning` returned if Resend not configured — the row should still appear).
- [ ] Sign in (in a second browser / private window) as that invited email via OTP.
  - [ ] DB trigger should reconcile the row: the collaborator now shows "Active" in the owner's panel, and `user_id` is set on the row.
- [ ] Open a comment thread, type `@` in the composer → autocomplete shows the owner + accepted collaborator(s); pending users are NOT in the list.
- [ ] Pick a collaborator → `@<email> ` is inserted. Add more text. Post.
- [ ] In the rendered comment body, the mention is shown as a styled chip (highlighted blue when it targets you).
- [ ] Backspace/delete the `@<name>` text → `mentions` array drops the entry on serialize.
- [ ] Hover a non-pending collaborator row → trash icon appears → click → row removed.

**Slice 5 — notifications + bell + email:**

- [ ] As owner, post a comment with `@<collaborator>` mention. The collaborator should:
  - [ ] Receive an email with subject `[<Blueprint name>] @<owner-email> mentioned you` and a "View thread" CTA.
  - [ ] See a new unread row in the bell next session (refresh the page or wait for `loadNotifications`).
- [ ] Reply to a thread the collaborator is in: collaborator gets a `reply` notification. **Mentioned + replied to** in the same comment → only ONE notification (mention wins).
- [ ] Two replies in the same thread → still only one notification per (comment, recipient) — second post emails a different recipient set, but never duplicates.
- [ ] React 👍 to a collaborator's comment: collaborator gets a `reaction` notification + email.
- [ ] React 👍 again, ❤️, 🎉 within 5 minutes: NO additional emails should be sent (debounce). Notification rows are still inserted on the first one only. Wait 5+ minutes → next reaction sends one more email.
- [ ] Self-reactions (reacting to your own comment) → no notification.
- [ ] Click an unread bell row whose comment is on the **currently-loaded** blueprint → thread opens, dot disappears, row stays in the dropdown but as "read".
- [ ] Click "Mark all read" → all dots clear.

**Comments tab:**

- [ ] Click an action card → NodeInspector → "Comments" tab. Count badge shows the number of comments on that action.
- [ ] Composer + thread render the same as the popover; resolve toggle works.

**Detached threads:**

- [ ] Comment on an action. Switch to comment mode. Delete the action (need to switch out of comment mode briefly — or use NodeInspector before turning comment mode on).
- [ ] In comment mode, click the "Detached" filter pill. Counts increment to 1.
- [ ] Click the "Detached" pill again (or the new "Manage…" button) → modal opens.
- [ ] The detached thread is listed with author, body, "Was: action".
- [ ] Click "Re-attach to…" → pick a different action/phase/actor → modal updates → in canvas, badge appears on the new anchor.
- [ ] Re-create another detached thread → click "Delete thread" → confirm → thread removed.

**Slice 5b — collaborator viewing + deep links:**

- [ ] Sign in as a previously-invited collaborator (the second account from Slice 4). The owner's blueprint should now appear in their ProjectBar dropdown alongside any blueprints they own (RLS via `is_collaborator`).
- [ ] Open the invited blueprint. Confirm:
  - [ ] `commentMode` is on by default (cursor is the comment bubble).
  - [ ] No "People" pill, no Share pill (owner-only — the existing `userEmail` check on Share keeps it hidden, but verify).
  - [ ] LanesPanel is hidden.
  - [ ] Click an action card → NodeInspector opens; all inputs are read-only (no edits land); delete-step button hidden.
  - [ ] Toggle `commentMode` off via ViewBar → cursor returns to normal but card drag/connect/select is still blocked (canvas read-only via `isCollaboratorView`).
  - [ ] Try to rename the blueprint title in `ProjectBar` → click is a no-op.
  - [ ] Try Cmd+Z → no-op.
- [ ] As collaborator, open a comment thread (Comments tab in NodeInspector or click an action in commentMode), post a `@<owner>` mention. Owner gets the email + bell entry.
- [ ] As owner, click the bell row whose `blueprintId` matches another blueprint (if you have one) → app switches to that blueprint and opens the linked thread.
- [ ] Click the "View thread" CTA in the email → app opens, signs in if needed, then loads `?b=<rowId>&comment=<commentId>`, switches to the linked blueprint, opens the thread, and strips the params from the URL.
- [ ] Refresh the page after the deep-link landed: should NOT re-trigger the navigation (params are gone).

**Cross-cutting / regression:**

- [ ] In `commentMode`: title rename / version pills / lane panel / undo / redo all still disabled (Slice 3 behavior preserved).
- [ ] Guest view (`?share=<token>`): no People pill, no bell, NodeInspector still hides delete actions, can still post pain/opp/question as guest.
- [ ] RLS sanity: a user who's neither owner nor accepted collaborator gets 0 rows from comments/reactions/collaborators/notifications/blueprints and 403 on insert.
- [ ] Owner of an existing blueprint that has no collaborators: nothing in their flow changes — title/version/lane editing all work as before.

### Decisions / caveats made this session

- **Body-class CSS hover** chosen over per-component hover state — single source of truth, avoids prop-drilling `commentMode` into every node.
- **CommentThread popover position** — caller passes `(x,y)` screen coords (anchor element bottom-center for cards, right edge for actor labels); popover clamps within viewport.
- **`blueprintRowId` cached in `blueprint.store`** rather than re-resolving on every comment write. Set during `setBlueprint`/`switchToBlueprint`; cleared on `signOut`.
- **Guest comment reads deferred** — RLS blocks anon reads on `comments`. Plan §verification step "Guest via share token can read comments but cannot write" needs a dedicated `get-shared-comments` edge function or extending `get-shared-blueprint` to bundle comments. Tracked here, not built.
- **MentionInput uses email as display name** — there is no separate `userName` field on the auth user today; `Comment.authorName` is the email and the mention popover displays the email. Adding human-readable display names is a future tweak (would require either a profile table or capture-on-first-OTP).
- **Pending collaborators aren't mentionable** — `MentionInput` skips collaborators with `userId === null` (i.e. invited-but-not-yet-signed-in). Reason: a mention encodes a `userId`, and inserting one for a user that doesn't exist yet would break the notification recipient lookup. Once the invitee signs in, the `reconcile_collaborator_invites_trg` fills in `user_id` and they become mentionable.
- **Resend email is best-effort** — `invite-collaborator` returns `{ ok: true, emailSent: false, emailWarning: '…' }` when Resend env vars are missing or the API call fails. The collaborator row is still created so the invite isn't lost.
- **`CommentBadge` requires `blueprintRowId`** — returns null if the row id hasn't been resolved yet, so badges don't flash before comments load. Also returns null when the anchor has zero comments.
- **Reaction summary pills** show one pill per emoji-with-count, plus a permanent `+` picker (6-emoji popover). Empty reactions don't render.
- **Resolve button** is currently visible to any signed-in user with a loaded blueprint (the `isOwner = userId && blueprint` gate doesn't actually check ownership). For Slices 4/5/5b this is fine — owners + accepted collaborators are the only ones who can read the thread (RLS), so they're also the only ones who can hit the button. Cosmetic rename to `canParticipate` is in the open follow-ups.

### Plan summary

A new `commentMode` (mutually exclusive with `presentMode`/`presentationEditMode`/`storyboardMode`) turns the cursor into a comment bubble, highlights any structural element on hover, and lets the user click to attach a threaded comment. While in the mode, the canvas is fully read-only (mirrors the existing `presentMode` gating pattern). Comments are first-class data — count badges are always visible on commented elements in any mode and click anywhere opens the thread.

#### Locked decisions
| Decision | Choice |
|---|---|
| @-mention scope | Real collaborators (email-invited, OTP-authenticated) |
| Anchor scope | Action cards, phases, actors, edges, status/timeline lanes & segments |
| Indicator visibility | Always-visible count badges (click in any mode opens thread) |
| Storage | New Supabase tables: `blueprint_collaborators`, `comments`, `comment_reactions`, `notifications` |
| Threading | Flat replies under a root comment |
| Reactions | Fixed set: 👍 ❤️ 😂 🎉 ✅ 🤔 |
| Lifecycle | Resolve toggle per thread; resolved hidden by default |
| Notification triggers | @-mention · reply to your thread · reply in thread you participated in · reaction on your comment |
| In-app notifications | Bell icon in `ProjectBar` with unread badge + dropdown |
| NodeInspector tab | New "Comments" tab alongside Pains/Opps/Questions |
| Comment-mode toolbar | Filter pills: All · @Me · Unresolved · Resolved · Detached |
| Anchor-loss handling | Threads NOT cascade-deleted; surfaced in a "Detached threads" modal with re-attach picker |

#### Data model (TypeScript)

```ts
type CommentAnchorType =
  | 'action' | 'phase' | 'actor' | 'edge'
  | 'statusLane' | 'statusSegment' | 'timelineLane' | 'timelineSegment';

type CommentAnchor = { type: CommentAnchorType; id: string };
type CommentMention = { userId: string; email: string; name: string };

type Comment = {
  id; blueprintId; anchor: CommentAnchor;
  parentCommentId: string | null;     // null = root
  authorUserId; authorName; authorEmail;
  body: string;                       // mentions encoded as @[name](userId)
  mentions: CommentMention[];
  createdAt; updatedAt;
  resolvedAt: string | null; resolvedByUserId: string | null;
};

type CommentReaction = {
  id; commentId; userId;
  emoji: '👍' | '❤️' | '😂' | '🎉' | '✅' | '🤔';
  createdAt;
};

type Collaborator = {
  userId: string | null; email: string; name: string | null;
  invitedByUserId; invitedAt; acceptedAt: string | null;
};
```

Comments are NOT stored on the Blueprint JSONB — separate tables, separate Zustand slice. Action IDs are shared across versions, so a comment anchored to an action stays valid across version switches.

#### Supabase schema

```sql
create table blueprint_collaborators (
  id              uuid primary key default gen_random_uuid(),
  blueprint_id    uuid references blueprints(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade,  -- nullable until accepted
  email           text not null,
  invited_by      uuid references auth.users(id) not null,
  invited_at      timestamptz default now(),
  accepted_at     timestamptz,
  unique (blueprint_id, email)
);
-- RLS: select for owner OR user_id=auth.uid() OR email=auth.email();
--      insert/delete for owner only.
-- Trigger on auth.users insert: set user_id + accepted_at on collaborator rows
-- whose email matches the new user.

create table comments (
  id                 uuid primary key default gen_random_uuid(),
  blueprint_id       uuid references blueprints(id) on delete cascade not null,
  anchor_type        text not null,
  anchor_id          text not null,
  parent_comment_id  uuid references comments(id) on delete cascade,
  author_user_id     uuid references auth.users(id) not null,
  author_name        text not null,
  author_email       text not null,
  body               text not null,
  mentions           jsonb default '[]'::jsonb,
  resolved_at        timestamptz,
  resolved_by        uuid references auth.users(id),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index on comments (blueprint_id, anchor_type, anchor_id);
-- RLS: owner OR accepted collaborator on the blueprint.

create table comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid references comments(id) on delete cascade not null,
  user_id     uuid references auth.users(id) not null,
  emoji       text not null,
  created_at  timestamptz default now(),
  unique (comment_id, user_id, emoji)
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  blueprint_id  uuid references blueprints(id) on delete cascade not null,
  comment_id    uuid references comments(id) on delete cascade,
  kind          text not null check (kind in ('mention','reply','reaction')),
  snippet       text not null,
  actor_name    text not null,
  read_at       timestamptz,
  created_at    timestamptz default now()
);
create index on notifications (user_id, read_at, created_at desc);
-- RLS: user_id = auth.uid() for select/update; insert via service role.
```

#### Files to add

- `app/src/store/comments.store.ts` — new Zustand slice (state above)
- `app/src/components/canvas/CommentCursor.tsx` — body-class + custom cursor while in comment mode
- `app/src/components/ui/CommentThread.tsx` — composer + thread + reactions + resolve popover
- `app/src/components/ui/CommentBadge.tsx` — count badge used by all anchor types
- `app/src/components/ui/MentionInput.tsx` — textarea with @-mention autocomplete
- `app/src/components/ui/CollaboratorsPanel.tsx` — invite/list/remove
- `app/src/components/ui/NotificationsBell.tsx` — bell icon + dropdown
- `app/src/components/ui/CommentFilterBar.tsx` — top-of-canvas filter pills (visible in comment mode)
- `app/src/components/ui/DetachedThreadsModal.tsx` — re-attach UI for orphaned threads
- `Context/email-templates/comment-notification.html` — on-brand notification email
- Edge functions: `invite-collaborator`, `notify-comment` (computes recipients, dedups via 5-min reaction debounce, writes `notifications` row + sends email)

#### Files to modify

- `app/src/types/blueprint.ts` — add comment/reaction/collaborator/notification types
- `app/src/lib/storage.ts` — comment + reaction + collaborator + notification CRUD (dual-write pattern)
- `app/src/store/blueprint.store.ts` — trigger `loadComments`/`loadCollaborators`/`loadNotifications` on blueprint load + share-token load
- `app/src/components/canvas/BlueprintCanvas.tsx` — extend ReactFlow gating knobs (`!commentMode`), extend `displayNodes` `EDITING` filter, route edge clicks to comment composer in comment mode
- All node components (`ActionNode`, `PhaseHeaderNode`, `ActorLabelNode`, `LaneNodes`) — render `CommentBadge`, gate clicks/drags on `commentMode` mirroring `presentMode`
- `app/src/components/ui/NodeInspector.tsx` — add Comments tab
- `app/src/components/ui/ProjectBar.tsx` — mount `NotificationsBell` + collaborators access
- `app/src/styles/global.css` — body.comment-mode hover outline rules
- `app/src/lib/notifications.ts` — thin client wrapper around `notify-comment`

#### Notification recipient logic (`notify-comment` edge function)

For each new comment / reaction:
1. Mentioned users (from `comment.mentions`)
2. Thread root author (if reply)
3. Distinct authors elsewhere in the thread (excluding new author)
4. For reactions: the reacted-to comment's author (excluding reactor)
5. Always exclude the action's own author from their own notification.
6. De-dup per `(comment_id, recipient_id)` so a single comment never emails the same person twice.
7. Reactions debounced via 5-min window key — one email per recipient per comment per window max.

Email subject patterns:
- `[Blueprint name] @<name> mentioned you`
- `[Blueprint name] <name> replied to your thread`
- `[Blueprint name] <name> reacted 👍 to your comment`

Email body: brand header, anchor description ("On step 'Submit application' (Phase: Apply)"), 240-char snippet in orange code-block style, primary "View thread" CTA → `${origin}/?b=<blueprintId>&comment=<commentId>`. Built from `Context/email-templates/comment-notification.html` (mirrors OTP templates).

#### Read-only enforcement

`commentMode` gates everywhere `presentMode` does, plus:
- All NodeInspector / ActorPanel / EdgeInspector / PhaseInspector inputs `disabled`
- VersionBar rename / fork / delete disabled
- ProjectBar title click-to-rename disabled
- LanesPanel mutations disabled
- Undo/redo keyboard shortcuts blocked
- Editing-only nodes filtered out via `displayNodes` `EDITING` array extension

#### Verification (run after implementation)

1. Invite collaborator → row created (pending) → invitee signs in → trigger reconciles user_id + accepted_at → blueprint appears in their project list.
2. Toggle comment mode: cursor → bubble; hover highlights every anchor type (action, phase, actor, edge midpoint, status lane/segment, timeline lane/segment); editing fully disabled.
3. Click each anchor type → composer opens at the right screen position.
4. Post root + 3 replies + each of the 6 reactions; toggle reaction off; resolve thread → hidden; "Show resolved" reveals; reopen.
5. Type `@` → autocomplete shows collaborators only; submit → `comments.mentions` populated.
6. In normal edit mode, badges visible on every commented element; click → thread opens read-only.
7. Trigger each of 4 notification cases with a second account; verify exactly one email per case + one in-app notification row + correct subject/snippet/deep-link. Spam-react 10x → one debounced email.
8. RLS: unrelated authenticated user gets 0 rows on all 4 tables; insert returns 403. Guest via share token can read comments but cannot write.
9. Cross-version: comment on action in version A → switch to B → still renders on the same card.
10. Delete an action that has a thread → thread NOT cascade-deleted → "Detached (1)" pill appears in comment-mode filter bar → re-attach to a different action works.
11. Email rendering: confirm Gmail / Outlook web / Apple Mail render the brand header, snippet block, and CTA correctly (table-based, inline styles).

### Done in this session
- Plan finalized (locked decisions table above; full plan at `~/.claude/plans/great-make-a-plan-reflective-spark.md`)
- Spec updated with comment-mode capabilities (§ updates noted in spec.md)

---

## Session AK (previous): Status & timeline lanes
Replaced the per-action `statusTransition` field with independent horizontal *lanes* that snap to the column grid.

### Done in Session AK
- New types: `StatusLane`, `TimelineLane`, `LaneSegment` on `Blueprint` (`statusLanes?`, `timelineLanes?`).
- Layout regions (`computeLaneOffsets`):
  - Timeline lanes stack above the phase header (`TIMELINE_LANE_HEIGHT = 44px` each).
  - Status lanes stack between the phase header and the first actor row (`STATUS_LANE_HEIGHT = 56px` each).
  - Hidden lanes (`visible: false`) collapse out of layout entirely.
  - Overview mode hides both regions.
- New ReactFlow node types (`app/src/components/canvas/nodes/LaneNodes.tsx`):
  - `statusLaneLabel`, `timelineLaneLabel` — label cells in the left column with rename/visibility/delete on hover.
  - `laneBody` — full-width click-to-add-segment overlay with hovered-column preview.
  - `statusSegment` — pill-style segment (drag to move, drag edges to resize, double-click to rename, × to delete).
  - `timelineSegment` — dot–dotted-line–dot pattern with the duration label centered above the line.
- Store: `addStatusLane`, `updateStatusLane`, `removeStatusLane`, `reorderStatusLane`, `addStatusSegment`, `updateStatusSegment`, `removeStatusSegment` (plus the timeline equivalents). All routed through `pushHistory`.
- New floating UI: `LanesPanel` (top-right, left of ViewBar) with two sections (Timelines, Statuses) — add, rename, color-pick, reorder, hide, delete.
- Removed old status system entirely:
  - `Action.statusTransition` and `Blueprint.statuses` types
  - `addStatus`/`updateStatus`/`removeStatus` store actions
  - `'status'` canvasView and `StatusPanel`
  - Status badge on `ActionNode`
  - `StatusTransitionSection` in `NodeInspector`
- Updated `getCellFromPosition` and `BlueprintCanvas` drop hit-testing to use `actorRegionY` (was hardcoded `PHASE_HEADER_HEIGHT`).
- Spec.md + working.md updated. Old status system added to Non-Goals (§14) with rationale.

### Migration note
Existing blueprints in storage that still have `statuses` and `actions[].statusTransition` fields will load fine — the data is JSON-permissive. The fields are simply unused. Lane data starts empty.

### Followups (done 2026-05-20)
- ✅ Auto-fix segments when phases / substep columns are deleted — `remapSegmentsForColumnDelete` helper in `blueprint.store.ts`; wired into `removePhase` and `deleteSubstep`. Drops fully-inside, clamps overlap, shifts fully-after.
- ✅ Confirmation modal for lane deletion — `LanesPanel` row trash button and on-canvas `StatusLaneLabelNode` / `TimelineLaneLabelNode` trash button both gated by `ConfirmDeleteModal`.
- ✅ Per-segment color override UI — new `SegmentColorPicker` (6-colour swatches + Reset) appears next to the delete button on selected status / timeline segments; sets / clears `segment.color`.
- ✅ Always-reserved lane adder rows — `computeLaneOffsets` now reserves one extra `TIMELINE_LANE_HEIGHT` row at the end of the timeline region and one `STATUS_LANE_HEIGHT` row at the end of the status region (in non-overview mode). Two new node types `timelineAdder` / `statusAdder` (`TimelineAdderNode.tsx` / `StatusAdderNode.tsx`) render left-column "+ Add timeline" / "+ Add status" buttons in those reserved rows. Filtered out in present / overview / guest / comment / collaborator modes alongside the other adders.
- ✅ Hover-only adder borders — `PhaseAdderNode`, `ActorAdderNode`, plus the two new lane adders all share a hover-only dotted border at 60% opacity → full-opacity tint + dashed border on hover.
- ✅ Lane labels behave like actor labels — `StatusLaneLabelNode` / `TimelineLaneLabelNode` now show a tinted color fill + left-side drag grip on hover; vertical drag reorders within their lane group via `reorderStatusLane` / `reorderTimelineLane` (threshold = 60% of row height); click selects the lane (new `selectedLaneId` store field, mutually exclusive with `selectedLaneSegmentId`). When selected a Trash button appears at the right edge of the label, gated by `ConfirmDeleteModal`. Eye / visibility toggle removed from canvas-side (still in `LanesPanel`). `BlueprintCanvas.onPaneClick` clears `selectedLaneId` alongside the other selections.

---

## What's Done

### Core Canvas (Sessions 1–S)
Full blueprint canvas: AI generation, structured grid layout, actors/phases/actions data model, versions (fork/compare), presentations (slide editor + playback), semantic zoom (overview mode), OverviewInspector (editable labelAbstract + AI description + 4-tab aggregated pains/opps/questions), storyboard / Journey Map mode with DALL-E image generation, style presets.

### Sessions T–V: Polish + Refinements
Overview mode filters (no add-steps in overview), cross-phase edges, inspector arrow nav (crosses phases, smooth centering via `animateToNode`), compare mode pan/zoom sync, ModeBar restructure (Blueprints/Personas/Journey Maps; no Present tab), ViewBar as dropdown (includes Present option), OverviewInspector per-action identity (`actionId` in `selectedOverviewCell`), inline `labelAbstract` editing on overview cards, onboarding vertical centering + dot background, recent projects in onboarding.

### Sessions W–Z: Journey Map + Bug Fixes
Journey Map storyboard: filmstrip, frame detail, style guide modal, drag-to-reorder, export, custom prompt, prompt preview, JourneyMapPresenter. Bug fixes: image persistence (base64, no expiry), badge-click → inspector tab routing (`openInspectorToTab`), severity/effort/type pickers above description, delete button on Details tab only, PhaseInspector header redesigned to match NodeInspector, arrow navigation crosses phases.

### Sessions AA–AB: GitHub + Style Presets
GitHub repo (`https://github.com/MatthewGlibbery/touchpoints`, public). Style preset library (`touchpoints-style-presets` localStorage key), `regenerateAllFrames`, style guide updates rebuild all frame prompts.

### Sessions AC–AH: Cloud Auth + Guest Mode
- **Auth**: Supabase email OTP, `'auth'` app mode, localStorage migration flow
- **Storage**: dual-write (localStorage + Supabase JSONB), cloud fetch on boot, background sync
- **Edge functions**: `ai-generate`, `ai-overview`, `ai-storyboard` (Anthropic + DALL-E 3 proxies, JWT-required); `get-shared-blueprint` (no-auth); API keys server-side (Supabase secrets)
- **Share links**: `blueprint_shares` table + `?share=<token>` param → guest view
- **Guest mode**: `GuestNamePrompt`, read-only canvas, guest can add pains/opps/questions → `guest_comments` table; owner loads contributions automatically

### Session AI: Final Features
- **Undo/redo**: 50-level stack
- **Guest UI fix**: ModeBar + ViewBar visible in guest view
- **Conditional phases**: amber dashed phase styling
- **Service statuses** (REPLACED in AK): per-action `statusTransition` + `blueprint.statuses` vocabulary

### Session AJ: Backlog (commit `2ea27ff`)
- New project state cleanup, named version rename, semantic zoom in SplitCanvas, AI actor portraits, ErrorBoundary, canvas bg fix, setUser bootstrap.

### Post-AJ: Production bug fixes
- **React error #185 (commit `de2d388`)**: `ActionNode` selector `s.blueprint?.statuses ?? []` created a new array reference every render → `useSyncExternalStore` infinite loop. Fixed by moving `?? []` outside the selector. (Note: AK removed `statuses` entirely, so this selector is gone — the lesson lives on in spec §7 as the selector-purity rule.)
- **Auth boot double-fire**: `_bootPromise` singleton.

### Session AK: Status & timeline lanes
See "Done in this session" above.

### Post-AK: Onboarding redesign
- Removed the seeded "Describe the service…" assistant chat bubble (it duplicated the textarea placeholder)
- Removed the chat-thread UI entirely; onboarding is now single-shot input → analyzing → canvas
- New `analyzing` phase: large animated `TouchpointsLogo` (pulsing scale + sequential dot opacity pulse) with status text below, fed by `generateBlueprint`'s `onStatus` callback
- New `OnboardingProjectSwitcher` (top-left pill, mirrors `ProjectBar` styling) with project list + sign-out — replaces the inline "Recent projects" footer list
- Errors return to the idle input view with the textarea preserved
- Added `logoPulse`, `logoDotPulse`, `statusFade` keyframes to `global.css`
- OTP-only auth (Session post-AK): `AuthScreen` now has 6–10 digit code input; `sendOTP` no longer passes `emailRedirectTo`; on-brand HTML email templates committed to `Context/email-templates/`

---

## Supabase Schema

```sql
create table blueprints (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade not null,
  data       jsonb not null,
  name       text generated always as (data->>'name') stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);
-- RLS: owner access policy

create table blueprint_shares (
  id           uuid primary key default gen_random_uuid(),
  blueprint_id uuid references blueprints(id) on delete cascade not null,
  token        text unique not null,  -- generated client-side via crypto.getRandomValues
  can_comment  boolean default true,
  created_at   timestamptz default now(),
  expires_at   timestamptz
);
-- RLS: public select, owner insert/delete

create table guest_comments (
  id            uuid primary key default gen_random_uuid(),
  share_id      uuid references blueprint_shares(id) on delete cascade not null,
  blueprint_id  uuid references blueprints(id) on delete cascade not null,
  type          text check (type in ('pain','opportunity','question')) not null,
  data          jsonb not null,
  guest_name    text,
  guest_session text not null,
  created_at    timestamptz default now()
);
-- RLS: public insert, owner select

-- Supabase Storage bucket 'storyboard-images' (public: true)
```

---

## Future Backlog

- **Real-time collaboration** — enable Supabase Realtime on `blueprints` table; no schema changes needed (schema has `updated_at`/`updated_by` ready)

---

## Known Config Gotchas

### Magic link → spam
Magic links in OTP emails are commonly flagged as phishing by spam filters when the link's domain differs from the sender domain (and corporate scanners rewrite/strip them outright). Switched to OTP-code-only sign-in:
- `sendOTP` no longer passes `emailRedirectTo` (so Supabase omits the link)
- Supabase email templates must be edited to remove `{{ .ConfirmationURL }}` — keep only `{{ .Token }}` and surrounding copy
- App already verifies via `verifyOtp({ type: 'email' })`, so no flow change

### Resend sender address
`onboarding@resend.dev` (the default Resend "from" address) only delivers to the email tied to your Resend account — any other recipient is rejected silently before Resend logs it. Symptom: Supabase shows "Error sending confirmation email" and Resend dashboard shows no activity.

**Fix**: verify your own domain in Resend → Domains (add SPF/DKIM DNS records), then change Supabase → Auth → SMTP Settings → Sender email to `noreply@yourdomain.com`. Until a domain is verified, OTP sign-in only works for the Resend account owner's email.
