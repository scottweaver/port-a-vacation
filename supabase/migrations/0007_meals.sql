-- =============================================================================
-- meals + meal_sous_chefs: cook-at-the-condo meal plan with one head chef per
-- meal and any number of opt-in sous chefs.
--
-- Trip-level (NOT family-private like packing_status / hidden_items): a chef
-- from one family cooks for everyone. All approved users read all meals.
-- The head_chef and admins can edit/delete a meal; anyone can sign themselves
-- up (or out) as a sous chef.
--
-- meal_type is a constrained text field (not a Postgres enum) so future
-- additions like 'snack' don't require an ALTER TYPE migration.
-- =============================================================================

create table public.meals (
  id            uuid primary key default gen_random_uuid(),
  meal_date     date not null,
  meal_type     text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'other')),
  title         text not null check (length(trim(title)) > 0),
  notes         text,
  head_chef_id  uuid not null references public.profiles(id) on delete restrict,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index meals_date_idx on public.meals(meal_date, meal_type);
create index meals_head_chef_idx on public.meals(head_chef_id);

-- Touch updated_at on any change (for ordering / staleness checks).
create or replace function public.touch_meal_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger meals_updated_at_trigger
  before update on public.meals
  for each row execute function public.touch_meal_updated_at();

alter table public.meals enable row level security;

create policy "approved users can read meals"
  on public.meals for select using (public.is_approved());

create policy "approved users can create meals"
  on public.meals for insert
  with check (public.is_approved() and created_by = auth.uid());

-- Head chef or admin can edit. Head chef can NOT reassign themselves away
-- via UPDATE (admin would handle reassignment); enforced by WITH CHECK
-- requiring head_chef_id stays the same OR the user is admin.
create policy "head chef or admin can update meals"
  on public.meals for update
  using (head_chef_id = auth.uid() or public.is_admin())
  with check (head_chef_id = auth.uid() or public.is_admin());

create policy "head chef or admin can delete meals"
  on public.meals for delete
  using (head_chef_id = auth.uid() or public.is_admin());

alter publication supabase_realtime add table public.meals;

-- meal_sous_chefs: composite-PK opt-in table. Self-INSERT/DELETE so anyone
-- can sign themselves up or back out. Head chef or admin can also remove
-- a sous chef (e.g. to bump a no-show).

create table public.meal_sous_chefs (
  meal_id    uuid not null references public.meals(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (meal_id, user_id)
);

create index meal_sous_chefs_user_idx on public.meal_sous_chefs(user_id);

alter table public.meal_sous_chefs enable row level security;

create policy "approved users can read sous chefs"
  on public.meal_sous_chefs for select using (public.is_approved());

create policy "users sign themselves up"
  on public.meal_sous_chefs for insert
  with check (public.is_approved() and user_id = auth.uid());

create policy "users remove themselves; head chef + admin can remove anyone"
  on public.meal_sous_chefs for delete
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.meals m
      where m.id = meal_id and m.head_chef_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.meal_sous_chefs;
