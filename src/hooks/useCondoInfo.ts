import { useEffect, useState, useCallback } from 'react';
import { supabase, writeQueue } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import type { CondoInfo, CondoInfoPatch } from '@/types/db';

const CACHE_KEY = 'condo-info:row';

interface State {
  info: CondoInfo | null;
  loading: boolean;
  error: string | null;
}

function hydrate(): State {
  const cached = cache.get<CondoInfo>(CACHE_KEY) ?? null;
  return {
    info: cached,
    loading: cached === null,
    error: null,
  };
}

/**
 * Single-row condo info (door code, pool code, wifi, host, rentals, etc).
 *
 * Reads available to all approved users; writes restricted to admin by RLS.
 * Realtime so admin saves propagate to every device instantly. Writes go
 * through the offline writeQueue so a tab close mid-flush doesn't lose data.
 */
export function useCondoInfo(currentUserId: string | null) {
  const [state, setState] = useState<State>(() => hydrate());

  // Persist on every change.
  useEffect(() => {
    if (state.info) cache.set(CACHE_KEY, state.info);
  }, [state.info]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('condo_info')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }
      setState({ info: (data as CondoInfo | null) ?? null, loading: false, error: null });
    }

    void load();
    const unsubReconnect = subscribeReconnect(() => { void load(); });

    const channel = supabase
      .channel('condo-info')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'condo_info' },
        (payload) => {
          if (cancelled) return;
          // Single-row table — UPDATE is the only realistic event in prod.
          if (payload.eventType === 'DELETE') return;
          const next = payload.new as CondoInfo;
          setState((s) => ({ ...s, info: next }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      unsubReconnect();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const updateInfo = useCallback((patch: CondoInfoPatch) => {
    if (!currentUserId) return;
    // Optimistic local update so the admin form reflects the save immediately
    // (and realtime confirms it for everyone else).
    setState((s) => {
      if (!s.info) return s;
      return {
        ...s,
        info: {
          ...s.info,
          ...patch,
          updated_by: currentUserId,
          updated_at: new Date().toISOString(),
        },
      };
    });
    writeQueue.enqueue({ table: 'condo_info', op: 'update', payload: patch });
    void writeQueue.flush();
  }, [currentUserId]);

  return {
    info: state.info,
    loading: state.loading,
    error: state.error,
    updateInfo,
  };
}
