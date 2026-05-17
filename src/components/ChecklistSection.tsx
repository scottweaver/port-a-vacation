import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
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
  getContribution: (itemId: string, familyId: string) => Contribution | undefined;
  onAdjustQuantity: (itemId: string, familyId: string, delta: number) => Promise<void>;
  onToggleTask: (itemId: string, familyId: string) => Promise<void>;
  onClaim: (itemId: string, familyId: string) => Promise<void>;
  onUnclaim: (itemId: string) => Promise<void>;
  onAddItem: (category: string, label: string, trackingType: TrackingType) => Promise<ChecklistItem>;
  onDeleteItem: (itemId: string) => Promise<void>;
  currentUserId: string;
  myFamilyId: string | null;
  isAdmin: boolean;
}

export default function ChecklistSection({
  category, items, families, profiles, familyById,
  getContribution, onAdjustQuantity, onToggleTask, onClaim, onUnclaim, onAddItem, onDeleteItem,
  currentUserId, myFamilyId, isAdmin,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<TrackingType>(() => {
    if (items.length === 0) return 'quantity';
    const taskCount = items.filter((i) => i.tracking_type === 'task').length;
    return taskCount > items.length / 2 ? 'task' : 'quantity';
  });

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
      {items.length === 0 ? (
        <div className="text-sm text-slate-400 italic py-4 text-center">
          No items yet. Add one below to get started.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
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
    </CollapsibleCard>
  );
}
