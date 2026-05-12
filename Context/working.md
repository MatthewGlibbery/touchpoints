# Working — Current Session

## Current Objective

All planned sessions (A through AI) complete. App deployed to Vercel. Spec and working docs cleaned up after last commit (`e0233d7`).

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
- **Undo/redo**: 50-level stack (`undoStack`/`redoStack`), `pushHistory` at all mutation sites (38 call sites), Cmd+Z / Cmd+Shift+Z (blocked in inputs)
- **Guest UI fix**: ModeBar + ViewBar visible in guest view; owner-only UI remains gated
- **Conditional phases**: `conditional` + `conditionLabel` on Phase; amber dashed styling on PhaseHeaderNode + ColumnOverlayNode; toggle + label input in PhaseInspector
- **Service statuses**: `ServiceStatus` vocabulary, `StatusTransition` on actions, Status view + StatusPanel, status badge on action cards, `StatusTransitionSection` in NodeInspector Details tab

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

## Open Questions

- **"New project" state cleanup** — blueprint stays in store memory until new one is submitted; visually fine but slightly impure.
- **AI portrait** — ActorPanel placeholder styled and ready; AI image generation not yet wired.

---

## Future Backlog

- **Real-time collaboration** — enable Supabase Realtime on `blueprints` table; no schema changes needed (schema has `updated_at`/`updated_by` ready)
- **Semantic zoom in compare mode** — overview mode currently only applies to main BlueprintCanvas
- **AI portrait** — wire up image generation for actor avatars
- **Named version rename** — VersionBar only supports create/delete for named versions; rename deferred
