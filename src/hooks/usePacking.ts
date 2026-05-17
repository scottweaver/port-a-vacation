import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface State {
  packed: Set<string>;
  loading: boolean;
  error: string | null;
}

const DEBOUNCE_MS = 200;

export function usePacking(currentUserId: string | null, myFamilyId: string | null) {
  const [state, setState] = useState<State>({
    packed: new Set(),
    loading: true,
    error: null,
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!myFamilyId) {
      setState({ packed: new Set(), loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function loadAll() {
      const { data, error } = await supabase
        .from('packing_status')
        .select('item_id')
        .eq('family_id', myFamilyId);

      if (cancelled) return;

      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }

      const packed = new Set<string>((data ?? []).map((r) => r.item_id as string));
      setState({ packed, loading: false, error: null });
    }

    loadAll();

    const channel = supabase
      .channel(`packing-${myFamilyId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'packing_status', filter: `family_id=eq.${myFamilyId}` },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const packed = new Set(s.packed);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { item_id?: string };
              if (old.item_id) packed.delete(old.item_id);
            } else {
              const row = payload.new as { item_id: string };
              packed.add(row.item_id);
            }
            return { ...s, packed };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [myFamilyId]);

  // Ensure server state matches optimistic local state for this item.
  // If locally packed, INSERT (no-op on conflict). If locally unpacked, DELETE.
  // Both ops are idempotent.
  const flushWrite = useCallback(async (itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    const isPacked = stateRef.current.packed.has(itemId);
    if (isPacked) {
      const { error } = await supabase
        .from('packing_status')
        .upsert(
          {
            item_id: itemId,
            family_id: myFamilyId,
            updated_by: currentUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'item_id,family_id', ignoreDuplicates: true },
        );
      if (error) setState((s) => ({ ...s, error: error.message }));
    } else {
      const { error } = await supabase
        .from('packing_status')
        .delete()
        .eq('item_id', itemId)
        .eq('family_id', myFamilyId);
      if (error) setState((s) => ({ ...s, error: error.message }));
    }
  }, [currentUserId, myFamilyId]);

  const scheduleWrite = useCallback((itemId: string) => {
    const existing = pendingTimers.current.get(itemId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingTimers.current.delete(itemId);
      flushWrite(itemId);
    }, DEBOUNCE_MS);
    pendingTimers.current.set(itemId, timer);
  }, [flushWrite]);

  // Flush pending writes on tab hide / unmount so quick toggles aren't lost.
  useEffect(() => {
    const flushAll = () => {
      for (const [key, timer] of pendingTimers.current.entries()) {
        clearTimeout(timer);
        flushWrite(key);
      }
      pendingTimers.current.clear();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushAll();
    };
  }, [flushWrite]);

  const togglePacked = useCallback((itemId: string) => {
    if (!currentUserId || !myFamilyId) return;
    setState((s) => {
      const packed = new Set(s.packed);
      if (packed.has(itemId)) packed.delete(itemId);
      else packed.add(itemId);
      return { ...s, packed };
    });
    scheduleWrite(itemId);
  }, [currentUserId, myFamilyId, scheduleWrite]);

  return {
    packed: state.packed,
    loading: state.loading,
    error: state.error,
    togglePacked,
  };
}
