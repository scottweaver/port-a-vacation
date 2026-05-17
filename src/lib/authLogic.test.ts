import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import {
  isOfflineSignoutBlip,
  preserveStageOnSessionChange,
  shouldBounceOnProfileError,
  stageForProfile,
  type AuthStage,
} from './authLogic';
import type { Profile } from '@/types/db';

function makeSession(userId: string, overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'tok',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-05-17T00:00:00Z',
    } as Session['user'],
    ...overrides,
  } as Session;
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    email: 'a@b.com',
    display_name: 'A',
    avatar_url: null,
    family_id: 'fam1',
    status: 'approved',
    is_admin: false,
    created_at: '2026-05-17T00:00:00Z',
    approved_at: '2026-05-17T00:00:00Z',
    approved_by: null,
    ...overrides,
  };
}

describe('isOfflineSignoutBlip', () => {
  // This rule is the heart of the tab-focus-while-offline bug fix: Supabase's
  // auto-refresh fails offline and emits a null session, but we should NOT
  // bounce the user to sign-in just because the network is down.

  it('returns true when newSession is null AND offline', () => {
    expect(isOfflineSignoutBlip(null, false)).toBe(true);
  });

  it('returns false when newSession is null but online (real sign-out)', () => {
    expect(isOfflineSignoutBlip(null, true)).toBe(false);
  });

  it('returns false when newSession is present, regardless of online state', () => {
    const s = makeSession('u1');
    expect(isOfflineSignoutBlip(s, true)).toBe(false);
    expect(isOfflineSignoutBlip(s, false)).toBe(false);
  });
});

describe('stageForProfile', () => {
  const session = makeSession('u1');

  it("maps status 'pending' to the pending stage", () => {
    const profile = makeProfile({ status: 'pending', family_id: null });
    const stage = stageForProfile(profile, session);
    expect(stage.kind).toBe('pending');
    expect(stage).toMatchObject({ kind: 'pending', profile, session });
  });

  it("maps status 'denied' to the denied stage", () => {
    const profile = makeProfile({ status: 'denied' });
    expect(stageForProfile(profile, session).kind).toBe('denied');
  });

  it("maps approved + no family_id to needs-family", () => {
    const profile = makeProfile({ status: 'approved', family_id: null });
    expect(stageForProfile(profile, session).kind).toBe('needs-family');
  });

  it('maps approved + family_id to approved', () => {
    const profile = makeProfile({ status: 'approved', family_id: 'fam1' });
    expect(stageForProfile(profile, session).kind).toBe('approved');
  });
});

describe('preserveStageOnSessionChange', () => {
  // The second half of the tab-focus bug fix: when Supabase emits a refreshed
  // session for the SAME user, we keep the current stage instead of flipping
  // to the loading spinner. We only re-hydrate when the user actually changes
  // or there's no stage to preserve.

  const session1 = makeSession('u1');
  const session2 = makeSession('u1', { access_token: 'tok2' });
  const otherSession = makeSession('u2');
  const profileU1 = makeProfile({ id: 'u1' });

  it('preserves an approved stage when the session refreshes for the same user', () => {
    const current: AuthStage = { kind: 'approved', session: session1, profile: profileU1 };
    const result = preserveStageOnSessionChange(current, session2, 'u1');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('approved');
    if (result && 'session' in result) {
      expect(result.session).toBe(session2);
    }
  });

  it('preserves pending / denied / needs-family stages too (any stage with a profile)', () => {
    for (const kind of ['pending', 'denied', 'needs-family'] as const) {
      const current = { kind, session: session1, profile: profileU1 } as AuthStage;
      const result = preserveStageOnSessionChange(current, session2, 'u1');
      expect(result?.kind).toBe(kind);
    }
  });

  it('returns null when the userId differs (different user signing in)', () => {
    const current: AuthStage = { kind: 'approved', session: session1, profile: profileU1 };
    const result = preserveStageOnSessionChange(current, otherSession, 'u2');
    expect(result).toBeNull();
  });

  it('returns null when the current stage has no profile (loading / signed-out)', () => {
    expect(preserveStageOnSessionChange({ kind: 'loading' }, session1, 'u1')).toBeNull();
    expect(preserveStageOnSessionChange({ kind: 'signed-out' }, session1, 'u1')).toBeNull();
  });
});

describe('shouldBounceOnProfileError', () => {
  // The third bug: while offline, a profile fetch fails by definition. We
  // must NOT bounce to sign-in then; the user's cached profile is still
  // valid until we can verify otherwise online.

  it('bounces when online', () => {
    expect(shouldBounceOnProfileError(true)).toBe(true);
  });

  it('does not bounce when offline', () => {
    expect(shouldBounceOnProfileError(false)).toBe(false);
  });
});
