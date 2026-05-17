import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChecklistItem, Contribution, TrackingType } from '@/types/db';

interface State {
  items: ChecklistItem[];
  contributions: Map<string, Contribution>;
  loading: boolean;
  error: string | null;
}

const contribKey = (itemId: string, familyId: string) => `${itemId}::${familyId}`;

export function useChecklist(currentUserId: string | null) {
  const [state, setState] = useState<State>({
    items: [],
    contributions: new Map(),
    loading: true,
    error: null,
  });

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

  const setContribution = useCallback(
    async (itemId: string, familyId: string, patch: { quantity?: number; done?: boolean }) => {
      if (!currentUserId) throw new Error('Not signed in');

      const key = contribKey(itemId, familyId);
      const existing = state.contributions.get(key);
      const optimistic: Contribution = {
        item_id: itemId,
        family_id: familyId,
        quantity: patch.quantity ?? existing?.quantity ?? 0,
        done: patch.done ?? existing?.done ?? false,
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      };

      setState((s) => {
        const contributions = new Map(s.contributions);
        contributions.set(key, optimistic);
        return { ...s, contributions };
      });

      const { error } = await supabase
        .from('contributions')
        .upsert(optimistic, { onConflict: 'item_id,family_id' });

      if (error) {
        setState((s) => {
          const contributions = new Map(s.contributions);
          if (existing) contributions.set(key, existing);
          else contributions.delete(key);
          return { ...s, contributions, error: error.message };
        });
        throw error;
      }
    },
    [currentUserId, state.contributions],
  );

  const adjustQuantity = useCallback(
    async (itemId: string, familyId: string, delta: number) => {
      const existing = state.contributions.get(contribKey(itemId, familyId));
      const next = Math.max(0, (existing?.quantity ?? 0) + delta);
      await setContribution(itemId, familyId, { quantity: next, done: next > 0 });
    },
    [setContribution, state.contributions],
  );

  const toggleTask = useCallback(
    async (itemId: string, familyId: string) => {
      const existing = state.contributions.get(contribKey(itemId, familyId));
      await setContribution(itemId, familyId, { done: !(existing?.done ?? false) });
    },
    [setContribution, state.contributions],
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
    setContribution,
    adjustQuantity,
    toggleTask,
    claimItem,
    unclaimItem,
    addCustomItem,
    deleteCustomItem,
  };
}


