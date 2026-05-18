import { useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCollapsedState } from '@/lib/useCollapsed';
import { cx } from '@/lib/format';

interface Props {
  storageKey: string;
  userId: string;
  defaultCollapsed?: boolean;
  forceOpen?: boolean;
  className?: string;
  id?: string;
  header: ReactNode;
  children: ReactNode;
  /** Optional Tailwind bg-class for a thin colored stripe at the top of
   *  the card (e.g. `bg-ocean-400`). Clipped to the rounded corners. */
  tint?: string;
  /** Optional Tailwind from-class for a faint diagonal gradient wash on
   *  the card body (e.g. `from-ocean-400/15`). Echoes the stripe color
   *  down into the card. */
  tintFade?: string;
  /** Optional Tailwind colored-shadow class for the stripe (e.g.
   *  `shadow-ocean-400/40`). Combined with `shadow-md` so the stripe casts
   *  a soft colored glow downward into the card body. */
  tintShadow?: string;
}

const DEFAULT_CLASSNAME = 'relative overflow-hidden bg-sand-50 rounded-2xl shadow p-5 scroll-mt-20';

export default function CollapsibleCard({
  storageKey,
  userId,
  defaultCollapsed = false,
  forceOpen = false,
  className,
  id,
  header,
  children,
  tint,
  tintFade,
  tintShadow,
}: Props) {
  const [collapsed, setCollapsed] = useCollapsedState(storageKey, userId, defaultCollapsed);
  const open = forceOpen || !collapsed;

  // Expand programmatically when a `collapsible:expand` event fires for this
  // storageKey. Used by the "jump to next unread message" affordance so
  // collapsed categories open before we scroll to the target item.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey === storageKey) setCollapsed(false);
    };
    window.addEventListener('collapsible:expand', handler);
    return () => window.removeEventListener('collapsible:expand', handler);
  }, [storageKey, setCollapsed]);

  return (
    <section id={id} className={className ?? DEFAULT_CLASSNAME}>
      {tintFade && (
        <div
          className={cx(
            'absolute inset-0 bg-gradient-to-br to-transparent pointer-events-none transition-opacity duration-300',
            tintFade,
            open ? 'opacity-100' : 'opacity-50',
          )}
          aria-hidden
        />
      )}
      {tint && (
        <div
          className={cx(
            'absolute top-0 left-0 right-0 h-1.5 pointer-events-none',
            tint,
            tintShadow && 'shadow-md',
            tintShadow,
          )}
          aria-hidden
        />
      )}
      <div className="relative">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={open}
        disabled={forceOpen}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="flex-1 min-w-0">{header}</div>
        <ChevronDown
          size={20}
          className={cx(
            'text-slate-400 flex-shrink-0 mt-1 transition-transform',
            open && 'rotate-180',
            forceOpen && 'opacity-30',
          )}
        />
      </button>
      {open && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}
