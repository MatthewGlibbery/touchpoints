-- Session AL: widen blueprints SELECT RLS so accepted collaborators can read
-- a blueprint they were invited to. Requires `is_collaborator(uuid)` to exist
-- (created in 20260518_comments.sql) — that function returns true for owners
-- AND accepted collaborators, so we collapse both branches into a single
-- policy.
--
-- Existing policy names in production are unknown to this repo, so we drop a
-- few likely candidates before creating the new one.

drop policy if exists "blueprints select" on public.blueprints;
drop policy if exists "blueprints select (owner)" on public.blueprints;
drop policy if exists "Owner select" on public.blueprints;
drop policy if exists "owner select" on public.blueprints;
drop policy if exists "blueprints owner select" on public.blueprints;

create policy "blueprints select (owner or collaborator)"
  on public.blueprints
  for select
  using (public.is_collaborator(id));

-- Note: insert / update / delete policies on `blueprints` are intentionally
-- unchanged. Only owners can mutate the row; collaborators are read-only.
-- Comment-system tables (`comments`, `comment_reactions`) have their own RLS
-- (also via is_collaborator) so collaborators can write comments + reactions
-- without needing write access to the blueprint row itself.
