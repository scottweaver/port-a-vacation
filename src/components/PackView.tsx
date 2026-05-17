import { useMemo, useState } from 'react';
import { Check, Circle, ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react';
import type { ChecklistItem, Contribution, Family } from '@/types/db';
import { CATEGORIES, categoryByKey } from '@/lib/trip-data';
import { cx } from '@/lib/format';

interface Props {
  items: ChecklistItem[];
  contributions: Map<string, Contribution>;
  packed: Set<string>;
  hidden: Set<string>;
  myFamily: Family;
  currentUserId: string;
  onTogglePacked: (itemId: string) => void;
  onExit: () => void;
}

interface PackRow {
  item: ChecklistItem;
  /** Quantity my family committed, only meaningful for quantity items. */
  myQuantity: number;
  /** Whether this row is currently in the packed bucket. */
  isPacked: boolean;
}

const contribKey = (itemId: string, familyId: string) => `${itemId}::${familyId}`;

/** Sort items by category order then within-category sort_order. */
function compareRows(a: PackRow, b: PackRow) {
  const ca = CATEGORIES.findIndex((c) => c.key === a.item.category);
  const cb = CATEGORIES.findIndex((c) => c.key === b.item.category);
  if (ca !== cb) return ca - cb;
  return a.item.sort_order - b.item.sort_order;
}

export default function PackView({
  items, contributions, packed, hidden, myFamily, currentUserId,
  onTogglePacked, onExit,
}: Props) {
  void currentUserId;
  const [packedOpen, setPackedOpen] = useState(false);

  const rows = useMemo<PackRow[]>(() => {
    const result: PackRow[] = [];
    for (const item of items) {
      if (hidden.has(item.id)) continue;
      const myContrib = contributions.get(contribKey(item.id, myFamily.id));
      if (item.tracking_type === 'quantity') {
        const qty = myContrib?.quantity ?? 0;
        if (qty <= 0) continue;
        result.push({ item, myQuantity: qty, isPacked: packed.has(item.id) });
      } else if (item.tracking_type === 'claim') {
        if (!myContrib?.done) continue;
        result.push({ item, myQuantity: 0, isPacked: packed.has(item.id) });
      } else if (item.tracking_type === 'task') {
        // Tasks appear on Pack only if ticked on the planning dashboard
        // (= committed). Their packed state then lives in packing_status,
        // independent of the Trip-tab tick. Unticking on Trip removes them
        // from Pack entirely; unpacking on Pack moves them back to the
        // Unpacked panel here without affecting the Trip tab.
        if (!myContrib?.done) continue;
        result.push({ item, myQuantity: 0, isPacked: packed.has(item.id) });
      }
    }
    result.sort(compareRows);
    return result;
  }, [items, contributions, packed, hidden, myFamily.id]);

  const unpacked = rows.filter((r) => !r.isPacked);
  const packedRows = rows.filter((r) => r.isPacked);

  function handleToggle(row: PackRow) {
    // All row types use packing_status for their Pack-screen state. For tasks,
    // the prerequisite (Trip-tab tick) is enforced by the filter above.
    onTogglePacked(row.item.id);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center justify-between gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-sm text-ocean-700 hover:text-ocean-900 -ml-1 pl-1 pr-2 py-1 rounded transition"
          >
            <ArrowLeft size={16} />
            <span className="font-medium">Trip</span>
          </button>
          <div className="text-sm font-semibold text-slate-800 truncate">
            Pack · <span className="text-slate-500 font-normal">{myFamily.display_name}</span>
          </div>
          <div className="w-12" aria-hidden />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 space-y-3">
        <Panel
          title="Unpacked / Incomplete"
          count={unpacked.length}
          accent="amber"
        >
          {unpacked.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              {rows.length === 0
                ? 'Nothing committed yet. Head back to Trip to add items.'
                : 'All packed! 🎉'}
            </div>
          ) : (
            <RowList rows={unpacked} onToggle={handleToggle} state="unpacked" />
          )}
        </Panel>

        <CollapsiblePanel
          title="Packed / Complete"
          count={packedRows.length}
          accent="emerald"
          open={packedOpen}
          onToggle={() => setPackedOpen((o) => !o)}
        >
          {packedRows.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              Nothing packed yet.
            </div>
          ) : (
            <RowList rows={packedRows} onToggle={handleToggle} state="packed" />
          )}
        </CollapsiblePanel>
      </main>
    </div>
  );
}

function Panel({
  title, count, accent, children,
}: {
  title: string;
  count: number;
  accent: 'amber' | 'emerald';
  children: React.ReactNode;
}) {
  const accentClass = accent === 'amber' ? 'text-amber-700' : 'text-emerald-700';
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <header className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className={cx('text-xs font-medium tabular-nums', accentClass)}>{count}</span>
      </header>
      <div>{children}</div>
    </section>
  );
}

function CollapsiblePanel({
  title, count, accent, open, onToggle, children,
}: {
  title: string;
  count: number;
  accent: 'amber' | 'emerald';
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const accentClass = accent === 'amber' ? 'text-amber-700' : 'text-emerald-700';
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
        <span className={cx('text-xs font-medium tabular-nums', accentClass)}>{count}</span>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </section>
  );
}

function RowList({
  rows, onToggle, state,
}: {
  rows: PackRow[];
  onToggle: (row: PackRow) => void;
  state: 'unpacked' | 'packed';
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <PackRowView key={row.item.id} row={row} onToggle={() => onToggle(row)} state={state} />
      ))}
    </ul>
  );
}

function PackRowView({
  row, onToggle, state,
}: {
  row: PackRow;
  onToggle: () => void;
  state: 'unpacked' | 'packed';
}) {
  const cat = categoryByKey[row.item.category];
  const emoji = cat?.emoji ?? '📦';
  return (
    <li>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left"
      >
        {state === 'packed' ? (
          <Check size={18} className="text-emerald-600 flex-shrink-0" />
        ) : (
          <Circle size={18} className="text-slate-300 flex-shrink-0" />
        )}
        <span className="text-base leading-none flex-shrink-0" aria-hidden>{emoji}</span>
        <span
          className={cx(
            'flex-1 text-sm truncate',
            state === 'packed' ? 'text-slate-400 line-through' : 'text-slate-700',
          )}
        >
          {row.item.label}
        </span>
        {row.myQuantity > 0 && (
          <span
            className={cx(
              'text-xs font-medium tabular-nums flex-shrink-0',
              state === 'packed' ? 'text-slate-300' : 'text-slate-500',
            )}
          >
            ×{row.myQuantity}
          </span>
        )}
      </button>
    </li>
  );
}
