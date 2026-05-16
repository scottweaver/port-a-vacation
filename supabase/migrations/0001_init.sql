-- =============================================================================
-- Port A 2026 Trip Dashboard — Initial Migration
-- Run this entire file in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Idempotent: safe to re-run.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.is_approved();
drop function if exists public.is_admin();
drop function if exists public.touch_contribution_updated_at();
drop table if exists public.contributions cascade;
drop table if exists public.checklist_items cascade;
drop table if exists public.profiles cascade;
drop table if exists public.families cascade;

-- Families
create table public.families (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  display_name text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

insert into public.families (name, display_name, sort_order) values
  ('weaver',    'The Weavers',    10),
  ('ramirez',   'The Ramirezes',  20),
  ('titsworth', 'The Titsworths', 30);

-- Profiles
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text,
  avatar_url   text,
  family_id    uuid references public.families(id) on delete set null,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'denied')),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid references auth.users(id)
);

create index profiles_status_idx    on public.profiles(status);
create index profiles_family_id_idx on public.profiles(family_id);

-- Checklist items
create table public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  label         text not null,
  tracking_type text not null default 'quantity'
                  check (tracking_type in ('quantity', 'task')),
  is_default    boolean not null default false,
  sort_order    int not null default 0,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index checklist_items_category_idx on public.checklist_items(category, sort_order);

-- Contributions
create table public.contributions (
  item_id     uuid not null references public.checklist_items(id) on delete cascade,
  family_id   uuid not null references public.families(id) on delete cascade,
  quantity    int  not null default 0 check (quantity >= 0),
  done        boolean not null default false,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (item_id, family_id)
);

create index contributions_family_id_idx on public.contributions(family_id);
create index contributions_item_id_idx   on public.contributions(item_id);

-- Touch trigger
create or replace function public.touch_contribution_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger contributions_touch_updated_at
  before update on public.contributions
  for each row execute function public.touch_contribution_updated_at();

-- New-user trigger: auto-create profile; auto-admin Scott
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner        boolean;
  owner_family_id uuid;
begin
  is_owner := new.email = 'scott.t.weaver@gmail.com';
  if is_owner then
    select id into owner_family_id from public.families where name = 'weaver';
  end if;

  insert into public.profiles (id, email, display_name, avatar_url, family_id, is_admin, status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    owner_family_id,
    is_owner,
    case when is_owner then 'approved' else 'pending' end,
    case when is_owner then now() else null end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS helper functions
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true and status = 'approved');
$$;

-- RLS
alter table public.families        enable row level security;
alter table public.profiles        enable row level security;
alter table public.checklist_items enable row level security;
alter table public.contributions   enable row level security;

create policy "authenticated users can read families"
  on public.families for select to authenticated using (true);

create policy "users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "approved users can read all profiles"
  on public.profiles for select using (public.is_approved());

create policy "users can update own family"
  on public.profiles for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and status = (select status from public.profiles where id = auth.uid())
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
  );

create policy "admins can update profiles"
  on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy "approved users can read items"
  on public.checklist_items for select using (public.is_approved());

create policy "approved users can insert items"
  on public.checklist_items for insert with check (public.is_approved() and auth.uid() = created_by);

create policy "creator or admin can delete custom items"
  on public.checklist_items for delete
  using (
    public.is_approved()
    and is_default = false
    and (created_by = auth.uid() or public.is_admin())
  );

create policy "approved users can read contributions"
  on public.contributions for select using (public.is_approved());

create policy "approved users can insert contributions"
  on public.contributions for insert with check (public.is_approved() and auth.uid() = updated_by);

create policy "approved users can update contributions"
  on public.contributions for update using (public.is_approved())
  with check (public.is_approved() and auth.uid() = updated_by);

create policy "approved users can delete contributions"
  on public.contributions for delete using (public.is_approved());

-- Realtime
alter publication supabase_realtime add table public.families;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.contributions;

