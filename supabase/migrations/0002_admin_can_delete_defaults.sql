-- =============================================================================
-- Allow admins to delete default (seeded) checklist items.
-- Non-admins keep current behavior: they can only delete non-default items
-- they themselves created.
-- =============================================================================

drop policy if exists "creator or admin can delete custom items" on public.checklist_items;

create policy "creator or admin can delete items"
  on public.checklist_items for delete
  using (
    public.is_approved()
    and (
      (created_by = auth.uid() and is_default = false)
      or public.is_admin()
    )
  );
