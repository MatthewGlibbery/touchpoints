-- Session AL: Comment mode + collaborators + notifications
-- Run this in the Supabase SQL editor against the project DB.

-- ─── blueprint_collaborators ──────────────────────────────────────────────────

create table if not exists public.blueprint_collaborators (
  id              uuid primary key default gen_random_uuid(),
  blueprint_id    uuid references public.blueprints(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade,
  email           text not null,
  invited_by      uuid references auth.users(id) not null,
  invited_at      timestamptz default now(),
  accepted_at     timestamptz,
  unique (blueprint_id, email)
);

create index if not exists blueprint_collaborators_user_idx
  on public.blueprint_collaborators (user_id);
create index if not exists blueprint_collaborators_email_idx
  on public.blueprint_collaborators (email);

alter table public.blueprint_collaborators enable row level security;

drop policy if exists "collab select" on public.blueprint_collaborators;
create policy "collab select" on public.blueprint_collaborators for select
  using (
    user_id = auth.uid()
    or email = auth.email()
    or exists (select 1 from public.blueprints b where b.id = blueprint_id and b.owner_id = auth.uid())
  );

drop policy if exists "collab insert (owner)" on public.blueprint_collaborators;
create policy "collab insert (owner)" on public.blueprint_collaborators for insert
  with check (
    exists (select 1 from public.blueprints b where b.id = blueprint_id and b.owner_id = auth.uid())
  );

drop policy if exists "collab delete (owner)" on public.blueprint_collaborators;
create policy "collab delete (owner)" on public.blueprint_collaborators for delete
  using (
    exists (select 1 from public.blueprints b where b.id = blueprint_id and b.owner_id = auth.uid())
  );

-- Trigger: on auth.users insert/update, reconcile pending collaborator rows by email.

create or replace function public.reconcile_collaborator_invites()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.blueprint_collaborators
    set user_id = NEW.id,
        accepted_at = coalesce(accepted_at, now())
    where lower(email) = lower(NEW.email)
      and (user_id is null or user_id <> NEW.id);
  return NEW;
end;
$$;

drop trigger if exists reconcile_collaborator_invites_trg on auth.users;
create trigger reconcile_collaborator_invites_trg
  after insert or update of email on auth.users
  for each row execute function public.reconcile_collaborator_invites();

-- ─── Helper: is_collaborator(blueprint_uuid) ──────────────────────────────────
-- Returns true if the calling user is the owner OR an accepted collaborator on
-- the given blueprint row. Used by RLS policies on comments + comment_reactions.
-- Defined AFTER blueprint_collaborators because language-sql function bodies are
-- validated at create time.

create or replace function public.is_collaborator(bp_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.blueprints b where b.id = bp_id and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.blueprint_collaborators c
      where c.blueprint_id = bp_id
        and c.accepted_at is not null
        and (c.user_id = auth.uid() or c.email = auth.email())
  );
$$;

-- ─── comments ─────────────────────────────────────────────────────────────────

create table if not exists public.comments (
  id                 uuid primary key default gen_random_uuid(),
  blueprint_id       uuid references public.blueprints(id) on delete cascade not null,
  anchor_type        text not null,
  anchor_id          text not null,
  parent_comment_id  uuid references public.comments(id) on delete cascade,
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

create index if not exists comments_anchor_idx
  on public.comments (blueprint_id, anchor_type, anchor_id);
create index if not exists comments_parent_idx
  on public.comments (parent_comment_id);

alter table public.comments enable row level security;

drop policy if exists "comments select" on public.comments;
create policy "comments select" on public.comments for select
  using (public.is_collaborator(blueprint_id));

drop policy if exists "comments insert" on public.comments;
create policy "comments insert" on public.comments for insert
  with check (
    author_user_id = auth.uid()
    and public.is_collaborator(blueprint_id)
  );

drop policy if exists "comments update (author)" on public.comments;
create policy "comments update (author)" on public.comments for update
  using (author_user_id = auth.uid() or public.is_collaborator(blueprint_id))
  with check (public.is_collaborator(blueprint_id));

drop policy if exists "comments delete (author)" on public.comments;
create policy "comments delete (author)" on public.comments for delete
  using (
    author_user_id = auth.uid()
    or exists (select 1 from public.blueprints b where b.id = blueprint_id and b.owner_id = auth.uid())
  );

-- ─── comment_reactions ────────────────────────────────────────────────────────

create table if not exists public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid references public.comments(id) on delete cascade not null,
  user_id     uuid references auth.users(id) not null,
  emoji       text not null,
  created_at  timestamptz default now(),
  unique (comment_id, user_id, emoji)
);

create index if not exists comment_reactions_comment_idx
  on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;

drop policy if exists "reactions select" on public.comment_reactions;
create policy "reactions select" on public.comment_reactions for select
  using (
    exists (
      select 1 from public.comments c
        where c.id = comment_id
          and public.is_collaborator(c.blueprint_id)
    )
  );

drop policy if exists "reactions insert" on public.comment_reactions;
create policy "reactions insert" on public.comment_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.comments c
        where c.id = comment_id
          and public.is_collaborator(c.blueprint_id)
    )
  );

drop policy if exists "reactions delete" on public.comment_reactions;
create policy "reactions delete" on public.comment_reactions for delete
  using (user_id = auth.uid());

-- ─── notifications ────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  blueprint_id  uuid references public.blueprints(id) on delete cascade not null,
  comment_id    uuid references public.comments(id) on delete cascade,
  kind          text not null check (kind in ('mention','reply','reaction')),
  snippet       text not null,
  actor_name    text not null,
  read_at       timestamptz,
  created_at    timestamptz default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications select (own)" on public.notifications;
create policy "notifications select (own)" on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications update (own)" on public.notifications;
create policy "notifications update (own)" on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts are performed only by the notify-comment edge function via service role.
