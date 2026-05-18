import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase, writeQueue } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import type { Meal, MealIngredient, MealSousChef, MealType } from '@/types/db';

interface State {
  meals: Meal[];
  sousChefs: Map<string, Set<string>>; // meal_id -> Set<user_id>
  ingredients: Map<string, MealIngredient[]>; // meal_id -> sorted ingredient list
  loading: boolean;
  error: string | null;
}

const MEALS_CACHE_KEY = 'meals:list';
const SOUS_CACHE_KEY = 'meals:sous';
const INGREDIENTS_CACHE_KEY = 'meals:ingredients';

interface SousChefCacheEntry {
  meal_id: string;
  user_id: string;
}

function hydrate(): State {
  const cachedMeals = cache.get<Meal[]>(MEALS_CACHE_KEY) ?? null;
  const cachedSous = cache.get<SousChefCacheEntry[]>(SOUS_CACHE_KEY) ?? null;
  const cachedIngredients = cache.get<MealIngredient[]>(INGREDIENTS_CACHE_KEY) ?? null;

  const sousMap = new Map<string, Set<string>>();
  if (cachedSous) {
    for (const row of cachedSous) {
      let set = sousMap.get(row.meal_id);
      if (!set) { set = new Set(); sousMap.set(row.meal_id, set); }
      set.add(row.user_id);
    }
  }

  const ingMap = new Map<string, MealIngredient[]>();
  if (cachedIngredients) {
    for (const ing of cachedIngredients) {
      let arr = ingMap.get(ing.meal_id);
      if (!arr) { arr = []; ingMap.set(ing.meal_id, arr); }
      arr.push(ing);
    }
    for (const arr of ingMap.values()) arr.sort(sortIngredients);
  }

  return {
    meals: cachedMeals ?? [],
    sousChefs: sousMap,
    ingredients: ingMap,
    loading: cachedMeals === null,
    error: null,
  };
}

/**
 * Trip-level meal plan: who's cooking what, when, with which sous chefs.
 *
 * Unlike packing_status / hidden_items (family-private), meals are visible to
 * all approved users and any user can sign themselves up as a sous chef on
 * any meal. Head chef + admin can edit/delete the meal itself.
 *
 * Writes go through the offline writeQueue so a tab close mid-flush doesn't
 * lose data, and so the UI stays responsive offline.
 */
