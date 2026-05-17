import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import {
  isOfflineSignoutBlip,
  preserveStageOnSessionChange,
  shouldBounceOnProfileError,
  stageForProfile,
  type AuthStage,
} from '@/lib/authLogic';
import type { Profile } from '@/types/db';

export type { AuthStage };

const profileCacheKey = (userId: string) => `profile:${userId}`;

export function useAuth() {
  const [stage, setStage] = useState<AuthStage>({ kind: 'loading' });
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const session = data.session;
      if (!session) { setStage({ kind: 'signed-out' }); return; }

      // Option B: if the cached session is expired and we can't refresh it
      // (offline), bounce straight to sign-in rather than render the
      // dashboard with a token that will fail every write. Sign-in
      // requires network, so the user knows what they have to do.
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now() && !navigator.onLine) {
        setStage({ kind: 'signed-out' });
        return;
      }

      setSession(session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isOfflineSignoutBlip(newSession, navigator.onLine)) return;
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
    const userId = session.user.id;

    function applyProfile(profile: Profile) {
      cache.set(profileCacheKey(userId), profile);
      setStage(stageForProfile(profile, session!));
    }

    // Preserve the existing stage if the session change is just a token
    // refresh for the same user — otherwise hydrate from the cached profile
    // if available, else show the loading spinner.
    setStage((current) => {
      const preserved = preserveStageOnSessionChange(current, session, userId);
      if (preserved) return preserved;
      const cached = cache.get<Profile>(profileCacheKey(userId));
      if (cached) return stageForProfile(cached, session);
      return { kind: 'loading' };
    });

    // Retry up to a few times in case the handle_new_user trigger hasn't
    // landed the profile row yet. Capped so a stale JWT (referencing a user
    // whose profile no longer exists — e.g. after a local db reset) doesn't
    // hammer the network with infinite 500ms retries.
    const MAX_PROFILE_RETRIES = 3;
    let profileAttempts = 0;

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).maybeSingle();

      if (cancelled) return;
      if (error) {
        if (!shouldBounceOnProfileError(navigator.onLine)) return;
        console.error('Failed to load profile:', error);
        setStage({ kind: 'signed-out' });
        return;
      }
      if (!data) {
        profileAttempts++;
        if (profileAttempts >= MAX_PROFILE_RETRIES) {
          // Profile genuinely doesn't exist for this JWT. Either the trigger
          // is broken, or the JWT references a user that's been deleted.
          // Sign them out so they can re-authenticate cleanly.
          console.warn('Profile not found after retries — signing out');
          await supabase.auth.signOut();
          setStage({ kind: 'signed-out' });
          return;
        }
        if (navigator.onLine) setTimeout(loadProfile, 500);
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

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStage({ kind: 'signed-out' });
    if (session) cache.remove(profileCacheKey(session.user.id));
  }, [session]);

  return { stage, signInWithGoogle, signInWithEmail, signOut };
}
