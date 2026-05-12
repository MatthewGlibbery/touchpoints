# Working — Current Session

## Current Objective

Auth and share links now working on localhost. Next step: deploy the app so share links are usable by real recipients.

---

## Post-AH Fixes — COMPLETE

- [x] **Auth OTP**: `sendOTP` now passes `emailRedirectTo: window.location.origin`. Supabase dashboard required: email templates updated to show `{{ .Token }}`, Site URL + Redirect URLs set, custom SMTP (Resend) configured to bypass 2-email/hour free-tier rate limit.
- [x] **Share link silent failure**: `handleGenerateLink` in ProjectBar now awaits `saveBlueprintCloud(blueprint)` before calling `createShareToken` — ensures the blueprint row exists in Supabase first. Error message shown in dropdown if creation still fails.
- [x] **Share token encoding bug**: `blueprint_shares` table default `encode(gen_random_bytes(24), 'base64url')` fails on Supabase's PostgreSQL (unsupported encoding). Fixed by generating token client-side in `generateToken()` (`crypto.getRandomValues` → URL-safe base64) and passing it explicitly in the insert.
- [x] **Cloud save visibility**: `saveBlueprintCloud` exported and now logs errors via `console.error` rather than swallowing them silently.

---

## Session AG Progress — COMPLETE

- [x] AG1 — Edge function `supabase/functions/get-shared-blueprint/index.ts`: no-auth endpoint; validates token against `blueprint_shares`, returns `{ blueprint, canComment, shareId, blueprintRowId }`
- [x] AG2 — `app/src/store/blueprint.store.ts`: added `isGuestView`, `guestCanComment`, `guestName`, `guestSessionId`, `guestShareId`, `guestBlueprintRowId`, `shareToken` state; added `loadBlueprintByShareToken`, `setGuestName`, `addGuestPainPoint`, `addGuestOpportunity`, `addGuestQuestion`, `loadGuestComments` actions; bootstrap checks `?share=` param first — if found, loads via edge function and skips auth gate
- [x] AG3 — `app/src/lib/storage.ts`: added `getShareToken`, `createShareToken`, `deleteShareToken` + internal `getBlueprintRowId` helper
- [x] AG4 — `app/src/App.tsx`: `isGuestView` hides all edit UI; renders `<NodeInspector />` if inspector is open; renders `<GuestNamePrompt />` when guest can comment and hasn't named themselves
- [x] AG5 — `app/src/components/ui/ProjectBar.tsx`: Share button + dropdown (generate link / copy link / revoke) only when authenticated; uses `getShareToken` / `createShareToken` / `deleteShareToken` from storage
- [x] AG6 — `app/src/components/canvas/BlueprintCanvas.tsx`: `isGuestView` added to store reads; used in `displayNodes` filter (removes editing nodes), `nodesDraggable`, `nodesConnectable`, `edgesReconnectable`, `selectionOnDrag` props
- [x] AG7 — `app/src/components/storyboard/StoryboardView.tsx`: Export All, Style Guide, Generate buttons hidden when `isGuestView`

## Session AH Progress — COMPLETE

- [x] AH1 — `app/src/types/blueprint.ts`: added `guestContributed?: true` and `guestName?: string` to `PainPoint`, `Opportunity`, `Question`
- [x] AH2 — `app/src/store/blueprint.store.ts`: guest state/actions — `addGuestPainPoint`, `addGuestOpportunity`, `addGuestQuestion` write to in-memory blueprint + `guest_comments` table; `loadGuestComments` fetches all guest comments for the blueprint (owner-only via RLS) and merges into in-memory state
- [x] AH3 — New `app/src/components/auth/GuestNamePrompt.tsx`: "What should we call you?" modal; Continue → `setGuestName`; Skip → clears name; name stored in `sessionStorage`
- [x] AH4 — `app/src/components/ui/NodeInspector.tsx`: `GuestBadge` component (teal, shows guest name); guest items show badge; non-guest items in guest view are read-only (no X button, no edit); guest view gets guest-add buttons if `guestCanComment`; delete step button hidden in guest view
- [x] AH5 — `loadGuestComments` wired into `completeBoot` and `switchToBlueprint` so owner sees guest contributions automatically on load

**Deployment note:** Share links generated on `localhost` are not usable by external recipients. App must be deployed to a public URL for share links to work end-to-end.

---

---

## Cloud Storage / Auth / Sharing Plan (Sessions AD–AH)

### Overview
Move blueprint data off localStorage to Supabase (Postgres JSONB). Add passwordless email OTP auth. Add view-only share links. Let guests add pains/opps/questions. Move API keys server-side via Supabase Edge Functions. Lay the foundation for real-time collaboration without implementing it yet.

