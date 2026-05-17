import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import type { Family } from '@/types/db';

const CACHE_KEY = 'families';

export function useFamilies() {
  const [families, setFamilies] = useState<Family[]>(() => cache.get<Family[]>(CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(() => cache.get<Family[]>(CACHE_KEY) === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('families').select('*').order('sort_order');
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      const rows = (data ?? []) as Family[];
      setFamilies(rows);
      cache.set(CACHE_KEY, rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMyFamily = useCallback(async (userId: string, familyId: string) => {
    const { error } = await supabase
      .from('profiles').update({ family_id: familyId }).eq('id', userId);
    if (error) throw error;
  }, []);

  return { families, loading, error, setMyFamily };
}


