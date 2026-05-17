-- =============================================================================
-- packing_status: family-private tracking of which committed items a family
-- has actually packed for the trip. Mirrors the (item_id, family_id) composite-
-- PK pattern from contributions, but RLS scopes both reads AND writes to the
-- user's own family — other families cannot see your packing progress.
--
-- Absent row = unpacked; present row = packed. Pack = INSERT, unpack = DELETE.
-- (Same shape as the existing claim semantics: zero-or-one row per pair.)
-- =============================================================================

create table public.packing_status (
  item_id     uuid not null references public.checklist_items(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (item_id, family_id)
);

create index packing_status_family_id_idx on public.packing_status(family_id);

alter table public.packing_status enable row level security;

-- SELECT: only your own family's rows. This is the privacy boundary — packing
-- progress is intentionally hidden from other families.
create policy "family members read own packing"
  on public.packing_status for select
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

-- INSERT: must be your own family, and updated_by must be you (prevents
-- spoofing "packed by Scott" from another user's session).
create policy "family members insert own packing"
  on public.packing_status for insert
  with check (
    public.is_approved()
    and updated_by = auth.uid()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

-- DELETE: only your own family's rows. Any family member can unpack what
-- another family member packed — collaborative within the family.
create policy "family members delete own packing"
  on public.packing_status for delete
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

-- Realtime so packing toggles propagate to other devices for the same family.
alter publication supabase_realtime add table public.packing_status;
