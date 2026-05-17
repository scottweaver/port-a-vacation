import { useEffect, useState } from 'react';

const NAMESPACE = 'port-a:collapsed';

export function useCollapsedState(key: string, userId: string, defaultCollapsed = false) {
  const storageKey = `${NAMESPACE}:${userId}:${key}`;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === null) return defaultCollapsed;
      return stored === '1';
    } catch {
      return defaultCollapsed;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {
      // localStorage may be unavailable (private mode, quota); ignore.
    }
  }, [storageKey, collapsed]);

  return [collapsed, setCollapsed] as const;
}
