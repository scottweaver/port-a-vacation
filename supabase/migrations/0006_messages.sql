-- =============================================================================
-- messages + thread_reads: per-item conversation threads with per-user unread
-- tracking. Linear threads (no nested replies) keyed by item_id.
--
-- messages: anyone approved can read, anyone approved can post their own,
-- authors can edit / delete their own. Hard delete (no tombstones) — for an
-- 8-person family trip the audit value isn't worth the UI complexity.
--
-- thread_reads: each user's own last_read_at per thread, used to compute
-- unread counts. Absent row = never read = all messages are unread. Anyone
-- (whether or not they've posted) gets unread indicators by default; the
-- table just tracks when they last opened each thread.
-- =============================================================================

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.checklist_items(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  content     text not null check (length(trim(content)) > 0),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz
);

create index messages_item_id_idx on public.messages(item_id, created_at);
create index messages_author_idx on public.messages(author_id);

-- Touch edited_at on content change (any other field update is incidental).
create or replace function public.touch_message_edited_at()
returns trigger language plpgsql as $$
begin
  if (new.content is distinct from old.content) then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger messages_edited_at_trigger
  before update on public.messages
  for each row execute function public.touch_message_edited_at();

alter table public.messages enable row level security;

create policy "approved users can read messages"
  on public.messages for select using (public.is_approved());

create policy "approved users can post messages"
  on public.messages for insert
  with check (public.is_approved() and author_id = auth.uid());

create policy "authors can edit their own messages"
  on public.messages for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "authors can delete their own messages"
  on public.messages for delete
  using (author_id = auth.uid());

alter publication supabase_realtime add table public.messages;

-- thread_reads tracks each user's last-opened time per thread. Self-only RLS.

create table public.thread_reads (
  item_id       uuid not null references public.checklist_items(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index thread_reads_user_id_idx on public.thread_reads(user_id);

alter table public.thread_reads enable row level security;

create policy "users read own thread_reads"
  on public.thread_reads for select using (user_id = auth.uid());

create policy "users insert own thread_reads"
  on public.thread_reads for insert with check (user_id = auth.uid());

create policy "users update own thread_reads"
  on public.thread_reads for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own thread_reads"
  on public.thread_reads for delete using (user_id = auth.uid());

alter publication supabase_realtime add table public.thread_reads;
