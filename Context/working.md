# Working — Current Session

## Current Objective

**Session AK: Status & timeline lanes** — replace the per-action `statusTransition` field with independent horizontal *lanes* that snap to the column grid.

### Done in this session
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

### Followups (not done)
- Auto-fix segments when phases are deleted (currently they clamp at render but `startCol`/`endCol` data isn't updated).
- Confirmation modal for lane deletion (deletes are direct; user didn't request a confirm step).
- Per-segment color override UI (color falls back to lane color; segments support an optional `color` field but no UI exposes it yet).

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
- **Auto-clamp lane segments on phase delete** — currently segments may reference deleted columns; render clamps but data drifts
- **Per-segment color override UI** — segments already support `color?` field; add picker

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