**Key decisions:**
- Backend: Supabase (Auth + Postgres + Edge Functions + Storage)
- Blueprint stored as single JSONB blob per row — no data model restructuring
- Share links via `?share=<token>` query param — no router needed
- DALL-E images moved to Supabase Storage (replaces base64-in-localStorage)
- `updated_at` / `updated_by` columns on `blueprints` table → real-time ready

### Supabase schema (applied once before Session AD)
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
alter table blueprints enable row level security;
create policy "owner access" on blueprints
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table blueprint_shares (
  id           uuid primary key default gen_random_uuid(),
  blueprint_id uuid references blueprints(id) on delete cascade not null,
  token        text unique not null default encode(gen_random_bytes(24), 'base64url'),
  can_comment  boolean default true,
  created_at   timestamptz default now(),
  expires_at   timestamptz
);
alter table blueprint_shares enable row level security;
create policy "public share read" on blueprint_shares for select using (true);
create policy "owner manage shares" on blueprint_shares
  using (blueprint_id in (select id from blueprints where owner_id = auth.uid()))
  with check (blueprint_id in (select id from blueprints where owner_id = auth.uid()));

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
alter table guest_comments enable row level security;
create policy "public insert" on guest_comments for insert with check (true);
create policy "owner read" on guest_comments for select
  using (blueprint_id in (select id from blueprints where owner_id = auth.uid()));
