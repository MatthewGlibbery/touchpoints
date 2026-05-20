-- Session AL.2: Display names for collaborators
-- Adds a `name` column to blueprint_collaborators and updates the reconcile
-- trigger to populate it from the user's auth metadata (display_name) on
-- insert/update of auth.users. Backfills any existing accepted rows.

-- ─── Schema ───────────────────────────────────────────────────────────────────

alter table public.blueprint_collaborators
  add column if not exists name text;

-- ─── Trigger function: now also denormalises display_name → collaborator.name ─

create or replace function public.reconcile_collaborator_invites()
returns trigger
language plpgsql
security definer
as $$
declare
  display_name text;
begin
  display_name := nullif(trim(coalesce(NEW.raw_user_meta_data->>'display_name', '')), '');

  update public.blueprint_collaborators
    set user_id = NEW.id,
        accepted_at = coalesce(accepted_at, now()),
        name = coalesce(display_name, name)
    where lower(email) = lower(NEW.email)
      and (user_id is null or user_id <> NEW.id or name is distinct from coalesce(display_name, name));

  -- Also keep names fresh for already-accepted rows when the user updates
  -- their display_name later.
  if display_name is not null then
    update public.blueprint_collaborators
      set name = display_name
      where user_id = NEW.id and (name is null or name <> display_name);
  end if;

  return NEW;
end;
$$;

drop trigger if exists reconcile_collaborator_invites_trg on auth.users;
create trigger reconcile_collaborator_invites_trg
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.reconcile_collaborator_invites();

-- ─── Backfill existing accepted rows ──────────────────────────────────────────

update public.blueprint_collaborators c
  set name = nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', '')), '')
  from auth.users u
  where c.user_id = u.id
    and c.name is null
    and (u.raw_user_meta_data->>'display_name') is not null;
