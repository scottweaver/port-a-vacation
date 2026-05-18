import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Trash2, Loader2 } from 'lucide-react';
import type { Meal, MealType, Profile } from '@/types/db';
import { cx } from '@/lib/format';

interface Props {
  /** When null = create mode; when set = edit mode. */
  meal: Meal | null;
  /** All approved profiles (used to populate the head-chef selector). */
  profiles: Profile[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (input: {
    meal_date: string;
    meal_type: MealType;
    title: string;
    notes: string | null;
    head_chef_id: string;
  }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

// Trip dates: May 25–29, 2026. Hard-coded since the trip has a fixed window.
const TRIP_DATES = [
  { value: '2026-05-25', label: 'Mon May 25' },
  { value: '2026-05-26', label: 'Tue May 26' },
  { value: '2026-05-27', label: 'Wed May 27' },
  { value: '2026-05-28', label: 'Thu May 28' },
  { value: '2026-05-29', label: 'Fri May 29' },
];

const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🥞' },
  { value: 'lunch',     label: 'Lunch',     emoji: '🌮' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🍝' },
  { value: 'other',     label: 'Other',     emoji: '🍿' },
];

export default function MealFormModal({
  meal, profiles, currentUserId, isAdmin, onClose, onSubmit, onDelete,
}: Props) {
  const isEdit = meal !== null;
  const [date, setDate] = useState(meal?.meal_date ?? TRIP_DATES[0]!.value);
  const [type, setType] = useState<MealType>(meal?.meal_type ?? 'dinner');
  const [title, setTitle] = useState(meal?.title ?? '');
  const [notes, setNotes] = useState(meal?.notes ?? '');
  const [headChefId, setHeadChefId] = useState(meal?.head_chef_id ?? currentUserId);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Whether the current user can reassign the head chef. Creator on a new
  // meal can pick anyone. On edit, head_chef can keep themselves or admin
  // can swap. (Enforced server-side by RLS too.)
  const canChangeHeadChef = !isEdit || isAdmin;

  useEffect(() => {
    // Focus title on open so you can start typing immediately.
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email)),
    [profiles],
  );

  async function handleSave() {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      await onSubmit({
        meal_date: date,
        meal_type: type,
        title: t,
        notes: notes.trim() || null,
        head_chef_id: headChefId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-900/60 flex items-stretch sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-sand-50 w-full sm:max-w-md sm:rounded-2xl shadow-xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Edit meal' : 'Plan a meal'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Day</label>
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200"
            >
              {TRIP_DATES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Meal</label>
            <div className="grid grid-cols-4 gap-2">
              {MEAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cx(
                    'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium transition',
                    type === t.value
                      ? 'bg-ocean-50 border-ocean-400 text-ocean-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span className="text-lg leading-none">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">What's cooking?</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
              placeholder="e.g. Shrimp pasta, Pancake morning, Brisket grill"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything anyone should know (allergies, prep timing, etc.)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Head chef
              {!canChangeHeadChef && <span className="text-slate-400 font-normal ml-1">(only admin can reassign)</span>}
            </label>
            <select
              value={headChefId}
              onChange={(e) => setHeadChefId(e.target.value)}
              disabled={!canChangeHeadChef}
              className={cx(
                'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200',
                !canChangeHeadChef && 'opacity-60 cursor-not-allowed',
              )}
            >
              {sortedProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name ?? p.email}
                  {p.id === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <footer className="px-4 py-3 border-t border-slate-200 bg-white flex items-center gap-2">
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className={cx(
                'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition',
                deleteConfirm
                  ? 'bg-coral-500 text-white hover:bg-coral-600'
                  : 'text-coral-600 hover:bg-coral-50',
              )}
              title={deleteConfirm ? 'Tap again to confirm' : 'Delete meal'}
            >
              <Trash2 size={14} />
              {deleteConfirm ? 'Tap to confirm' : 'Delete'}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className={cx(
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition',
              saving || !title.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-ocean-600 text-white hover:bg-ocean-700',
            )}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save' : 'Add meal'}
          </button>
        </footer>
      </div>
    </div>
  );
}
