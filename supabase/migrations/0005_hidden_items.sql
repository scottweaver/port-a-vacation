-- =============================================================================
-- hidden_items: each family's private hide list. A family member can hide an
-- item from THEIR family's planning view and Pack screen without affecting
-- what other families see. Mirrors the (item_id, family_id) composite-PK +
-- family-scoped RLS pattern from packing_status.
--
-- Absent row = visible for this family; present row = hidden for this family.
-- No UPDATE path. Hide = INSERT, unhide = DELETE. Both idempotent.
-- =============================================================================

create table public.hidden_items (
  item_id     uuid not null references public.checklist_items(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  hidden_by   uuid references auth.users(id) on delete set null,
  hidden_at   timestamptz not null default now(),
  primary key (item_id, family_id)
);

create index hidden_items_family_id_idx on public.hidden_items(family_id);

alter table public.hidden_items enable row level security;

-- SELECT: only your own family's hidden list. Other families' choices stay
-- private to them.
create policy "family members read own hidden items"
  on public.hidden_items for select
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

-- INSERT: must be your own family, hidden_by must be you (no spoofing).
create policy "family members hide items for own family"
  on public.hidden_items for insert
  with check (
    public.is_approved()
    and hidden_by = auth.uid()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

-- DELETE: only your own family's rows. Any family member can unhide what
-- another family member hid — collaborative within the family.
create policy "family members unhide own family's items"
  on public.hidden_items for delete
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

-- Realtime so hide / unhide propagates between family members' devices.
alter publication supabase_realtime add table public.hidden_items;
