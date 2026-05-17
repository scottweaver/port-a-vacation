// Pure helpers for useAuth's offline-sensitive state transitions. Kept here
// rather than inlined in the hook so we can unit-test the rules that decide
// whether a network blip should bounce the user to sign-in.
//
// Each helper takes whatever state it needs as plain arguments and returns
// the next decision — no React, no Supabase, no global side effects.

import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/db';

export type AuthStage =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'pending'; session: Session; profile: Profile }
  | { kind: 'denied'; session: Session; profile: Profile }
  | { kind: 'needs-family'; session: Session; profile: Profile }
  | { kind: 'approved'; session: Session; profile: Profile };

/**
 * Should we ignore an `onAuthStateChange` event because we can't trust it
 * while offline? Supabase auto-refresh fails to reach the server and emits
 * a null session — that's not a real sign-out. We keep the user where they
 * are and re-evaluate when they reconnect.
 */
export function isOfflineSignoutBlip(newSession: Session | null, isOnline: boolean): boolean {
  return newSession === null && !isOnline;
}

/**
 * Map a profile + session to the right stage. Pure projection of the
 * profile's status / family fields onto the AuthStage union.
 */
export function stageForProfile(profile: Profile, session: Session): AuthStage {
  if (profile.status === 'pending') return { kind: 'pending', session, profile };
  if (profile.status === 'denied') return { kind: 'denied', session, profile };
  if (!profile.family_id) return { kind: 'needs-family', session, profile };
  return { kind: 'approved', session, profile };
}

/**
 * When the `session` effect re-runs (typically because Supabase emitted a
 * fresh session object for the same user — a token refresh), we want to
 * keep the existing stage rather than flash through `loading`. Returns
 * the updated stage (same kind, refreshed session) when the current stage
 * already holds the same user's profile. Returns null otherwise to signal
 * "no preservation; the caller should rehydrate."
 */
export function preserveStageOnSessionChange(
  current: AuthStage,
  session: Session,
  userId: string,
): AuthStage | null {
  if ('profile' in current && current.profile.id === userId) {
    return { ...current, session };
  }
  return null;
}

/**
 * Should a failed profile load bounce the user to sign-in? Online failures
 * are legitimate auth problems and bounce. Offline failures are network —
 * keep whatever stage we already have (likely a cached profile) and let the
 * reconnect path retry.
 */
export function shouldBounceOnProfileError(isOnline: boolean): boolean {
  return isOnline;
}
