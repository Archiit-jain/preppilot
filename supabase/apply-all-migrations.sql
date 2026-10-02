-- ---------------------------------------------------------------------------
-- PrepPilot: every migration, in order, as one script.
--
-- For a Supabase project that has never had the migrations applied — which is
-- what stops synchronisation working: the app signs in, then every push and
-- pull answers "Could not find the table 'public.trackers'".
--
-- HOW TO RUN IT
--   1. Supabase dashboard → your project → SQL Editor → New query.
--   2. Paste this whole file.
--   3. Run. It should finish with "Success. No rows returned".
--   4. Check Table Editor: profiles, trackers, subjects, chapters, topics,
--      subtopics, flashcards, study_sessions, reminders, notes, chat_threads,
--      chat_messages, quiz_attempts.
--
-- RUNNING IT TWICE
--   The tables and indexes are guarded, but some policies and triggers are not,
--   so a second run stops at "policy ... already exists" and rolls the whole
--   script back. That error means it was already applied; nothing is damaged.
--
-- WHAT IT SETS UP
--   The thirteen tables above, Row Level Security on every one of them scoped to
--   the signed-in account, the grants those policies need, and the triggers
--   that keep updated_at honest. No delete policies anywhere: rows are
--   tombstoned with deleted_at so a deletion can travel to other devices.
--
-- Generated from supabase/migrations/*.sql — the files remain the source of
-- truth. Regenerate with: docs/developer/DEPLOYMENT.md
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 20260823000001_profiles.sql
-- ===========================================================================

-- Profiles: the application-owned record for each authenticated user.
--
-- auth.users is managed by Supabase and should not be extended directly, so
-- application fields live here, keyed by the same id.

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email        text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each auth user. One row per user, id matches auth.users.id.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- PRD §8 requires that each user reach only their own records. RLS is the only
-- enforcement point that a compromised or modified client cannot bypass, so it
-- is enabled here rather than relying on correct queries in the app.

alter table public.profiles enable row level security;

-- Also applies the policies to the table owner, closing the hole where a
-- privileged role bypasses RLS by default.
alter table public.profiles force row level security;

-- RLS filters rows only after the privilege check passes, so without an explicit
-- grant every request is rejected before a policy is ever consulted. Delete is
-- withheld: profiles go away with the cascade from auth.users (D28).
grant select, insert, update on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Insert is handled by the trigger below, which runs as definer. A user-facing
-- insert policy exists only so a profile can be recreated if one is ever missing;
-- it still cannot create a row for anybody else.
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Deliberately no delete policy: profiles are removed by the cascade from
-- auth.users when the account itself is deleted (DECISIONS.md, D28).

-- ---------------------------------------------------------------------------
-- Keep profiles in step with auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- An empty search_path forces every reference below to be schema-qualified,
-- so a table planted on a mutable search_path cannot hijack this definer function.
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
-- Set server-side rather than trusting a client-supplied timestamp, because
-- sync conflict resolution depends on it (DECISIONS.md, D14).

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ===========================================================================
-- 20260825000001_syllabus.sql
-- ===========================================================================

-- The synchronised tables.
--
-- These mirror the local SQLite schema so a row can move between the two without
-- translation. The device remains the source of truth (PRD §6); this is the copy
-- that survives a lost phone and follows a student to a second device.
--
-- Conventions, all carried over from the local schema:
--   * ids are client-generated UUIDv7 (D13), so a row created offline is final
--   * deleted_at is a tombstone, never a hard delete (D12)
--   * updated_at drives conflict resolution (D14)
--   * user_id is denormalised onto every table so one RLS predicate covers it

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Sets updated_at server-side rather than trusting the client's clock for the
-- authoritative copy. The client's own value still travels in the payload and is
-- what local conflict resolution compares.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------

create table if not exists public.subjects (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists subjects_user_idx on public.subjects (user_id, deleted_at, position);
-- Pulling changes since a timestamp is the sync layer's hot path.
create index if not exists subjects_user_updated_idx on public.subjects (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- chapters
-- ---------------------------------------------------------------------------

create table if not exists public.chapters (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists chapters_subject_idx on public.chapters (subject_id, deleted_at, position);
create index if not exists chapters_user_updated_idx on public.chapters (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------

create table if not exists public.topics (
  id                   uuid primary key,
  user_id              uuid not null references auth.users (id) on delete cascade,
  chapter_id           uuid not null references public.chapters (id) on delete cascade,
  name                 text not null,
  completed            boolean not null default false,
  -- Tracked separately from updated_at so completion resolves independently of a
  -- rename (D14): renaming on one device must not revert a tick made on another.
  completed_changed_at timestamptz,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists topics_chapter_idx on public.topics (chapter_id, deleted_at, position);
create index if not exists topics_user_updated_idx on public.topics (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------
-- Deliberately no foreign key to subjects, chapters or topics (D16, D37).
-- Deleting a subject must not shrink "total time studied using PrepPilot" — the
-- student really did spend that time — so the ids are plain references and the
-- names are snapshots taken when the session was recorded.

create table if not exists public.study_sessions (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  subject_id       uuid,
  chapter_id       uuid,
  topic_id         uuid,
  subject_name     text,
  chapter_name     text,
  topic_name       text,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  duration_seconds integer not null default 0,
  timer_mode       text not null,
  status           text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint study_sessions_duration_non_negative check (duration_seconds >= 0),
  constraint study_sessions_timer_mode_known check (timer_mode in ('stopwatch', 'pomodoro', 'custom')),
  constraint study_sessions_status_known check (status in ('running', 'paused', 'completed', 'abandoned'))
);

create index if not exists study_sessions_user_started_idx
  on public.study_sessions (user_id, deleted_at, started_at desc);
create index if not exists study_sessions_user_updated_idx
  on public.study_sessions (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
-- notification_id is deliberately absent: it identifies a scheduled notification
-- on one device and is meaningless anywhere else (D45).

create table if not exists public.reminders (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  scheduled_at timestamptz not null,
  repeat_rule  text not null default 'none',
  subject_id   uuid,
  chapter_id   uuid,
  topic_id     uuid,
  related_name text,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint reminders_repeat_rule_known check (repeat_rule in ('none', 'daily', 'weekdays', 'weekly'))
);

create index if not exists reminders_user_time_idx on public.reminders (user_id, deleted_at, scheduled_at);
create index if not exists reminders_user_updated_idx on public.reminders (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- PRD §8 requires each student reach only their own records. RLS is the only
-- enforcement point a modified client cannot bypass, so every table gets it and
-- every policy is scoped to auth.uid().
--
-- `force row level security` applies the policies to the table owner too,
-- closing the hole where a privileged role bypasses them by default.

do $$
declare
  target text;
begin
  foreach target in array array['subjects', 'chapters', 'topics', 'study_sessions', 'reminders']
  loop
    execute format('alter table public.%I enable row level security', target);
    execute format('alter table public.%I force row level security', target);

    -- Privileges come first: RLS filters rows *after* the privilege check, so a
    -- table with policies but no grant rejects every request outright rather
    -- than returning an empty set. Delete is deliberately withheld — rows are
    -- tombstoned, never removed (D12).
    execute format('grant select, insert, update on public.%I to authenticated', target);

    execute format($f$
      create policy "Users read their own %1$s"
        on public.%1$I for select to authenticated
        using ((select auth.uid()) = user_id)
    $f$, target);

    execute format($f$
      create policy "Users insert their own %1$s"
        on public.%1$I for insert to authenticated
        with check ((select auth.uid()) = user_id)
    $f$, target);

    execute format($f$
      create policy "Users update their own %1$s"
        on public.%1$I for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $f$, target);

    -- Deliberately no delete policy anywhere: rows are tombstoned via
    -- deleted_at (D12), and a real delete would resurrect the row on the next
    -- pull from a device that has not seen the removal.

    execute format(
      'create trigger %1$s_touch_updated_at before update on public.%1$I
         for each row execute function public.touch_updated_at()',
      target
    );
  end loop;
end;
$$;


-- ===========================================================================
-- 20260826000001_subtopics_and_notes.sql
-- ===========================================================================

-- Sub-topics, and notes on topics.
--
-- Sub-topics are the optional fourth level of the syllabus: Subject -> Chapter
-- -> Topic -> Sub-topic. A student adds them themselves, exactly as they add the
-- other three; nothing creates them automatically, and a topic without any stays
-- an ordinary checkable topic.
--
-- Conventions are carried over unchanged from the other synced tables: client
-- generated UUIDv7 ids (D13), tombstones rather than deletes (D12), updated_at
-- driving conflict resolution (D14), and user_id denormalised so a single RLS
-- predicate covers the table.

-- ---------------------------------------------------------------------------
-- topics.note
-- ---------------------------------------------------------------------------
-- Null and empty both mean "no note"; the client stores null so there is one
-- representation rather than two.

alter table public.topics add column if not exists note text;

-- ---------------------------------------------------------------------------
-- subtopics
-- ---------------------------------------------------------------------------

create table if not exists public.subtopics (
  id                   uuid primary key,
  user_id              uuid not null references auth.users (id) on delete cascade,
  topic_id             uuid not null references public.topics (id) on delete cascade,
  name                 text not null,
  completed            boolean not null default false,
  -- Tracked separately from updated_at so completion resolves independently of
  -- a rename (D14), exactly as it does for topics.
  completed_changed_at timestamptz,
  position             integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists subtopics_topic_idx
  on public.subtopics (topic_id, deleted_at, position);
create index if not exists subtopics_user_updated_idx
  on public.subtopics (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Identical in shape to the other synced tables: enable, force, grant, then one
-- policy per operation scoped to auth.uid(). Delete is withheld everywhere —
-- rows are tombstoned, and a real delete would resurrect the row on the next
-- pull from a device that has not seen the removal (D12).
--
-- Written idempotently so re-running the migration against a database that has
-- already had it applied does not fail on an existing policy.

do $$
begin
  execute 'alter table public.subtopics enable row level security';
  execute 'alter table public.subtopics force row level security';
  execute 'grant select, insert, update on public.subtopics to authenticated';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subtopics'
      and policyname = 'Users read their own subtopics'
  ) then
    execute $p$
      create policy "Users read their own subtopics"
        on public.subtopics for select to authenticated
        using ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subtopics'
      and policyname = 'Users insert their own subtopics'
  ) then
    execute $p$
      create policy "Users insert their own subtopics"
        on public.subtopics for insert to authenticated
        with check ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subtopics'
      and policyname = 'Users update their own subtopics'
  ) then
    execute $p$
      create policy "Users update their own subtopics"
        on public.subtopics for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'subtopics_touch_updated_at'
  ) then
    execute 'create trigger subtopics_touch_updated_at before update on public.subtopics
               for each row execute function public.touch_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
-- Reviewed on an SM-2 schedule; @preppilot/shared owns the algorithm and this
-- only stores what it decided.
--
-- `topic_id` deliberately carries no foreign key and the topic's name is
-- snapshotted, exactly as study_sessions does (D16): deleting a topic must not
-- destroy the cards written for it or the review history behind them.

create table if not exists public.flashcards (
  id               uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  topic_id         uuid,
  topic_name       text,
  front            text not null,
  back             text not null,
  ease_factor      double precision not null default 2.5,
  interval_days    integer not null default 0,
  repetitions      integer not null default 0,
  lapses           integer not null default 0,
  due_at           timestamptz not null,
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint flashcards_ease_sane check (ease_factor >= 1.3),
  constraint flashcards_counts_non_negative
    check (interval_days >= 0 and repetitions >= 0 and lapses >= 0)
);

create index if not exists flashcards_user_due_idx
  on public.flashcards (user_id, deleted_at, due_at);
create index if not exists flashcards_user_updated_idx
  on public.flashcards (user_id, updated_at);

do $$
begin
  execute 'alter table public.flashcards enable row level security';
  execute 'alter table public.flashcards force row level security';
  execute 'grant select, insert, update on public.flashcards to authenticated';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flashcards'
      and policyname = 'Users read their own flashcards'
  ) then
    execute $p$
      create policy "Users read their own flashcards"
        on public.flashcards for select to authenticated
        using ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flashcards'
      and policyname = 'Users insert their own flashcards'
  ) then
    execute $p$
      create policy "Users insert their own flashcards"
        on public.flashcards for insert to authenticated
        with check ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'flashcards'
      and policyname = 'Users update their own flashcards'
  ) then
    execute $p$
      create policy "Users update their own flashcards"
        on public.flashcards for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'flashcards_touch_updated_at'
  ) then
    execute 'create trigger flashcards_touch_updated_at before update on public.flashcards
               for each row execute function public.touch_updated_at()';
  end if;
end;
$$;


-- ===========================================================================
-- 20260828000001_trackers.sql
-- ===========================================================================

-- Multiple courses on one account.
--
-- A student preparing for two exams keeps two syllabuses, two sets of notes and
-- two decks; without a tracker to hang them from, both would interleave into one
-- unusable list. Everything a student owns belongs to exactly one tracker.
--
-- Columns are added nullable on purpose. Rows written before this migration have
-- no tracker, and the client claims them into a default one on next launch
-- (`adoptOrphans`). Making the column NOT NULL here would reject those rows on
-- their first sync — a student's syllabus would fail to upload with no way back.

-- ---------------------------------------------------------------------------
-- trackers
-- ---------------------------------------------------------------------------

create table if not exists public.trackers (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  -- Which bundled template this came from, if any. Kept so the app can offer a
  -- refreshed syllabus when a template is updated, and null for a course the
  -- student built themselves.
  template_id text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint trackers_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists trackers_user_updated_idx
  on public.trackers (user_id, updated_at);

do $$
begin
  execute 'alter table public.trackers enable row level security';
  execute 'alter table public.trackers force row level security';
  execute 'grant select, insert, update on public.trackers to authenticated';

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trackers'
      and policyname = 'Users read their own trackers'
  ) then
    execute $p$
      create policy "Users read their own trackers"
        on public.trackers for select to authenticated
        using ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trackers'
      and policyname = 'Users insert their own trackers'
  ) then
    execute $p$
      create policy "Users insert their own trackers"
        on public.trackers for insert to authenticated
        with check ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trackers'
      and policyname = 'Users update their own trackers'
  ) then
    execute $p$
      create policy "Users update their own trackers"
        on public.trackers for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trackers_touch_updated_at'
  ) then
    execute 'create trigger trackers_touch_updated_at before update on public.trackers
               for each row execute function public.touch_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- tracker_id on everything a tracker owns
-- ---------------------------------------------------------------------------
--
-- No foreign key to public.trackers. Rows arrive in whatever order sync manages,
-- and a subject that lands before its tracker would be rejected outright rather
-- than waiting — losing work that the client already considers saved. The client
-- orders trackers first (SYNCED_TABLES) so this is belt-and-braces, and RLS
-- already confines every row to its owner.

alter table public.subjects       add column if not exists tracker_id uuid;
alter table public.study_sessions add column if not exists tracker_id uuid;
alter table public.reminders      add column if not exists tracker_id uuid;
alter table public.flashcards     add column if not exists tracker_id uuid;

create index if not exists subjects_user_tracker_idx
  on public.subjects (user_id, tracker_id, deleted_at);
create index if not exists study_sessions_user_tracker_idx
  on public.study_sessions (user_id, tracker_id, deleted_at);
create index if not exists reminders_user_tracker_idx
  on public.reminders (user_id, tracker_id, deleted_at);
create index if not exists flashcards_user_tracker_idx
  on public.flashcards (user_id, tracker_id, deleted_at);

-- ===========================================================================
-- 20260924000001_notes_chats_quizzes.sql
-- ===========================================================================

-- Several notes per topic, saved assistant conversations, and the Quiz deck.
--
-- Conventions are carried over unchanged from the other synced tables:
-- client-generated UUIDv7 ids (D13), tombstones rather than deletes (D12),
-- updated_at set by the server on every update (it drives the sync watermark),
-- user_id denormalised so a single RLS predicate covers the table, row level
-- security enabled and forced, and no delete policy anywhere.
--
-- topic_id carries no foreign key, as for flashcards and study sessions: a note
-- or quiz outlives a reorganised syllabus. The old topics.note and
-- subtopics.note columns stay for older app versions; the app adopts their
-- contents into public.notes under the topic's own id.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------

create table if not exists public.notes (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  tracker_id   uuid,
  topic_id     uuid not null,
  subtopic_id  uuid,
  body         text not null,
  source       text not null default 'manual',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint notes_source_known check (source in ('manual', 'summary', 'assistant')),
  constraint notes_body_bounded check (char_length(body) <= 20000)
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at);
create index if not exists notes_topic_idx on public.notes (topic_id, deleted_at);

-- ---------------------------------------------------------------------------
-- chat_threads and chat_messages
-- ---------------------------------------------------------------------------
-- A picture sent to the assistant is not stored: has_image records that there
-- was one, and the file itself stays on the device that took it.

create table if not exists public.chat_threads (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint chat_threads_title_bounded check (char_length(title) <= 200)
);

create index if not exists chat_threads_user_updated_idx
  on public.chat_threads (user_id, updated_at);

create table if not exists public.chat_messages (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  thread_id   uuid not null,
  role        text not null,
  body        text not null,
  proposal    text,
  has_image   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint chat_messages_role_known check (role in ('student', 'assistant')),
  constraint chat_messages_body_bounded check (char_length(body) <= 40000)
);

create index if not exists chat_messages_user_updated_idx
  on public.chat_messages (user_id, updated_at);
create index if not exists chat_messages_thread_idx
  on public.chat_messages (thread_id, deleted_at, created_at);

-- ---------------------------------------------------------------------------
-- quiz_attempts — the Quiz deck
-- ---------------------------------------------------------------------------
-- questions and answers are JSON kept as text, exactly as the client stores
-- them; the server never reads inside them.

create table if not exists public.quiz_attempts (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  tracker_id      uuid,
  topic_id        uuid,
  topic_name      text not null,
  chapter_name    text,
  subject_name    text,
  difficulty      text not null,
  allow_multiple  boolean not null default true,
  questions       text not null,
  answers         text not null,
  correct         integer not null,
  total           integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint quiz_attempts_difficulty_known
    check (difficulty in ('easy', 'medium', 'hard', 'competitive')),
  constraint quiz_attempts_score_sane
    check (total between 1 and 15 and correct between 0 and total)
);

create index if not exists quiz_attempts_user_updated_idx
  on public.quiz_attempts (user_id, updated_at);
create index if not exists quiz_attempts_user_tracker_idx
  on public.quiz_attempts (user_id, tracker_id, deleted_at);

-- ---------------------------------------------------------------------------
-- Privileges, row level security and the updated_at trigger, for all four
-- ---------------------------------------------------------------------------
-- RLS filters rows only after the privilege check passes, so each table needs
-- its GRANT as well as its policies (D73).

do $$
declare
  target text;
begin
  foreach target in array array['notes', 'chat_threads', 'chat_messages', 'quiz_attempts']
  loop
    execute format('alter table public.%I enable row level security', target);
    execute format('alter table public.%I force row level security', target);
    execute format('grant select, insert, update on public.%I to authenticated', target);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target
        and policyname = format('Users read their own %s', target)
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated
           using ((select auth.uid()) = user_id)',
        format('Users read their own %s', target), target
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target
        and policyname = format('Users insert their own %s', target)
    ) then
      execute format(
        'create policy %I on public.%I for insert to authenticated
           with check ((select auth.uid()) = user_id)',
        format('Users insert their own %s', target), target
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = target
        and policyname = format('Users update their own %s', target)
    ) then
      execute format(
        'create policy %I on public.%I for update to authenticated
           using ((select auth.uid()) = user_id)
           with check ((select auth.uid()) = user_id)',
        format('Users update their own %s', target), target
      );
    end if;

    if not exists (
      select 1 from pg_trigger where tgname = format('%s_touch_updated_at', target)
    ) then
      execute format(
        'create trigger %I before update on public.%I
           for each row execute function public.touch_updated_at()',
        format('%s_touch_updated_at', target), target
      );
    end if;
  end loop;
end;
$$;

-- ===========================================================================
-- 20260925000001_chat_follow_up.sql
-- ===========================================================================

-- A follow-up chat remembers what it follows up on.
--
-- "Ask a follow-up" on a topic summary opens a chat that sends the summary to
-- the assistant with every question in it. The summary is kept on the thread,
-- as JSON { title, text }, so the chat still carries it when reopened later or
-- on another device. Null for an ordinary chat.
--
-- Safe to run more than once.

alter table public.chat_threads add column if not exists follow_up text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chat_threads_follow_up_bounded'
  ) then
    alter table public.chat_threads
      add constraint chat_threads_follow_up_bounded
      check (follow_up is null or char_length(follow_up) <= 10000);
  end if;
end;
$$;

-- ===========================================================================
-- 20261002000001_theme_packs_bucket.sql
-- ===========================================================================

-- Downloadable themes (DECISIONS.md, D106).
--
-- The theme catalog, packs and fonts are public, read-only files: the app
-- fetches them over plain HTTPS from /storage/v1/object/public/themes/... when a
-- student opens Settings -> Themes, and only then. A public bucket serves reads
-- without any policy, and no insert, update or delete policy is created, so
-- only the service role (the maintainer's CLI) can change what is offered.
--
-- 2 MB per file is well above the largest font (~260 KB) and stops the bucket
-- being used for anything else.

insert into storage.buckets (id, name, public, file_size_limit)
values ('themes', 'themes', true, 2097152)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
