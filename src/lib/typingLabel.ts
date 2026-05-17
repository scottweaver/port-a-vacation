import { firstName } from './format';
import type { Profile } from '@/types/db';

/**
 * Format a "typing…" line from a set of user ids. Resolves names via the
 * profiles map. Pure — no React, no state. Tested in typingLabel.test.ts.
 */
export function typingLabel(userIds: Iterable<string>, profiles: Map<string, Profile>): string {
  const ids = Array.from(userIds);
  if (ids.length === 0) return '';

  const names = ids.map((id) => {
    const p = profiles.get(id);
    return p ? firstName(p.display_name, p.email) : 'Someone';
  });

  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}
