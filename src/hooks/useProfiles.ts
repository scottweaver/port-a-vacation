import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import type { Profile } from '@/types/db';

const CACHE_KEY = 'profiles';

function hydrate(): Map<string, Profile> {
  const cached = cache.get<Profile[]>(CACHE_KEY);
  if (!cached) return new Map();
  return new Map(cached.map((p) => [p.id, p] as const));
}

export function useProfiles(enabled: boolean) {
  const [profiles, setProfiles] = useState<Map<string, Profile>>(hydrate);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('status', 'approved');
      if (cancelled || error) return;
      const rows = (data ?? []) as Profile[];
      const map = new Map<string, Profile>();
      for (const p of rows) map.set(p.id, p);
      setProfiles(map);
    })();

    const channel = supabase
      .channel('profiles-all')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (cancelled) return;
          setProfiles((prev) => {
            const next = new Map(prev);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Partial<Profile>;
              if (old.id) next.delete(old.id);
            } else {
              const row = payload.new as Profile;
              if (row.status === 'approved') next.set(row.id, row);
              else next.delete(row.id);
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  // Persist on every change (initial fetch and realtime updates). Cache stores
  // a plain array; we rebuild the Map on hydrate.
  useEffect(() => {
    if (profiles.size === 0) return;
    cache.set(CACHE_KEY, [...profiles.values()]);
  }, [profiles]);

  return profiles;
}