-- Seeds
insert into public.checklist_items (category, label, tracking_type, is_default, sort_order) values
  ('beach', 'Sunscreen (SPF 50+)',                   'quantity', true, 10),
  ('beach', 'Aloe vera / after-sun lotion',          'quantity', true, 20),
  ('beach', 'Beach umbrellas',                       'quantity', true, 30),
  ('beach', 'Beach chairs',                          'quantity', true, 40),
  ('beach', 'Beach wagon / cart',                    'quantity', true, 50),
  ('beach', 'Beach towels',                          'quantity', true, 60),
  ('beach', 'Boogie boards',                         'quantity', true, 70),
  ('beach', 'Sand toys / buckets / shovels (sets)',  'quantity', true, 80),
  ('beach', 'Coolers',                               'quantity', true, 90),
  ('beach', 'Insulated water bottles',               'quantity', true, 100),
  ('beach', 'Beach tent / pop-up shade',             'quantity', true, 110),
  ('beach', 'Goggles / swim masks',                  'quantity', true, 120),
  ('beach', 'Frisbee / football / paddle ball sets', 'quantity', true, 130),
  ('beach', 'Waterproof phone pouches',              'quantity', true, 140),
  ('beach', 'First aid kits',                        'quantity', true, 150),
  ('beach', 'Insect repellent',                      'quantity', true, 160),
  ('clothing', 'Swimsuits',                          'quantity', true, 10),
  ('clothing', 'Rash guards / swim shirts',          'quantity', true, 20),
  ('clothing', 'Cover-ups / beach shirts',           'quantity', true, 30),
  ('clothing', 'T-shirts',                           'quantity', true, 40),
  ('clothing', 'Shorts',                             'quantity', true, 50),
  ('clothing', 'Nice outfits (dinner out)',          'quantity', true, 60),
  ('clothing', 'Pajamas',                            'quantity', true, 70),
  ('clothing', 'Underwear & socks (count people)',   'quantity', true, 80),
  ('clothing', 'Light jackets / hoodies',            'quantity', true, 90),
  ('clothing', 'Flip flops (pairs)',                 'quantity', true, 100),
  ('clothing', 'Water shoes (pairs)',                'quantity', true, 110),
  ('clothing', 'Sneakers (pairs)',                   'quantity', true, 120),
  ('clothing', 'Hats / visors',                      'quantity', true, 130),
  ('clothing', 'Sunglasses',                         'quantity', true, 140),
  ('clothing', 'Laundry bag for wet/dirty clothes',  'quantity', true, 150),
  ('car', 'Fill gas tank night before',              'task', true, 10),
  ('car', 'Check tire pressure',                     'task', true, 20),
  ('car', 'Check oil & coolant',                     'task', true, 30),
  ('car', 'Wash windshield',                         'task', true, 40),
  ('car', 'Phone chargers packed',                   'task', true, 50),
  ('car', 'Car snacks & drinks',                     'task', true, 60),
  ('car', 'Trash bag in car',                        'task', true, 70),
  ('car', 'Paper towels & wet wipes',                'task', true, 80),
  ('car', 'Sunshades for windows',                   'task', true, 90),
  ('car', 'Pillows for kids',                        'task', true, 100),
  ('car', 'Tablets / headphones / chargers',         'task', true, 110),
  ('car', 'Offline maps & playlists downloaded',     'task', true, 120),
  ('car', 'Audiobooks / podcasts queued',            'task', true, 130),
  ('car', 'Motion sickness meds (just in case)',     'task', true, 140),
  ('car', 'Cash for tolls / beach permit',           'task', true, 150),
  ('house', 'Take out all trash',                    'task', true, 10),
  ('house', 'Empty fridge of perishables',           'task', true, 20),
  ('house', 'Run dishwasher',                        'task', true, 30),
  ('house', 'Start/empty washing machine',           'task', true, 40),
  ('house', 'Set thermostat (78-80°F)',              'task', true, 50),
  ('house', 'Turn off water to washer',              'task', true, 60),
  ('house', 'Unplug non-essential electronics',      'task', true, 70),
  ('house', 'Set timer lights or smart plugs',       'task', true, 80),
  ('house', 'Lock all windows & doors',              'task', true, 90),
  ('house', 'Check garage door',                     'task', true, 100),
  ('house', 'Hold mail / pause deliveries',          'task', true, 110),
  ('house', 'Arrange pet care',                      'task', true, 120),
  ('house', 'Water plants',                          'task', true, 130),
  ('house', 'Set security system',                   'task', true, 140),
  ('house', 'Leave key with trusted neighbor',       'task', true, 150),
  ('documents', 'Condo confirmation copies',         'quantity', true, 10),
  ('documents', 'Driver''s licenses (adults)',       'quantity', true, 20),
  ('documents', 'Insurance cards',                   'quantity', true, 30),
  ('documents', 'Cash ($100+ small bills) — bundles','quantity', true, 40),
  ('documents', 'Beach parking permits',             'quantity', true, 50),
  ('documents', 'Reusable shopping bags',            'quantity', true, 60),
  ('documents', 'Toiletry bags',                     'quantity', true, 70),
  ('documents', 'Phone & laptop chargers',           'quantity', true, 80),
  ('documents', 'Power strips',                      'quantity', true, 90),
  ('documents', 'Cameras + chargers',                'quantity', true, 100),
  ('documents', 'Books / Kindles',                   'quantity', true, 110),
  ('documents', 'Band-aids (boxes)',                 'quantity', true, 120),
  ('documents', 'Anti-itch cream',                   'quantity', true, 130);


