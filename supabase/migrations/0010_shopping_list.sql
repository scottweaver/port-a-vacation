-- =============================================================================
-- shopping_list: family-private list of items the family wants to buy. Unlike
-- packing_status (which auto-derives from contributions), shopping_list is a
-- manual opt-in — the user explicitly taps a shopping-bag icon on a checklist
-- item to add it. Same composite-PK + family-private RLS shape as packing_status.
--
-- `purchased` is the row-level "bought" flag. Absent row = not on the list;
-- present row with purchased=false = "Need to buy"; present row with
-- purchased=true = "Got it." Remove from list = DELETE.
-- =============================================================================

create table public.shopping_list (
  item_id     uuid not null references public.checklist_items(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  purchased   boolean not null default false,
  added_by    uuid references auth.users(id) on delete set null,
  added_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (item_id, family_id)
);

create index shopping_list_family_id_idx on public.shopping_list(family_id);

create or replace function public.touch_shopping_list_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger shopping_list_updated_at_trigger
  before update on public.shopping_list
  for each row execute function public.touch_shopping_list_updated_at();

alter table public.shopping_list enable row level security;

create policy "family members read own shopping"
  on public.shopping_list for select
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

create policy "family members insert own shopping"
  on public.shopping_list for insert
  with check (
    public.is_approved()
    and added_by = auth.uid()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

create policy "family members update own shopping"
  on public.shopping_list for update
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  )
  with check (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

create policy "family members delete own shopping"
  on public.shopping_list for delete
  using (
    public.is_approved()
    and family_id = (select family_id from public.profiles where id = auth.uid())
  );

alter publication supabase_realtime add table public.shopping_list;
