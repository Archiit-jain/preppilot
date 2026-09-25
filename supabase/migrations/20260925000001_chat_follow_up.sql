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
