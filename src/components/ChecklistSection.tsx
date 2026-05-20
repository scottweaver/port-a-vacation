import { useMemo, useState } from 'react';
import { Plus, Loader2, ChevronRight, ChevronDown, Eye, MessageCircle, ArrowUpDown } from 'lucide-react';
import type { ChecklistItem, Contribution, Family, Profile, TrackingType } from '@/types/db';
import type { CategoryMeta } from '@/lib/trip-data';
import { cx } from '@/lib/format';
import { useSortMode, type SortMode } from '@/lib/useSortMode';
import ChecklistRow from './ChecklistRow';
import CollapsibleCard from './CollapsibleCard';

interface Props {
  category: CategoryMeta;
  items: ChecklistItem[];
  families: Family[];
  profiles: Map<string, Profile>;
  familyById: Map<string, Family>;
  hidden: Set<string>;
  filter: string;
  getContribution: (itemId: string, familyId: string) => Contribution | undefined;
  onAdjustQuantity: (itemId: string, familyId: string, delta: number) => Promise<void>;
  onToggleTask: (itemId: string, familyId: string) => Promise<void>;
  onClaim: (itemId: string, familyId: string) => Promise<void>;
  onUnclaim: (itemId: string) => Promise<void>;
  onAddItem: (category: string, label: string, trackingType: TrackingType) => Promise<ChecklistItem>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onHide: (itemId: string) => void;
  onUnhide: (itemId: string) => void;
  onOpenChat: (itemId: string) => void;
  onToggleShopping: (itemId: string) => void;
  shoppingListItems: Map<string, boolean>;
  unreadByItem: Map<string, number>;
  messageCountByItem: Map<string, number>;
  unreadCategory: number;
  onJumpInCategory: () => void;
  currentUserId: string;
  myFamilyId: string | null;
  isAdmin: boolean;
}

