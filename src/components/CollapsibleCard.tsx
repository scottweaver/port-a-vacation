import type { ReactNode } from 'react';
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
