import { useMemo, useState } from 'react';
import { Check, Circle, ChevronRight, ChevronDown, ArrowLeft, X, ShoppingBag } from 'lucide-react';
import type { ChecklistItem, Contribution, Family } from '@/types/db';
import { CATEGORIES, categoryByKey } from '@/lib/trip-data';
import { cx } from '@/lib/format';

interface Props {
  items: ChecklistItem[];
  contributions: Map<string, Contribution>;
  shopping: Map<string, boolean>;          // itemId → purchased
  myFamily: Family;
  onTogglePurchased: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onExit: () => void;
}

interface ShopRow {
  item: ChecklistItem;
  /** Family quantity from contributions — shown as ×N hint if > 0, otherwise hidden. */
  myQuantity: number;
  purchased: boolean;
}

const contribKey = (itemId: string, familyId: string) => `${itemId}::${familyId}`;

function compareRows(a: ShopRow, b: ShopRow) {
  const ca = CATEGORIES.findIndex((c) => c.key === a.item.category);
  const cb = CATEGORIES.findIndex((c) => c.key === b.item.category);
  if (ca !== cb) return ca - cb;
  return a.item.sort_order - b.item.sort_order;
}

/**
 * Shopping mode — a separate full-screen view (mirrors PackView). The list is
 * the family's explicit opt-ins via the bag icon on the dashboard. Each row
 * has a Got/Need toggle plus an explicit remove (X) since unlike Pack, items
 * here don't get auto-derived from any other field.
 */
export default function ShoppingView({
  items, contributions, shopping, myFamily,
  onTogglePurchased, onRemove, onExit,
}: Props) {
  const [gotOpen, setGotOpen] = useState(false);

  const rows = useMemo<ShopRow[]>(() => {
    const result: ShopRow[] = [];
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const [itemId, purchased] of shopping.entries()) {
      const item = itemById.get(itemId);
      if (!item) continue; // item was deleted while on someone's list — skip
      const myContrib = contributions.get(contribKey(itemId, myFamily.id));
      result.push({
        item,
        myQuantity: myContrib?.quantity ?? 0,
        purchased,
      });
    }
    result.sort(compareRows);
    return result;
  }, [items, contributions, shopping, myFamily.id]);

  const need = rows.filter((r) => !r.purchased);
  const got = rows.filter((r) => r.purchased);

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
          <div className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
            <ShoppingBag size={14} className="text-amber-600" />
            Shopping · <span className="text-slate-500 font-normal">{myFamily.display_name}</span>
          </div>
          <div className="w-12" aria-hidden />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 space-y-3">
        <Panel title="Need to buy" count={need.length} accent="amber">
          {need.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              {rows.length === 0
                ? 'Nothing on the list yet. Tap the bag icon next to a checklist item to add it here.'
                : 'All bought! 🎉'}
            </div>
          ) : (
            <RowList rows={need} onToggle={onTogglePurchased} onRemove={onRemove} state="need" />
          )}
        </Panel>

        <CollapsiblePanel
          title="Got it"
          count={got.length}
          accent="emerald"
          open={gotOpen}
          onToggle={() => setGotOpen((o) => !o)}
        >
          {got.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              Nothing checked off yet.
            </div>
          ) : (
            <RowList rows={got} onToggle={onTogglePurchased} onRemove={onRemove} state="got" />
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
          {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        </div>
        <span className={cx('text-xs font-medium tabular-nums', accentClass)}>{count}</span>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </section>
  );
}

function RowList({
  rows, onToggle, onRemove, state,
}: {
  rows: ShopRow[];
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  state: 'need' | 'got';
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <ShopRowView
          key={row.item.id}
          row={row}
          onToggle={() => onToggle(row.item.id)}
          onRemove={() => onRemove(row.item.id)}
          state={state}
        />
      ))}
    </ul>
  );
}

function ShopRowView({
  row, onToggle, onRemove, state,
}: {
  row: ShopRow;
  onToggle: () => void;
  onRemove: () => void;
  state: 'need' | 'got';
}) {
  const cat = categoryByKey[row.item.category];
  const emoji = cat?.emoji ?? '🛍️';
  return (
    <li className="flex items-center gap-2 group/row">
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition text-left"
      >
        {state === 'got' ? (
          <Check size={18} className="text-emerald-600 flex-shrink-0" />
        ) : (
          <Circle size={18} className="text-slate-400 flex-shrink-0" />
        )}
        <span className="text-base leading-none flex-shrink-0" aria-hidden>{emoji}</span>
        <span
          className={cx(
            'flex-1 text-sm truncate',
            state === 'got' ? 'text-slate-400 line-through' : 'text-slate-700',
          )}
        >
          {row.item.label}
        </span>
        {row.myQuantity > 0 && (
          <span
            className={cx(
              'text-xs font-medium tabular-nums flex-shrink-0',
              state === 'got' ? 'text-slate-300' : 'text-slate-500',
            )}
          >
            ×{row.myQuantity}
          </span>
        )}
      </button>
      <button
        onClick={onRemove}
        className="p-2 text-slate-400 hover:text-coral-600 transition flex-shrink-0"
        title="Remove from shopping list"
        aria-label={`Remove ${row.item.label} from shopping list`}
      >
        <X size={16} />
      </button>
    </li>
  );
}
