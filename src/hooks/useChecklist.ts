import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase, writeQueue } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import type { ChecklistItem, Contribution, TrackingType } from '@/types/db';

interface State {
  items: ChecklistItem[];
  contributions: Map<string, Contribution>;
  loading: boolean;
  error: string | null;
}

interface CachedShape {
  items: ChecklistItem[];
  contributions: Array<[string, Contribution]>;
}

const CACHE_KEY = 'checklist';
const contribKey = (itemId: string, familyId: string) => `${itemId}::${familyId}`;
const DEBOUNCE_MS = 250;

function hydrate(): State {
  const cached = cache.get<CachedShape>(CACHE_KEY);
  if (!cached) {
    return { items: [], contributions: new Map(), loading: true, error: null };
  }
  return {
    items: cached.items,
    contributions: new Map(cached.contributions),
    loading: false,
    error: null,
  };
}

export function useChecklist(currentUserId: string | null) {
  const [state, setState] = useState<State>(hydrate);

  // Latest state for the debounced writer to read without re-creating closures.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Persist items + contributions to localStorage on every change. Cheap
  // (a few KB) and keeps the cache in sync with optimistic state, so a
  // reload-while-offline shows the user's pending edits.
  useEffect(() => {
    if (state.loading) return;
    cache.set<CachedShape>(CACHE_KEY, {
      items: state.items,
      contributions: [...state.contributions.entries()],
    });
  }, [state.items, state.contributions, state.loading]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const [itemsRes, contribRes] = await Promise.all([
        supabase.from('checklist_items').select('*').order('category').order('sort_order'),
        supabase.from('contributions').select('*'),
      ]);

      if (cancelled) return;

      if (itemsRes.error || contribRes.error) {
        setState((s) => ({
          ...s,
          loading: false,
          error: itemsRes.error?.message ?? contribRes.error?.message ?? 'Failed to load',
        }));
        return;
      }

      const items = (itemsRes.data ?? []) as ChecklistItem[];
      const contributions = new Map<string, Contribution>();
      for (const c of (contribRes.data ?? []) as Contribution[]) {
        contributions.set(contribKey(c.item_id, c.family_id), c);
      }
      setState({ items, contributions, loading: false, error: null });
    }

    loadAll();

    // Refetch on reconnect — realtime drops events while we're offline, so
    // a clean reload catches up to current server state.
    const unsubReconnect = subscribeReconnect(() => { void loadAll(); });

    const channel = supabase
      .channel('checklist-and-contributions')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_items' },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const items = [...s.items];
            if (payload.eventType === 'INSERT') {
              const row = payload.new as ChecklistItem;
              if (!items.some((i) => i.id === row.id)) items.push(row);
              items.sort((a, b) =>
                a.category === b.category ? a.sort_order - b.sort_order : a.category.localeCompare(b.category),
              );
            } else if (payload.eventType === 'UPDATE') {
              const row = payload.new as ChecklistItem;
              const idx = items.findIndex((i) => i.id === row.id);
              if (idx >= 0) items[idx] = row;
            } else if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Partial<ChecklistItem>;
              return { ...s, items: items.filter((i) => i.id !== oldRow.id) };
            }
            return { ...s, items };
          });
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'contributions' },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const contributions = new Map(s.contributions);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Partial<Contribution>;
              if (old.item_id && old.family_id) {
                contributions.delete(contribKey(old.item_id, old.family_id));
              }
            } else {
              const row = payload.new as Contribution;
              contributions.set(contribKey(row.item_id, row.family_id), row);
            }
            return { ...s, contributions };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      unsubReconnect();
      supabase.removeChannel(channel);
    };
  }, []);

  // Enqueue the latest optimistic contribution for this key and trigger a
  // flush. If we're online, the flush completes immediately; if offline,
  // the entry waits in localStorage until the next reconnect.
  const flushWrite = useCallback((key: string) => {
    const latest = stateRef.current.contributions.get(key);
    if (!latest) return;
    writeQueue.enqueue({
      table: 'contributions',
      op: 'upsert',
      payload: latest,
    });
    void writeQueue.flush();
  }, []);

  // Reset a 250ms debounce per (item,family) key. Rapid presses coalesce
  // into a single enqueued op with the final optimistic value.
  const scheduleWrite = useCallback((key: string) => {
    const existing = pendingTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      pendingTimers.current.delete(key);
      flushWrite(key);
    }, DEBOUNCE_MS);
    pendingTimers.current.set(key, timer);
  }, [flushWrite]);

  // Flush pending writes on tab hide / unmount so late presses aren't lost.
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

  const adjustQuantity = useCallback(
    async (itemId: string, familyId: string, delta: number) => {
      if (!currentUserId) throw new Error('Not signed in');
      const key = contribKey(itemId, familyId);
      const updatedAt = new Date().toISOString();
      setState((s) => {
        const existing = s.contributions.get(key);
        const next = Math.max(0, (existing?.quantity ?? 0) + delta);
        const optimistic: Contribution = {
          item_id: itemId,
          family_id: familyId,
          quantity: next,
          done: next > 0,
          updated_by: currentUserId,
          updated_at: updatedAt,
        };
        const contributions = new Map(s.contributions);
        contributions.set(key, optimistic);
        return { ...s, contributions };
      });
      scheduleWrite(key);
    },
    [currentUserId, scheduleWrite],
  );

  const toggleTask = useCallback(
    async (itemId: string, familyId: string) => {
      if (!currentUserId) throw new Error('Not signed in');
      const key = contribKey(itemId, familyId);
      const updatedAt = new Date().toISOString();
      setState((s) => {
        const existing = s.contributions.get(key);
        const optimistic: Contribution = {
          item_id: itemId,
          family_id: familyId,
          quantity: existing?.quantity ?? 0,
          done: !(existing?.done ?? false),
          updated_by: currentUserId,
          updated_at: updatedAt,
        };
        const contributions = new Map(s.contributions);
        contributions.set(key, optimistic);
        return { ...s, contributions };
      });
      scheduleWrite(key);
    },
    [currentUserId, scheduleWrite],
  );

  const claimItem = useCallback(
    async (itemId: string, familyId: string) => {
      if (!currentUserId) throw new Error('Not signed in');

      const priorByFamily = new Map<string, Contribution>();
      for (const c of state.contributions.values()) {
        if (c.item_id === itemId) priorByFamily.set(c.family_id, c);
      }

      const optimistic: Contribution = {
        item_id: itemId,
        family_id: familyId,
        quantity: 0,
        done: true,
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      };

      setState((s) => {
        const contributions = new Map(s.contributions);
        for (const fid of priorByFamily.keys()) {
          contributions.delete(contribKey(itemId, fid));
        }
        contributions.set(contribKey(itemId, familyId), optimistic);
        return { ...s, contributions };
      });

      // Enqueue each prior-family delete + the upsert. They flush FIFO so
      // the upsert lands after the deletes complete.
      for (const otherFamilyId of priorByFamily.keys()) {
        if (otherFamilyId === familyId) continue;
        writeQueue.enqueue({
          table: 'contributions',
          op: 'delete',
          key: { item_id: itemId, family_id: otherFamilyId },
        });
      }
      writeQueue.enqueue({
        table: 'contributions',
        op: 'upsert',
        payload: optimistic,
      });
      void writeQueue.flush();
    },
    [currentUserId, state.contributions],
  );

  const unclaimItem = useCallback(
    async (itemId: string) => {
      setState((s) => {
        const contributions = new Map(s.contributions);
        for (const k of [...contributions.keys()]) {
          if (k.startsWith(`${itemId}::`)) contributions.delete(k);
        }
        return { ...s, contributions };
      });
      writeQueue.enqueue({
        table: 'contributions',
        op: 'deleteByItem',
        key: { item_id: itemId },
      });
      void writeQueue.flush();
    },
    [],
  );

  const addCustomItem = useCallback(
    async (category: string, label: string, trackingType: TrackingType) => {
      if (!currentUserId) throw new Error('Not signed in');

      const maxOrder = state.items
        .filter((i) => i.category === category)
        .reduce((m, i) => Math.max(m, i.sort_order), 0);

      // Mint UUID client-side so the optimistic row matches the eventual
      // server row. The schema accepts client-provided ids.
      const optimistic: ChecklistItem = {
        id: crypto.randomUUID(),
        category,
        label: label.trim(),
        tracking_type: trackingType,
        is_default: false,
        sort_order: maxOrder + 10,
        created_by: currentUserId,
        created_at: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        items: [...s.items, optimistic].sort((a, b) =>
          a.category === b.category ? a.sort_order - b.sort_order : a.category.localeCompare(b.category),
        ),
      }));

      writeQueue.enqueue({
        table: 'checklist_items',
        op: 'insert',
        payload: optimistic,
      });
      void writeQueue.flush();

      return optimistic;
    },
    [currentUserId, state.items],
  );

  const deleteCustomItem = useCallback(async (itemId: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }));
    writeQueue.enqueue({
      table: 'checklist_items',
      op: 'delete',
      key: { id: itemId },
    });
    void writeQueue.flush();
  }, []);

  const itemsByCategory = useMemo(() => {
    const groups = new Map<string, ChecklistItem[]>();
    for (const item of state.items) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return groups;
  }, [state.items]);

  const getContribution = useCallback(
    (itemId: string, familyId: string): Contribution | undefined =>
      state.contributions.get(contribKey(itemId, familyId)),
    [state.contributions],
  );

  return {
    items: state.items,
    itemsByCategory,
    contributions: state.contributions,
    getContribution,
    loading: state.loading,
    error: state.error,
    adjustQuantity,
    toggleTask,
    claimItem,
    unclaimItem,
    addCustomItem,
    deleteCustomItem,
  };
}
