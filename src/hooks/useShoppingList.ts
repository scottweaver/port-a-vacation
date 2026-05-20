import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, writeQueue } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import type { ShoppingListEntry } from '@/types/db';

interface State {
  /** itemId → purchased flag. Map presence = on the list. */
  entries: Map<string, boolean>;
  loading: boolean;
  error: string | null;
}

const cacheKeyFor = (familyId: string) => `shopping-list:${familyId}`;

interface CachedEntry {
  item_id: string;
  purchased: boolean;
}

function hydrate(familyId: string | null): State {
  if (!familyId) return { entries: new Map(), loading: false, error: null };
  const cached = cache.get<CachedEntry[]>(cacheKeyFor(familyId));
  if (!cached) return { entries: new Map(), loading: true, error: null };
  return { entries: new Map(cached.map((e) => [e.item_id, e.purchased])), loading: false, error: null };
}

/**
 * Family-private shopping list. Unlike usePacking (which derives membership
 * from `contributions`), shopping list is an explicit opt-in: tap the bag
 * icon on a checklist row to add. Each entry has a `purchased` flag for
 * the Got/Need toggle in ShoppingView.
 */
export function useShoppingList(currentUserId: string | null, myFamilyId: string | null) {
  const [state, setState] = useState<State>(() => hydrate(myFamilyId));

  // Persist on every change (keyed per family).
  useEffect(() => {
    if (!myFamilyId) return;
    if (state.loading) return;
    const flat: CachedEntry[] = [];
    for (const [item_id, purchased] of state.entries.entries()) flat.push({ item_id, purchased });
    cache.set(cacheKeyFor(myFamilyId), flat);
  }, [state.entries, state.loading, myFamilyId]);

  useEffect(() => {
    if (!myFamilyId) {
      setState({ entries: new Map(), loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function loadAll() {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('item_id, purchased')
        .eq('family_id', myFamilyId);

      if (cancelled) return;

      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }

      const entries = new Map<string, boolean>();
      for (const row of data ?? []) entries.set(row.item_id as string, row.purchased as boolean);
      setState({ entries, loading: false, error: null });
    }

    void loadAll();

    const unsubReconnect = subscribeReconnect(() => { void loadAll(); });

    const channel = supabase
      .channel(`shopping-${myFamilyId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list', filter: `family_id=eq.${myFamilyId}` },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const entries = new Map(s.entries);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { item_id?: string };
              if (old.item_id) entries.delete(old.item_id);
            } else {
              const row = payload.new as { item_id: string; purchased: boolean };
              entries.set(row.item_id, row.purchased);
            }
            return { ...s, entries };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      unsubReconnect();
      supabase.removeChannel(channel);
    };
  }, [myFamilyId]);

  const addToList = useCallback((itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    if (state.entries.has(itemId)) return;
    setState((s) => {
      const entries = new Map(s.entries);
      entries.set(itemId, false);
      return { ...s, entries };
    });
    const now = new Date().toISOString();
    writeQueue.enqueue({
      table: 'shopping_list',
      op: 'upsert',
      payload: {
        item_id: itemId,
        family_id: myFamilyId,
        purchased: false,
        added_by: currentUserId,
        added_at: now,
        updated_at: now,
      },
    });
    void writeQueue.flush();
  }, [currentUserId, myFamilyId, state.entries]);

  const removeFromList = useCallback((itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    setState((s) => {
      if (!s.entries.has(itemId)) return s;
      const entries = new Map(s.entries);
      entries.delete(itemId);
      return { ...s, entries };
    });
    writeQueue.enqueue({
      table: 'shopping_list',
      op: 'delete',
      key: { item_id: itemId, family_id: myFamilyId },
    });
    void writeQueue.flush();
  }, [currentUserId, myFamilyId]);

  const togglePurchased = useCallback((itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    const current = state.entries.get(itemId);
    if (current === undefined) return;
    const next = !current;
    setState((s) => {
      const entries = new Map(s.entries);
      entries.set(itemId, next);
      return { ...s, entries };
    });
    writeQueue.enqueue({
      table: 'shopping_list',
      op: 'updatePurchased',
      key: { item_id: itemId, family_id: myFamilyId },
      payload: { purchased: next },
    });
    void writeQueue.flush();
  }, [currentUserId, myFamilyId, state.entries]);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  return {
    entries: state.entries,
    loading: state.loading,
    error: state.error,
    addToList,
    removeFromList,
    togglePurchased,
  };
}

/** Convenience helper for components that just want to know if an item is
 *  on the list, without caring about its purchased state. */
export function isOnList(entries: Map<string, boolean>, itemId: string): boolean {
  return entries.has(itemId);
}

export type { ShoppingListEntry };
