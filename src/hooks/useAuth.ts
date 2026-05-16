import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/db';

export type AuthStage =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'pending'; session: Session; profile: Profile }
  | { kind: 'denied'; session: Session; profile: Profile }
  | { kind: 'needs-family'; session: Session; profile: Profile }
  | { kind: 'approved'; session: Session; profile: Profile };

export function useAuth() {
  const [stage, setStage] = useState<AuthStage>({ kind: 'loading' });
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (!data.session) setStage({ kind: 'signed-out' });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setStage({ kind: 'signed-out' });
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setStage({ kind: 'loading' });
    const userId = session.user.id;

    function applyProfile(profile: Profile) {
      if (!session) return;
      if (profile.status === 'pending') setStage({ kind: 'pending', session, profile });
      else if (profile.status === 'denied') setStage({ kind: 'denied', session, profile });
      else if (!profile.family_id) setStage({ kind: 'needs-family', session, profile });
      else setStage({ kind: 'approved', session, profile });
    }

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('Failed to load profile:', error);
        setStage({ kind: 'signed-out' });
        return;
      }
      if (!data) {
        setTimeout(loadProfile, 500);
        return;
      }
      applyProfile(data as Profile);
    }

    loadProfile();

    const channel = supabase
      .channel(`profile:${userId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          if (cancelled) return;
          applyProfile(payload.new as Profile);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStage({ kind: 'signed-out' });
  }, []);

  return { stage, signInWithGoogle, signOut };
}


