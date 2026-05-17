import { describe, expect, it } from 'vitest';
import { typingLabel } from './typingLabel';
import type { Profile } from '@/types/db';

function makeProfile(id: string, name: string): Profile {
  return {
    id,
    email: `${name.toLowerCase()}@example.com`,
    display_name: name,
    avatar_url: null,
    family_id: 'fam',
    status: 'approved',
    is_admin: false,
    created_at: '2026-05-17',
    approved_at: '2026-05-17',
    approved_by: null,
  };
}

describe('typingLabel', () => {
  const profiles = new Map<string, Profile>([
    ['u1', makeProfile('u1', 'Wendy Weaver')],
    ['u2', makeProfile('u2', 'Mike Titsworth')],
    ['u3', makeProfile('u3', 'Abue Ramirez')],
  ]);

  it('returns an empty string for no typers', () => {
    expect(typingLabel([], profiles)).toBe('');
  });

  it('formats a single typer with first name', () => {
    expect(typingLabel(['u1'], profiles)).toBe('Wendy is typing…');
  });

  it('formats two typers with "and"', () => {
    expect(typingLabel(['u1', 'u2'], profiles)).toBe('Wendy and Mike are typing…');
  });

  it('collapses three or more typers to "several people"', () => {
    expect(typingLabel(['u1', 'u2', 'u3'], profiles)).toBe('Several people are typing…');
  });

  it('falls back to "Someone" for unknown user ids', () => {
    expect(typingLabel(['ghost'], profiles)).toBe('Someone is typing…');
  });

  it('accepts a Set as input', () => {
    expect(typingLabel(new Set(['u1']), profiles)).toBe('Wendy is typing…');
  });
});
