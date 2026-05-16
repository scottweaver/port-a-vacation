import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/db';

export function useProfiles(enabled: boolean) {
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('status', 'approved');
      if (cancelled || error) return;
      const map = new Map<string, Profile>();
      for (const p of (data ?? []) as Profile[]) map.set(p.id, p);
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

  return profiles;
}


