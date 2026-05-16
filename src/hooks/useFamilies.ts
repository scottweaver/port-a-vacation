import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Family } from '@/types/db';

export function useFamilies() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
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
      setFamilies((data ?? []) as Family[]);
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


