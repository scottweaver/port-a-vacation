-- =============================================================================
-- condo_info: single-row table holding the condo's variable info that the
-- admin can edit at runtime (door code, pool code, wifi, host contact,
-- check-in/out times, bike + golf cart rental info, free-form notes).
--
-- Single-row enforced via `id integer primary key check (id = 1)`. The row
-- is seeded by this migration so the app can always read a value (even if
-- every field is null).
--
-- Read access: all approved users. Write access: admin only. Realtime so
-- updates appear instantly on every family member's device without a
-- refresh.
-- =============================================================================

create table public.condo_info (
  id                    integer primary key check (id = 1),
  door_code             text,
  pool_code             text,
  wifi_ssid             text,
  wifi_password         text,
  host_name             text,
  host_phone            text,
  check_in_time         text,
  check_out_time        text,
  bike_rental_name      text,
  bike_rental_address   text,
  bike_rental_phone     text,
  golf_cart_name        text,
  golf_cart_address     text,
  golf_cart_phone       text,
  notes                 text,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id) on delete set null
);

-- Touch updated_at on every UPDATE.
create or replace function public.touch_condo_info_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger condo_info_updated_at_trigger
  before update on public.condo_info
  for each row execute function public.touch_condo_info_updated_at();

alter table public.condo_info enable row level security;

create policy "approved users can read condo info"
  on public.condo_info for select using (public.is_approved());

create policy "admin can update condo info"
  on public.condo_info for update
  using (public.is_admin())
  with check (public.is_admin());

-- Seed the single row with the two rentals Scott provided up front. Every
-- other field starts null and gets filled in via the admin UI.
insert into public.condo_info (
  id,
  bike_rental_name,     bike_rental_address,                  bike_rental_phone,
  golf_cart_name,       golf_cart_address,                    golf_cart_phone
) values (
  1,
  'Big Shell Bikes',    '403 N. Alister, Port Aransas, TX',   '361-445-7001',
  'Joy Carts',          '307 Sea Isle Dr, Port Aransas, TX',  '361-749-2278'
)
on conflict (id) do nothing;

alter publication supabase_realtime add table public.condo_info;
