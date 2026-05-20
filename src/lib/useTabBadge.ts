import { useEffect } from 'react';

/**
 * Prefix `document.title` with `(N)` when count > 0 so a backgrounded tab
 * shows the unread count in the browser tab strip. The base title is
 * whatever was in <title> when the effect last fired, with any existing
 * `(N)` prefix stripped — so successive count changes don't accumulate.
 *
 * Pure browser-side mutation, no React state. Restores the base title on
 * unmount and whenever count drops back to 0.
 *
 * Why a hook instead of inline:
 *   - One concern lives in one file (easy to extend later, e.g. to also
 *     drive a favicon dot).
 *   - The Dashboard already has plenty of effects; this keeps the title
 *     side-effect labeled and out of the way.
 */
export function useTabBadge(count: number, options: { max?: number } = {}) {
  const max = options.max ?? 99;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const base = document.title.replace(/^\(\d+\+?\)\s+/, '');
    if (count > 0) {
      const shown = count > max ? `${max}+` : String(count);
      document.title = `(${shown}) ${base}`;
    } else {
      document.title = base;
    }
    return () => {
      // Restore on unmount or before the next effect fires.
      document.title = base;
    };
  }, [count, max]);
}