export function useMeals(currentUserId: string | null) {
  const [state, setState] = useState<State>(() => hydrate());

  // Persist meals + sous chefs + ingredients on every change.
  useEffect(() => {
    if (state.loading) return;
    cache.set(MEALS_CACHE_KEY, state.meals);
    const flat: SousChefCacheEntry[] = [];
    for (const [meal_id, set] of state.sousChefs.entries()) {
      for (const user_id of set) flat.push({ meal_id, user_id });
    }
    cache.set(SOUS_CACHE_KEY, flat);
    const flatIng: MealIngredient[] = [];
    for (const arr of state.ingredients.values()) flatIng.push(...arr);
    cache.set(INGREDIENTS_CACHE_KEY, flatIng);
  }, [state.meals, state.sousChefs, state.ingredients, state.loading]);

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    async function loadAll() {
      const [mealsRes, sousRes, ingRes] = await Promise.all([
        supabase.from('meals').select('*').order('meal_date').order('meal_type'),
        supabase.from('meal_sous_chefs').select('*'),
        supabase.from('meal_ingredients').select('*'),
      ]);

      if (cancelled) return;

      if (mealsRes.error) {
        setState((s) => ({ ...s, loading: false, error: mealsRes.error!.message }));
        return;
      }
      if (sousRes.error) {
        setState((s) => ({ ...s, loading: false, error: sousRes.error!.message }));
        return;
      }
      if (ingRes.error) {
        setState((s) => ({ ...s, loading: false, error: ingRes.error!.message }));
        return;
      }

      const sousMap = new Map<string, Set<string>>();
      for (const row of sousRes.data ?? []) {
        const r = row as MealSousChef;
        let set = sousMap.get(r.meal_id);
        if (!set) { set = new Set(); sousMap.set(r.meal_id, set); }
        set.add(r.user_id);
      }

      const ingMap = new Map<string, MealIngredient[]>();
      for (const row of ingRes.data ?? []) {
        const r = row as MealIngredient;
        let arr = ingMap.get(r.meal_id);
        if (!arr) { arr = []; ingMap.set(r.meal_id, arr); }
        arr.push(r);
      }
      for (const arr of ingMap.values()) arr.sort(sortIngredients);

      setState({
        meals: (mealsRes.data ?? []) as Meal[],
        sousChefs: sousMap,
        ingredients: ingMap,
        loading: false,
        error: null,
      });
    }

    loadAll();
    const unsubReconnect = subscribeReconnect(() => { void loadAll(); });

    const channel = supabase
      .channel('meals-and-sous-chefs')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meals' },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id?: string };
              if (!old.id) return s;
              return { ...s, meals: s.meals.filter((m) => m.id !== old.id) };
            }
            const next = payload.new as Meal;
            const exists = s.meals.some((m) => m.id === next.id);
            const meals = exists
              ? s.meals.map((m) => (m.id === next.id ? next : m))
              : [...s.meals, next];
            return { ...s, meals: sortMeals(meals) };
          });
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meal_sous_chefs' },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const sousChefs = new Map(s.sousChefs);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { meal_id?: string; user_id?: string };
              if (!old.meal_id || !old.user_id) return s;
              const set = sousChefs.get(old.meal_id);
              if (!set) return s;
              const updated = new Set(set);
              updated.delete(old.user_id);
              if (updated.size === 0) sousChefs.delete(old.meal_id);
              else sousChefs.set(old.meal_id, updated);
            } else {
              const row = payload.new as MealSousChef;
              const set = new Set(sousChefs.get(row.meal_id) ?? []);
              set.add(row.user_id);
              sousChefs.set(row.meal_id, set);
            }
            return { ...s, sousChefs };
          });
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'meal_ingredients' },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const ingredients = new Map(s.ingredients);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id?: string; meal_id?: string };
              if (!old.id) return s;
              // We may not have the meal_id in `old` if the row isn't in
              // REPLICA IDENTITY FULL — search all buckets just in case.
              for (const [mealId, arr] of ingredients.entries()) {
                const next = arr.filter((i) => i.id !== old.id);
                if (next.length !== arr.length) {
                  if (next.length === 0) ingredients.delete(mealId);
                  else ingredients.set(mealId, next);
                  break;
                }
              }
            } else {
              const row = payload.new as MealIngredient;
              const arr = ingredients.get(row.meal_id) ?? [];
              const exists = arr.some((i) => i.id === row.id);
              const next = exists
                ? arr.map((i) => (i.id === row.id ? row : i))
                : [...arr, row];
              next.sort(sortIngredients);
              ingredients.set(row.meal_id, next);
            }
            return { ...s, ingredients };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      unsubReconnect();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Stable lookup helpers.
  const mealsByDate = useMemo(() => {
    const m = new Map<string, Meal[]>();
    for (const meal of state.meals) {
      let arr = m.get(meal.meal_date);
      if (!arr) { arr = []; m.set(meal.meal_date, arr); }
      arr.push(meal);
    }
    return m;
  }, [state.meals]);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const createMeal = useCallback(async (input: {
    meal_date: string;
    meal_type: MealType;
    title: string;
    notes: string | null;
    head_chef_id: string;
  }): Promise<Meal | null> => {
    if (!currentUserId) return null;
    const now = new Date().toISOString();
    const meal: Meal = {
      id: crypto.randomUUID(),
      meal_date: input.meal_date,
      meal_type: input.meal_type,
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      head_chef_id: input.head_chef_id,
      created_by: currentUserId,
      created_at: now,
      updated_at: now,
    };
    setState((s) => ({ ...s, meals: sortMeals([...s.meals, meal]) }));
    writeQueue.enqueue({ table: 'meals', op: 'insert', payload: meal });
    void writeQueue.flush();
    return meal;
  }, [currentUserId]);

  const updateMeal = useCallback(async (id: string, patch: {
    meal_date?: string;
    meal_type?: MealType;
    title?: string;
    notes?: string | null;
    head_chef_id?: string;
  }) => {
    setState((s) => ({
      ...s,
      meals: sortMeals(s.meals.map((m) =>
        m.id === id ? { ...m, ...patch, updated_at: new Date().toISOString() } : m,
      )),
    }));
    writeQueue.enqueue({ table: 'meals', op: 'update', key: { id }, payload: patch });
    void writeQueue.flush();
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setState((s) => {
      const sousChefs = new Map(s.sousChefs);
      sousChefs.delete(id);
      const ingredients = new Map(s.ingredients);
      ingredients.delete(id);
      return {
        ...s,
        meals: s.meals.filter((m) => m.id !== id),
        sousChefs,
        ingredients,
      };
    });
    writeQueue.enqueue({ table: 'meals', op: 'delete', key: { id } });
    void writeQueue.flush();
  }, []);

  const joinAsSousChef = useCallback((mealId: string) => {
    if (!currentUserId) return;
    setState((s) => {
      const next = new Map(s.sousChefs);
      const set = new Set(next.get(mealId) ?? []);
      set.add(currentUserId);
      next.set(mealId, set);
      return { ...s, sousChefs: next };
    });
    writeQueue.enqueue({
      table: 'meal_sous_chefs',
      op: 'insert',
      payload: { meal_id: mealId, user_id: currentUserId, joined_at: new Date().toISOString() },
    });
    void writeQueue.flush();
  }, [currentUserId]);

  const addIngredient = useCallback((mealId: string, input: {
    name: string;
    quantity: string | null;
    notes?: string | null;
  }) => {
    if (!currentUserId) return;
    const ingredients = stateRef.current.ingredients.get(mealId) ?? [];
    const maxOrder = ingredients.reduce((m, i) => Math.max(m, i.sort_order), -1);
    const ing: MealIngredient = {
      id: crypto.randomUUID(),
      meal_id: mealId,
      name: input.name.trim(),
      quantity: input.quantity?.trim() || null,
      notes: input.notes?.trim() || null,
      sort_order: maxOrder + 1,
      created_by: currentUserId,
      created_at: new Date().toISOString(),
    };
    setState((s) => {
      const next = new Map(s.ingredients);
      const arr = [...(next.get(mealId) ?? []), ing];
      arr.sort(sortIngredients);
      next.set(mealId, arr);
      return { ...s, ingredients: next };
    });
    writeQueue.enqueue({ table: 'meal_ingredients', op: 'insert', payload: ing });
    void writeQueue.flush();
  }, [currentUserId]);

  const deleteIngredient = useCallback((mealId: string, ingredientId: string) => {
    setState((s) => {
      const next = new Map(s.ingredients);
      const arr = (next.get(mealId) ?? []).filter((i) => i.id !== ingredientId);
      if (arr.length === 0) next.delete(mealId);
      else next.set(mealId, arr);
      return { ...s, ingredients: next };
    });
    writeQueue.enqueue({ table: 'meal_ingredients', op: 'delete', key: { id: ingredientId } });
    void writeQueue.flush();
  }, []);

  const leaveSousChef = useCallback((mealId: string, userId?: string) => {
    const target = userId ?? currentUserId;
    if (!target) return;
    setState((s) => {
      const next = new Map(s.sousChefs);
      const set = next.get(mealId);
      if (!set) return s;
      const updated = new Set(set);
      updated.delete(target);
      if (updated.size === 0) next.delete(mealId);
      else next.set(mealId, updated);
      return { ...s, sousChefs: next };
    });
    writeQueue.enqueue({
      table: 'meal_sous_chefs',
      op: 'delete',
      key: { meal_id: mealId, user_id: target },
    });
    void writeQueue.flush();
  }, [currentUserId]);

  return {
    meals: state.meals,
    sousChefs: state.sousChefs,
    ingredients: state.ingredients,
    mealsByDate,
    loading: state.loading,
    error: state.error,
    createMeal,
    updateMeal,
    deleteMeal,
    joinAsSousChef,
    leaveSousChef,
    addIngredient,
    deleteIngredient,
  };
}

function sortIngredients(a: MealIngredient, b: MealIngredient): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at.localeCompare(b.created_at);
}

// Sort by date ASC, then meal_type (breakfast < lunch < dinner < other).
const MEAL_TYPE_ORDER: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  other: 3,
};

function sortMeals(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => {
    if (a.meal_date !== b.meal_date) return a.meal_date.localeCompare(b.meal_date);
    return MEAL_TYPE_ORDER[a.meal_type] - MEAL_TYPE_ORDER[b.meal_type];
  });
}
