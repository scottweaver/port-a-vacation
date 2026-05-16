import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/db';

export function useAdmin(enabled: boolean, currentUserId: string | null) {
  const [pending, setPending] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      setPending((data ?? []) as Profile[]);
    }
    load();

    const channel = supabase
      .channel('admin-pending-profiles')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Profile;
            if (row.status === 'pending') {
              setPending((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Profile;
            setPending((prev) => {
              const filtered = prev.filter((p) => p.id !== row.id);
              return row.status === 'pending' ? [...filtered, row] : filtered;
            });
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<Profile>;
            if (old.id) setPending((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  const approve = useCallback(
    async (profileId: string) => {
      if (!currentUserId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: currentUserId,
        })
        .eq('id', profileId);
      if (error) throw error;
    },
    [currentUserId],
  );

  const deny = useCallback(async (profileId: string) => {
    const { error } = await supabase
      .from('profiles').update({ status: 'denied' }).eq('id', profileId);
    if (error) throw error;
  }, []);

  const reconsider = useCallback(async (profileId: string) => {
    const { error } = await supabase
      .from('profiles').update({ status: 'pending' }).eq('id', profileId);
    if (error) throw error;
  }, []);

  return { pending, error, approve, deny, reconsider };
}