export default function ChecklistSection({
  category, items, families, profiles, familyById, hidden, filter,
  getContribution, onAdjustQuantity, onToggleTask, onClaim, onUnclaim,
  onAddItem, onDeleteItem, onHide, onUnhide,
  onOpenChat, onToggleShopping, shoppingListItems,
  unreadByItem, messageCountByItem, unreadCategory, onJumpInCategory,
  currentUserId, myFamilyId, isAdmin,
}: Props) {
  const filterActive = filter.trim().length > 0;
  const filterLower = filter.trim().toLowerCase();
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [newType, setNewType] = useState<TrackingType>(() => {
    if (items.length === 0) return 'quantity';
    const taskCount = items.filter((i) => i.tracking_type === 'task').length;
    return taskCount > items.length / 2 ? 'task' : 'quantity';
  });
  const [sortMode, setSortMode] = useSortMode(currentUserId, category.key);

  const { visibleItems, hiddenItems } = useMemo(() => {
    const v: ChecklistItem[] = [];
    const h: ChecklistItem[] = [];
    for (const i of items) {
      if (filterActive) {
        if (!i.label.toLowerCase().includes(filterLower)) continue;
        if (hidden.has(i.id)) continue; // hidden stays hidden under filter
        v.push(i);
      } else {
        (hidden.has(i.id) ? h : v).push(i);
      }
    }
    return { visibleItems: v, hiddenItems: h };
  }, [items, hidden, filterActive, filterLower]);

  const sortedVisibleItems = useMemo(() => {
    if (sortMode === 'default') return visibleItems;
    const arr = [...visibleItems];
    if (sortMode === 'alphabetical') {
      arr.sort((a, b) => a.label.localeCompare(b.label));
      return arr;
    }
    // missing-first: ordering by isMissing(true) → first, then sort_order
    arr.sort((a, b) => {
      const am = isMissing(a, families, myFamilyId, getContribution);
      const bm = isMissing(b, families, myFamilyId, getContribution);
      if (am !== bm) return am ? -1 : 1;
      return a.sort_order - b.sort_order;
    });
    return arr;
  }, [visibleItems, sortMode, families, myFamilyId, getContribution]);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      await onAddItem(category.key, newLabel.trim(), newType);
      setNewLabel('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <CollapsibleCard
      id={`cat-${category.key}`}
      storageKey={`cat:${category.key}`}
      userId={currentUserId}
      forceOpen={filterActive}
      tint={category.tint}
      tintFade={category.tintFade}
      tintShadow={category.tintShadow}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
            <span>{category.emoji}</span> {category.title}
            {unreadCategory > 0 && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Jump to next unread message in ${category.title}`}
                onClick={(e) => { e.stopPropagation(); onJumpInCategory(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    onJumpInCategory();
                  }
                }}
                className="bg-coral-500 hover:bg-coral-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none flex items-center gap-1 tabular-nums cursor-pointer transition"
                title={`${unreadCategory} unread message${unreadCategory === 1 ? '' : 's'} — jump to the next one`}
              >
                <MessageCircle size={11} />
                {unreadCategory}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{category.description}</p>
        </>
      }
    >
      {visibleItems.length === 0 && hiddenItems.length === 0 ? (
        <div className="text-sm text-slate-400 italic py-4 text-center">
          No items yet. Add one below to get started.
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="text-sm text-slate-400 italic py-4 text-center">
          All items in this category are hidden. Unhide below to bring them back.
        </div>
      ) : (
        <>
        {visibleItems.length > 1 && (
          <SortSelector value={sortMode} onChange={setSortMode} />
        )}
        <div className="divide-y divide-slate-100">
          {sortedVisibleItems.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              families={families}
              profiles={profiles}
              familyById={familyById}
              getContribution={getContribution}
              onAdjustQuantity={onAdjustQuantity}
              onToggleTask={onToggleTask}
              onClaim={onClaim}
              onUnclaim={onUnclaim}
              onDelete={onDeleteItem}
              onHide={onHide}
              onOpenChat={onOpenChat}
              onToggleShopping={onToggleShopping}
              isOnShoppingList={shoppingListItems.has(item.id)}
              unreadCount={unreadByItem.get(item.id) ?? 0}
              messageCount={messageCountByItem.get(item.id) ?? 0}
              currentUserId={currentUserId}
              myFamilyId={myFamilyId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
        </>
      )}

      {!filterActive && (
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`Add to ${category.title.toLowerCase()}…`}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200"
        />
        <div className="flex gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as TrackingType)}
            className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:border-ocean-400"
          >
            <option value="quantity">Count</option>
            <option value="task">Task</option>
            <option value="claim">Provided</option>
          </select>
          <button
            onClick={handleAdd}
            disabled={!newLabel.trim() || adding}
            className={cx(
              'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition',
              !newLabel.trim() || adding
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-ocean-600 text-white hover:bg-ocean-700',
            )}
          >
            {adding ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            Add
          </button>
        </div>
      </div>
      )}

      {!filterActive && hiddenItems.length > 0 && (
        <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setHiddenOpen((o) => !o)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
              {hiddenOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
              <span>Hidden items</span>
            </div>
            <span className="text-xs font-medium tabular-nums text-slate-500">{hiddenItems.length}</span>
          </button>
          {hiddenOpen && (
            <ul className="border-t border-slate-100 divide-y divide-slate-100">
              {hiddenItems.map((item) => (
                <HiddenRow
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  onUnhide={onUnhide}
                  onDelete={onDeleteItem}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </CollapsibleCard>
  );
}

/**
 * "Missing" depends on the item's tracking type:
 *
 * - quantity → nobody has committed any quantity yet (sum across families = 0).
 *   We don't have per-item targets, so "0 brought" is the only objective signal.
 * - task → my family hasn't ticked it yet. Tasks are per-family; another
 *   family's tick doesn't help me close out mine. If the user has no family
 *   yet, fall back to "no family has done it" (rare — pending users mostly).
 * - claim → nobody has claimed it. Once any family claims, it's covered for
 *   everyone (matches the user-requested rule: claim items provided by one
 *   family don't count as missing for the families NOT bringing them).
 */
function isMissing(
  item: ChecklistItem,
  families: Family[],
  myFamilyId: string | null,
  getContribution: (itemId: string, familyId: string) => Contribution | undefined,
): boolean {
  if (item.tracking_type === 'quantity') {
    let total = 0;
    for (const f of families) total += getContribution(item.id, f.id)?.quantity ?? 0;
    return total === 0;
  }
  if (item.tracking_type === 'task') {
    if (myFamilyId) return !getContribution(item.id, myFamilyId)?.done;
    return !families.some((f) => getContribution(item.id, f.id)?.done);
  }
  // claim
  return !families.some((f) => getContribution(item.id, f.id)?.done);
}

function SortSelector({
  value, onChange,
}: {
  value: SortMode;
  onChange: (next: SortMode) => void;
}) {
  return (
    <div className="flex justify-end items-center gap-1.5 mb-2 -mt-1 text-xs text-slate-500">
      <ArrowUpDown size={12} className="text-slate-400" />
      <label className="flex items-center gap-1">
        Sort
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortMode)}
          className="bg-transparent text-xs text-slate-700 font-medium border-0 focus:outline-none focus:ring-0 cursor-pointer underline underline-offset-2 decoration-dotted py-0 pr-5 pl-1"
          aria-label="Sort items"
        >
          <option value="default">default</option>
          <option value="alphabetical">A–Z</option>
          <option value="missing-first">missing first</option>
        </select>
      </label>
    </div>
  );
}

function HiddenRow({
  item, isAdmin, onUnhide, onDelete,
}: {
  item: ChecklistItem;
  isAdmin: boolean;
  onUnhide: (itemId: string) => void;
  onDelete: (itemId: string) => Promise<void>;
}) {
  return (
    <li className="px-3 py-2 flex items-center gap-2 text-sm">
      <span className="flex-1 text-slate-500 truncate">{item.label}</span>
      <button
        onClick={() => onUnhide(item.id)}
        className="text-slate-400 hover:text-ocean-600 p-1 rounded transition flex items-center gap-1 text-xs font-medium"
        title="Unhide"
      >
        <Eye size={14} />
        <span className="hidden sm:inline">Unhide</span>
      </button>
      {(!item.is_default || isAdmin) && (
        <button
          onClick={() => onDelete(item.id)}
          className="text-slate-300 hover:text-coral-500 p-1 rounded transition"
          title={item.is_default ? 'Remove (admin)' : 'Remove'}
        >
          <span className="text-base leading-none">×</span>
        </button>
      )}
    </li>
  );
}
