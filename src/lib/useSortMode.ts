import { useCallback, useState } from 'react';

export type SortMode = 'default' | 'alphabetical' | 'missing-first';

const VALID: SortMode[] = ['default', 'alphabetical', 'missing-first'];

const keyFor = (userId: string, categoryKey: string) =>
  `port-a:sort:${userId}:${categoryKey}`;

/**
 * Per-user per-category sort mode for checklist sections, persisted to
 * localStorage. Mirrors the keying convention used by useCollapsedState
 * (`port-a:collapsed:<userId>:<sectionKey>`) so each user's preferences
 * survive across page reloads on the same device but don't leak between
 * users or between devices.
 */
export function useSortMode(userId: string, categoryKey: string) {
  const [mode, setMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'default';
    try {
      const stored = window.localStorage.getItem(keyFor(userId, categoryKey));
      if (stored && (VALID as string[]).includes(stored)) return stored as SortMode;
    } catch {
      // localStorage unavailable (private mode, quota) — silently default.
    }
    return 'default';
  });

  const update = useCallback((next: SortMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(keyFor(userId, categoryKey), next);
    } catch {
      // Silently drop — the in-memory state is still correct for this session.
    }
  }, [userId, categoryKey]);

  return [mode, update] as const;
}
