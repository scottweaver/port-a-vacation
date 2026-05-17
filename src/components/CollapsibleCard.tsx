import { useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCollapsedState } from '@/lib/useCollapsed';
import { cx } from '@/lib/format';

interface Props {
  storageKey: string;
  userId: string;
  defaultCollapsed?: boolean;
  className?: string;
  id?: string;
  header: ReactNode;
  children: ReactNode;
}

const DEFAULT_CLASSNAME = 'bg-white rounded-2xl shadow p-5 scroll-mt-20';

export default function CollapsibleCard({
  storageKey,
  userId,
  defaultCollapsed = false,
  className,
  id,
  header,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useCollapsedState(storageKey, userId, defaultCollapsed);

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
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="w-full flex items-start justify-between gap-3 text-left"
      >
        <div className="flex-1 min-w-0">{header}</div>
        <ChevronDown
          size={20}
          className={cx(
            'text-slate-400 flex-shrink-0 mt-1 transition-transform',
            !collapsed && 'rotate-180',
          )}
        />
      </button>
      {!collapsed && <div className="mt-4">{children}</div>}
    </section>
  );
}
