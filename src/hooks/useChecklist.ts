import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChecklistItem, Contribution, TrackingType } from '@/types/db';

interface State {
  items: ChecklistItem[];
  contributions: Map<string, Contribution>;
  loading: boolean;
  error: string | null;
}

const contribKey = (itemId: string, familyId: string) => `${itemId}::${familyId}`;
const DEBOUNCE_MS = 250;

export function useChecklist(currentUserId: string | null) {
  const [state, setState] = useState<State>({
    items: [],
    contributions: new Map(),
    loading: true,
    error: null,
  });

  // Latest state for the debounced writer to read without re-creating closures
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
      supabase.removeChannel(channel);
    };
  }, []);

  // Flush the latest optimistic value for a key to the server. On error, refetch
  // the row to recover from divergence.
  const flushWrite = useCallback(async (key: string) => {
    const latest = stateRef.current.contributions.get(key);
    if (!latest) return;
    const { error } = await supabase
      .from('contributions')
      .upsert(latest, { onConflict: 'item_id,family_id' });
    if (!error) return;
    const [itemId, familyId] = key.split('::');
    const { data } = await supabase
      .from('contributions')
      .select('*')
      .eq('item_id', itemId)
      .eq('family_id', familyId)
      .maybeSingle();
    setState((s) => {
      const contributions = new Map(s.contributions);
      if (data) contributions.set(key, data as Contribution);
      else contributions.delete(key);
      return { ...s, contributions, error: error.message };
    });
  }, []);

  // Reset a 250ms debounce per (item,family) key. Rapid presses coalesce into
  // one upsert with the final optimistic value.
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

      const otherFamilyIds = [...priorByFamily.keys()].filter((fid) => fid !== familyId);
      if (otherFamilyIds.length > 0) {
        const { error: delErr } = await supabase
          .from('contributions')
          .delete()
          .eq('item_id', itemId)
          .in('family_id', otherFamilyIds);
        if (delErr) {
          setState((s) => {
            const contributions = new Map(s.contributions);
            for (const [fid, prior] of priorByFamily) {
              contributions.set(contribKey(itemId, fid), prior);
            }
            return { ...s, contributions, error: delErr.message };
          });
          throw delErr;
        }
      }

      const { error: upsertErr } = await supabase
        .from('contributions')
        .upsert(optimistic, { onConflict: 'item_id,family_id' });
      if (upsertErr) {
        setState((s) => {
          const contributions = new Map(s.contributions);
          for (const [fid, prior] of priorByFamily) {
            contributions.set(contribKey(itemId, fid), prior);
          }
          if (!priorByFamily.has(familyId)) contributions.delete(contribKey(itemId, familyId));
          return { ...s, contributions, error: upsertErr.message };
        });
        throw upsertErr;
      }
    },
    [currentUserId, state.contributions],
  );

  const unclaimItem = useCallback(
    async (itemId: string) => {
      const prior = new Map<string, Contribution>();
      for (const c of state.contributions.values()) {
        if (c.item_id === itemId) prior.set(c.family_id, c);
      }

      setState((s) => {
        const contributions = new Map(s.contributions);
        for (const fid of prior.keys()) {
          contributions.delete(contribKey(itemId, fid));
        }
        return { ...s, contributions };
      });

      const { error } = await supabase.from('contributions').delete().eq('item_id', itemId);
      if (error) {
        setState((s) => {
          const contributions = new Map(s.contributions);
          for (const [fid, p] of prior) {
            contributions.set(contribKey(itemId, fid), p);
          }
          return { ...s, contributions, error: error.message };
        });
        throw error;
      }
    },
    [state.contributions],
  );

  const addCustomItem = useCallback(
    async (category: string, label: string, trackingType: TrackingType) => {
      if (!currentUserId) throw new Error('Not signed in');

      const maxOrder = state.items
        .filter((i) => i.category === category)
        .reduce((m, i) => Math.max(m, i.sort_order), 0);

      const { data, error } = await supabase
        .from('checklist_items')
        .insert({
          category,
          label: label.trim(),
          tracking_type: trackingType,
          is_default: false,
          sort_order: maxOrder + 10,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ChecklistItem;
    },
    [currentUserId, state.items],
  );

  const deleteCustomItem = useCallback(async (itemId: string) => {
    const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
    if (error) throw error;
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