-- Supabase Storage bucket 'storyboard-images' created via dashboard (public: true)
```

### Session AE Progress — COMPLETE

- [x] AE1 — `storage.ts`: `saveBlueprint` dual-writes (localStorage sync + Supabase background upsert via `saveBlueprintCloud`); `fetchBlueprintsFromCloud` (async, Supabase primary, syncs down to localStorage); `deleteBlueprint` fires cloud delete in background; `migrateLocalBlueprints` returns localStorage blueprints not yet in Supabase; `importBlueprintsToCloud` uploads a list of blueprints
- [x] AE2 — `blueprint.store.ts`: `completeBoot` closure fetches from cloud, syncs localStorage, then loads most recent blueprint or goes to onboarding; `setUser` fires async bootstrap (checks migration first — if found, sets `pendingMigration` and stays in 'auth' mode); `pendingMigration: Blueprint[] | null` state added; `confirmMigration` (imports + boots) and `skipMigration` (boots without importing) actions added; `signOut` clears `pendingMigration`
- [x] AE3 — `AuthScreen.tsx`: added `MigrationStep` component ("Import N projects?" with Confirm/Skip); `useEffect` on `pendingMigration` switches to 'migration' step; ternary chain extended to handle 'otp' | 'migration' steps
- [x] AE4 — `ProjectBar.tsx`: reads `userEmail` from store; dropdown footer shows email + Sign Out button (LogOut icon, calls `signOut()`)

---

### Session AD — Auth gate + Supabase setup
**Files to create:**
- `app/src/lib/supabase.ts` — `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` singleton
- `app/src/lib/auth.ts` — `sendOTP(email)`, `verifyOTP(email, code)`, `getSession()`, `signOut()`, `onAuthStateChange(cb)`
- `app/src/components/auth/AuthScreen.tsx` — two-step: email entry → 6-digit OTP entry

**Files to modify:**
- `app/.env.example` — add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `app/src/store/blueprint.store.ts` — add `'auth'` to `AppMode`; add `userId`, `userEmail` state fields; add `setUser(id, email)` + `signOut()` actions; bootstrap checks `supabase.auth.getSession()` → if session, `setUser()` and proceed; else mode = `'auth'`; subscribe `onAuthStateChange`
- `app/src/App.tsx` — add `{mode === 'auth' && <AuthScreen />}` branch
- Storage still uses localStorage — no cloud reads/writes yet

### Session AE — Cloud blueprint storage + migration
**Files to modify:**
- `app/src/lib/storage.ts` — dual-write: `saveBlueprint` → localStorage + Supabase upsert; `loadAllBlueprints` → Supabase fetch (localStorage fallback); `deleteBlueprint` → Supabase + localStorage; new `migrateLocalBlueprints()` → returns localStorage blueprints not yet in cloud
- `app/src/store/blueprint.store.ts` — async bootstrap: after auth, `await loadAllBlueprints()` from Supabase; `saveBlueprint` sets `updated_by = userId`
- `app/src/components/auth/AuthScreen.tsx` — after OTP verify: call `migrateLocalBlueprints()`; if found, show "Import N blueprint(s) from this device?" step
- `app/src/components/ui/ProjectBar.tsx` — show `userEmail` + Sign Out button
- `app/src/components/onboarding/OnboardingOverlay.tsx` — recent projects loads from cloud

### Session AF Progress — COMPLETE

- [x] AF1 — `supabase/functions/ai-generate/index.ts`: JWT-verified Anthropic proxy for blueprint generation
- [x] AF2 — `supabase/functions/ai-overview/index.ts`: JWT-verified Anthropic proxy for overview + cell description generation
- [x] AF3 — `supabase/functions/ai-storyboard/index.ts`: JWT-verified Anthropic proxy for storyboard generation; `type: 'image'` path calls DALL-E 3 + uploads to Supabase Storage `storyboard-images`, returns public URL (falls back to base64 data URL on upload error)
- [x] AF4 — `app/src/lib/ai.ts`: replaced `new Anthropic({ dangerouslyAllowBrowser: true })` with `supabase.functions.invoke('ai-generate', ...)`; removed Anthropic SDK import
- [x] AF5 — `app/src/lib/storyboard.ts`: same pattern for style guide + frame generation; `generateImage` now accepts `(prompt, blueprintId, frameId)` and delegates to `ai-storyboard` edge function for Storage upload
- [x] AF6 — `app/src/store/blueprint.store.ts`: removed Anthropic SDK import; `generateOverview` and `generateCellDescription` use `supabase.functions.invoke('ai-overview', ...)`; all `generateImage` call sites updated with `blueprintId` + `frameId` args
- [x] AF7 — `app/src/components/ui/PhaseInspector.tsx`: inline `generateDescription` migrated from Anthropic SDK to `supabase.functions.invoke('ai-overview', ...)`
- [x] AF8 — `app/src/components/storyboard/StoryboardView.tsx`: removed `hasOpenAiKey` guards (key is now server-side); "Save & Regenerate All" always shown when frames exist
- [x] AF9 — `app/.env.example`: removed `VITE_ANTHROPIC_API_KEY` and `VITE_OPENAI_API_KEY`; added note to set them as Supabase secrets

**Supabase secrets to set:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

---

### Session AF — Server-side AI proxy (Edge Functions)
**Files to create:**
- `supabase/functions/ai-generate/index.ts` — Anthropic proxy for `generateBlueprint`; requires JWT
- `supabase/functions/ai-overview/index.ts` — Anthropic proxy for overview generation; requires JWT
- `supabase/functions/ai-storyboard/index.ts` — Anthropic + DALL-E proxy; uploads images to Supabase Storage `storyboard-images`; requires JWT

**Files to modify:**
- `app/src/lib/ai.ts` — replace `new Anthropic({ dangerouslyAllowBrowser: true })` with `supabase.functions.invoke('ai-generate', ...)`
- `app/src/lib/storyboard.ts` — same pattern; `generateImage` returns Supabase Storage URL
- `app/.env.example` — remove `VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY`; note they are now Supabase secrets

**Supabase secrets:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

### Session AF Cleanup — COMPLETE
- [x] `@anthropic-ai/sdk` uninstalled from `app/package.json` (no longer imported anywhere in app source)
- [x] `VITE_ANTHROPIC_API_KEY` and `VITE_OPENAI_API_KEY` removed from `app/.env.local`

---

### Session AG — Share links + view-only guest access
**Files to modify:**
- `app/src/store/blueprint.store.ts` — add `isGuestView: boolean`, `shareToken: string | null`; add `generateShareLink`, `revokeShareLink`, `loadBlueprintByShareToken`; bootstrap: check `?share=` param → `loadBlueprintByShareToken` + skip auth
- `app/src/App.tsx` — `isGuestView`: skip auth, go to canvas read-only, hide all edit UI
- `app/src/components/ui/ProjectBar.tsx` — Share button → dropdown: current link + "Copy" + "Revoke" + "Generate"
- `app/src/components/canvas/BlueprintCanvas.tsx` — `isGuestView` treated same as `presentMode` for interaction guards
- `app/src/components/storyboard/StoryboardView.tsx` — hide Generate/Style Guide/Export in guest view
- Edge Function `get-shared-blueprint` validates token → returns blueprint data (no auth JWT needed)

### Session AH — Guest contributions
**Files to modify:**
- `app/src/store/blueprint.store.ts` — add `guestName: string | null`, `guestSessionId: string`; add `setGuestName`, `addGuestPainPoint`, `addGuestOpportunity`, `addGuestQuestion` (write to `guest_comments` table); `loadBlueprintWithGuestComments` merges rows into in-memory blueprint with `guestContributed: true`
- `app/src/components/ui/NodeInspector.tsx` — show guest items with "Guest" badge (same pattern as `aiGenerated`); owner can delete; guest view hides delete
- New `app/src/components/auth/GuestNamePrompt.tsx` — "What should we call you?" modal with optional skip; stores in `sessionStorage` + `guestName`
- `app/src/types/blueprint.ts` — add `guestContributed?: true` to `PainPoint`, `Opportunity`, `Question`

### Real-time foundation (no extra work needed)
After AH: enable Supabase Realtime on `blueprints` table (dashboard toggle) + add `supabase.from('blueprints').on('UPDATE', cb).subscribe()` in `storage.ts` + call `setBlueprint(newData)` in callback. No schema or data model changes needed.

---

## Session AD Progress — COMPLETE

- [x] AD1 — `@supabase/supabase-js` installed
- [x] AD2 — `app/src/lib/supabase.ts`: `createClient` singleton using `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- [x] AD2 — `app/src/lib/auth.ts`: `sendOTP`, `verifyOTP`, `getSession`, `signOut`, `onAuthStateChange`
- [x] AD3 — `app/src/components/auth/AuthScreen.tsx`: two-step UI (email → 6-digit OTP boxes); paste support; matches design system + dot-background
- [x] AD4 — `blueprint.store.ts`: `AppMode` extended with `'auth'`; `userId`/`userEmail` state; `setUser`/`signOut` actions; initial mode is `'auth'`; async bootstrap calls `getSession()` → `setUser()` or stays on auth; `onAuthStateChange` subscription keeps state in sync
- [x] AD4 — `App.tsx`: renders `<AuthScreen />` when `mode === 'auth'`
- [x] AD5 — `app/.env.example`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` entries added

**Storage unchanged** — still localStorage only. Cloud sync comes in Session AE.

---

## Session AC Progress — COMPLETE

- [x] AC1 — `aiGenerated?: true` added to `PainPoint`, `Opportunity`, `Question` types
- [x] AC2 — `lib/ai.ts`: all AI-generated items marked `aiGenerated: true`; `opportunities` and `questions` arrays added to action tool schema so Claude links them to specific steps; normalization resolves and back-fills `actionIds` for all three types (previously opportunities and questions had `actionIds: []` and never appeared on cards)
- [x] AC3 — `updatePainPoint`, `updateOpportunity`, `updateQuestion` in store strip `aiGenerated` on any edit (destructure-out pattern, no flag in patch type)
- [x] AC4 — NodeInspector: AI badge (purple Sparkles + "AI" pill) shown on `aiGenerated` items inline with the severity/effort/type picker row; vanishes on first edit

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

## Session AA Progress — COMPLETE

- [x] AA1 — Arrow keys no longer move action cards: added `disableKeyboardA11y={true}` to `<ReactFlow>` in `BlueprintCanvas.tsx`
- [x] AA2 — Selection highlight follows navigation: `ActionNode` reads `selectedNodeId === action.id` from store instead of ReactFlow's `selected` prop; inspector arrow buttons now correctly highlight the new card and unhighlight the previous one
- [x] AA3 — GitHub repo initialised and pushed: root `.gitignore`, `app/.env.example`, initial commit of 79 files; live at `https://github.com/MatthewGlibbery/touchpoints` (public)
- [x] AA4 — README at project root: explains the tool, features, and local setup for a non-technical audience

