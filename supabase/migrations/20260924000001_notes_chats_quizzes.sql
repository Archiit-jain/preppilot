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
