-- =============================================================================
-- meal_ingredients: per-meal ingredient list. Phase 2 of cook-at-the-condo
-- support (Phase 1 = the meals + sous chef tables in 0007).
--
-- Writes restricted to head_chef of the meal + any signed-up sous_chef +
-- admin. Reads available to all approved users (everyone wants to see what's
-- planned for tomorrow's dinner).
--
-- quantity is free-text on purpose: "2 lbs", "1 box", "3 cloves", "a bunch" —
-- not worth modeling as numeric+unit at this scale. notes for special prep
-- instructions ("organic if possible", "the spicy one"). sort_order lets the
-- chef order ingredients in a meaningful sequence (prep order, recipe order)
-- instead of by creation time.
-- =============================================================================

create table public.meal_ingredients (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references public.meals(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  quantity    text,
  notes       text,
  sort_order  integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index meal_ingredients_meal_idx on public.meal_ingredients(meal_id, sort_order);

alter table public.meal_ingredients enable row level security;

-- Helper: is the current user authorized to edit ingredients for this meal?
-- (head_chef OR sous_chef of the meal, OR admin). Used by all write policies.
create or replace function public.can_edit_meal_ingredients(target_meal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meals m
    where m.id = target_meal_id and m.head_chef_id = auth.uid()
  )
  or exists (
    select 1 from public.meal_sous_chefs s
    where s.meal_id = target_meal_id and s.user_id = auth.uid()
  )
  or public.is_admin();
$$;

create policy "approved users can read ingredients"
  on public.meal_ingredients for select using (public.is_approved());

create policy "head chef + sous chefs + admin can add ingredients"
  on public.meal_ingredients for insert
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and public.can_edit_meal_ingredients(meal_id)
  );

create policy "head chef + sous chefs + admin can update ingredients"
  on public.meal_ingredients for update
  using (public.can_edit_meal_ingredients(meal_id))
  with check (public.can_edit_meal_ingredients(meal_id));

create policy "head chef + sous chefs + admin can delete ingredients"
  on public.meal_ingredients for delete
  using (public.can_edit_meal_ingredients(meal_id));

alter publication supabase_realtime add table public.meal_ingredients;
