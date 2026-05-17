import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, writeQueue } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';

interface State {
  hidden: Set<string>;
  loading: boolean;
  error: string | null;
}

const cacheKeyFor = (familyId: string) => `hidden:${familyId}`;

function hydrate(familyId: string | null): State {
  if (!familyId) return { hidden: new Set(), loading: false, error: null };
  const cached = cache.get<string[]>(cacheKeyFor(familyId));
  if (!cached) return { hidden: new Set(), loading: true, error: null };
  return { hidden: new Set(cached), loading: false, error: null };
}

/**
 * Family-scoped hide list for checklist items. Same shape as usePacking —
 * a Set of item_ids the family has hidden — but unrelated semantics:
 * hidden items disappear from the Trip planning view AND from Pack, and
 * surface in a default-collapsed per-category "Hidden items" subsection.
 */
export function useHiddenItems(currentUserId: string | null, myFamilyId: string | null) {
  const [state, setState] = useState<State>(() => hydrate(myFamilyId));

  // Persist on every change (keyed per family).
  useEffect(() => {
    if (!myFamilyId) return;
    if (state.loading) return;
    cache.set(cacheKeyFor(myFamilyId), [...state.hidden]);
  }, [state.hidden, state.loading, myFamilyId]);

  useEffect(() => {
    if (!myFamilyId) {
      setState({ hidden: new Set(), loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function loadAll() {
      const { data, error } = await supabase
        .from('hidden_items')
        .select('item_id')
        .eq('family_id', myFamilyId);

      if (cancelled) return;

      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }

      const hidden = new Set<string>((data ?? []).map((r) => r.item_id as string));
      setState({ hidden, loading: false, error: null });
    }

    loadAll();

    const unsubReconnect = subscribeReconnect(() => { void loadAll(); });

    const channel = supabase
      .channel(`hidden-${myFamilyId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'hidden_items', filter: `family_id=eq.${myFamilyId}` },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const hidden = new Set(s.hidden);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { item_id?: string };
              if (old.item_id) hidden.delete(old.item_id);
            } else {
              const row = payload.new as { item_id: string };
              hidden.add(row.item_id);
            }
            return { ...s, hidden };
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

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const hideItem = useCallback((itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    setState((s) => {
      const hidden = new Set(s.hidden);
      hidden.add(itemId);
      return { ...s, hidden };
    });
    writeQueue.enqueue({
      table: 'hidden_items',
      op: 'upsert',
      payload: {
        item_id: itemId,
        family_id: myFamilyId,
        hidden_by: currentUserId,
        hidden_at: new Date().toISOString(),
      },
    });
    void writeQueue.flush();
  }, [currentUserId, myFamilyId]);

  const unhideItem = useCallback((itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    setState((s) => {
      const hidden = new Set(s.hidden);
      hidden.delete(itemId);
      return { ...s, hidden };
    });
    writeQueue.enqueue({
      table: 'hidden_items',
      op: 'delete',
      key: { item_id: itemId, family_id: myFamilyId },
    });
    void writeQueue.flush();
  }, [currentUserId, myFamilyId]);

  return {
    hidden: state.hidden,
    loading: state.loading,
    error: state.error,
    hideItem,
    unhideItem,
  };
}
