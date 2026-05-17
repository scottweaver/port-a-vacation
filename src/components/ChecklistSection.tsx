import { useMemo, useState } from 'react';
import { Plus, Loader2, ChevronRight, ChevronDown, Eye } from 'lucide-react';
import type { ChecklistItem, Contribution, Family, Profile, TrackingType } from '@/types/db';
import type { CategoryMeta } from '@/lib/trip-data';
import { cx } from '@/lib/format';
import ChecklistRow from './ChecklistRow';
import CollapsibleCard from './CollapsibleCard';

interface Props {
  category: CategoryMeta;
  items: ChecklistItem[];
  families: Family[];
  profiles: Map<string, Profile>;
  familyById: Map<string, Family>;
  hidden: Set<string>;
  getContribution: (itemId: string, familyId: string) => Contribution | undefined;
  onAdjustQuantity: (itemId: string, familyId: string, delta: number) => Promise<void>;
  onToggleTask: (itemId: string, familyId: string) => Promise<void>;
  onClaim: (itemId: string, familyId: string) => Promise<void>;
  onUnclaim: (itemId: string) => Promise<void>;
  onAddItem: (category: string, label: string, trackingType: TrackingType) => Promise<ChecklistItem>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onHide: (itemId: string) => void;
  onUnhide: (itemId: string) => void;
  currentUserId: string;
  myFamilyId: string | null;
  isAdmin: boolean;
}

export default function ChecklistSection({
  category, items, families, profiles, familyById, hidden,
  getContribution, onAdjustQuantity, onToggleTask, onClaim, onUnclaim,
  onAddItem, onDeleteItem, onHide, onUnhide,
  currentUserId, myFamilyId, isAdmin,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [newType, setNewType] = useState<TrackingType>(() => {
    if (items.length === 0) return 'quantity';
    const taskCount = items.filter((i) => i.tracking_type === 'task').length;
    return taskCount > items.length / 2 ? 'task' : 'quantity';
  });

  const { visibleItems, hiddenItems } = useMemo(() => {
    const v: ChecklistItem[] = [];
    const h: ChecklistItem[] = [];
    for (const i of items) (hidden.has(i.id) ? h : v).push(i);
    return { visibleItems: v, hiddenItems: h };
  }, [items, hidden]);

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
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span>{category.emoji}</span> {category.title}
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
        <div className="divide-y divide-slate-100">
          {visibleItems.map((item) => (
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
              currentUserId={currentUserId}
              myFamilyId={myFamilyId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

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

      {hiddenItems.length > 0 && (
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