---

## Session AB Progress — COMPLETE

- [x] AB1 — `updateStoryboardStyleGuide` now rebuilds all frame `imagePrompt` strings (via `buildImagePrompt`) whenever the style guide is saved — prompts always reflect current guide
- [x] AB2 — `regenerateAllFrames(storyboardId)` store action: loops all frames sequentially, sets `storyboardGeneratingFrameId` per frame, calls `generateImage`; uses `storyboardGenerating` for overall progress state
- [x] AB3 — `lib/styleLibrary.ts`: `StylePreset` type + `loadPresets`/`savePreset`/`deletePreset` CRUD stored in localStorage key `touchpoints-style-presets` (independent of Blueprint, cross-project)
- [x] AB4 — `StyleGuideModal` overhauled: presets strip below Base Style (click to apply, × to delete, highlighted when active); "Save as preset" inline name input; footer now has Cancel | "Save & Regenerate All" (only when frames + OpenAI key) | Save

---

## Open Questions

- **"New project" state cleanup** — blueprint stays in store memory until new one is submitted; visually fine but slightly impure.
- **AI portrait** — ActorPanel placeholder styled and ready; AI image generation not yet wired.

---

## Future Backlog

- **Semantic zoom in compare mode** — overview mode only applies to main BlueprintCanvas
- **AI portrait** — wire up image generation for actor avatars
