-- =============================================================================
-- Add 'claim' tracking type for items that only one family needs to provide.
-- The row displays "Provided by the {family}" once a family has claimed it.
-- Single-claim semantics are enforced at the application layer (delete other
-- contributions, then upsert the claiming family's). RLS already permits this.
-- =============================================================================

do $$
declare
  cname text;
begin
  for cname in
    select conname from pg_constraint
    where conrelid = 'public.checklist_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tracking_type%'
  loop
    execute format('alter table public.checklist_items drop constraint %I', cname);
  end loop;
end$$;

alter table public.checklist_items
  add constraint checklist_items_tracking_type_check
  check (tracking_type in ('quantity', 'task', 'claim'));
