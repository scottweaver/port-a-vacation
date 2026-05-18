import { useMemo, useState } from 'react';
import { ChefHat, Plus, Pencil, UserPlus, UserMinus } from 'lucide-react';
import type { Meal, MealType, Profile } from '@/types/db';
import { cx, firstName } from '@/lib/format';
import CollapsibleCard from './CollapsibleCard';
import MealFormModal from './MealFormModal';

interface Props {
  meals: Meal[];
  sousChefs: Map<string, Set<string>>;
  profiles: Map<string, Profile>;
  currentUserId: string;
  isAdmin: boolean;
  onCreate: (input: {
    meal_date: string;
    meal_type: MealType;
    title: string;
    notes: string | null;
    head_chef_id: string;
  }) => Promise<Meal | null>;
  onUpdate: (id: string, patch: {
    meal_date?: string;
    meal_type?: MealType;
    title?: string;
    notes?: string | null;
    head_chef_id?: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onJoinSous: (mealId: string) => void;
  onLeaveSous: (mealId: string, userId?: string) => void;
}

const MEAL_TYPE_META: Record<MealType, { label: string; emoji: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🥞' },
  lunch:     { label: 'Lunch',     emoji: '🌮' },
  dinner:    { label: 'Dinner',    emoji: '🍝' },
  other:     { label: 'Other',     emoji: '🍿' },
};

const TRIP_DATES = [
  '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28', '2026-05-29',
];

function formatDay(dateStr: string): string {
  // Parse as date-only (no TZ shift). new Date('2026-05-25') treats as UTC
  // midnight; in negative-UTC zones this can roll back a day.
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  const day = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const date = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${date}`;
}

export default function MealsCard({
  meals, sousChefs, profiles, currentUserId, isAdmin,
  onCreate, onUpdate, onDelete, onJoinSous, onLeaveSous,
}: Props) {
  const [modalState, setModalState] = useState<{ mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; meal: Meal }>({ mode: 'closed' });

  const profilesList = useMemo(() => [...profiles.values()], [profiles]);

  const mealsByDate = useMemo(() => {
    const m = new Map<string, Meal[]>();
    for (const meal of meals) {
      let arr = m.get(meal.meal_date);
      if (!arr) { arr = []; m.set(meal.meal_date, arr); }
      arr.push(meal);
    }
    return m;
  }, [meals]);

  return (
    <CollapsibleCard
      storageKey="meals"
      userId={currentUserId}
      header={
        <>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ChefHat size={20} className="text-ocean-600" />
            Meal Plan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Who's cooking what at the condo. Sign up as a sous chef to help.
          </p>
        </>
      }
    >
      {meals.length === 0 ? (
        <div className="text-sm text-slate-400 italic py-6 text-center">
          No meals planned yet. Tap below to plan one.
        </div>
      ) : (
        <div className="space-y-4">
          {TRIP_DATES.map((dateStr) => {
            const dayMeals = mealsByDate.get(dateStr) ?? [];
            if (dayMeals.length === 0) return null;
            return (
              <div key={dateStr}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  {formatDay(dateStr)}
                </h3>
                <div className="space-y-2">
                  {dayMeals.map((meal) => (
                    <MealRow
                      key={meal.id}
                      meal={meal}
                      sousChefSet={sousChefs.get(meal.id) ?? new Set()}
                      profiles={profiles}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onEdit={() => setModalState({ mode: 'edit', meal })}
                      onJoinSous={() => onJoinSous(meal.id)}
                      onLeaveSous={(uid) => onLeaveSous(meal.id, uid)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setModalState({ mode: 'create' })}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-ocean-600 text-white hover:bg-ocean-700 transition"
        >
          <Plus size={16} />
          Plan a meal
        </button>
      </div>

      {modalState.mode !== 'closed' && (
        <MealFormModal
          meal={modalState.mode === 'edit' ? modalState.meal : null}
          profiles={profilesList}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setModalState({ mode: 'closed' })}
          onSubmit={async (input) => {
            if (modalState.mode === 'edit') {
              await onUpdate(modalState.meal.id, input);
            } else {
              await onCreate(input);
            }
          }}
          onDelete={modalState.mode === 'edit'
            ? async () => { await onDelete(modalState.meal.id); }
            : undefined}
        />
      )}
    </CollapsibleCard>
  );
}

function MealRow({
  meal, sousChefSet, profiles, currentUserId, isAdmin,
  onEdit, onJoinSous, onLeaveSous,
}: {
  meal: Meal;
  sousChefSet: Set<string>;
  profiles: Map<string, Profile>;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: () => void;
  onJoinSous: () => void;
  onLeaveSous: (userId?: string) => void;
}) {
  const headChef = profiles.get(meal.head_chef_id);
  const sousChefs = useMemo(
    () => [...sousChefSet].map((uid) => profiles.get(uid)).filter((p): p is Profile => !!p),
    [sousChefSet, profiles],
  );
  const meta = MEAL_TYPE_META[meal.meal_type];
  const isHeadChef = meal.head_chef_id === currentUserId;
  const isSousChef = sousChefSet.has(currentUserId);
  const canEdit = isHeadChef || isAdmin;

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="text-xl leading-none mt-0.5" aria-label={meta.label}>{meta.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 truncate">{meal.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {meta.label}
              {' · '}
              <span className="inline-flex items-center gap-1">
                <ChefHat size={11} className="text-ocean-600" />
                {headChef ? firstName(headChef.display_name, headChef.email) : 'Unknown'}
              </span>
            </div>
            {meal.notes && (
              <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{meal.notes}</p>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-slate-400 hover:text-ocean-600 p-1 rounded transition flex-shrink-0"
            aria-label="Edit meal"
            title="Edit meal"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {sousChefs.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">helping:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {sousChefs.map((p) => (
                <SousChefPill
                  key={p.id}
                  profile={p}
                  removable={p.id === currentUserId || isHeadChef || isAdmin}
                  onRemove={() => onLeaveSous(p.id)}
                />
              ))}
            </div>
          </div>
        )}
        {!isHeadChef && !isSousChef && (
          <button
            type="button"
            onClick={onJoinSous}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-ocean-50 text-ocean-700 hover:bg-ocean-100 transition"
          >
            <UserPlus size={11} />
            I'll help
          </button>
        )}
        {isSousChef && (
          <button
            type="button"
            onClick={() => onLeaveSous()}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
            title="You're helping. Tap to leave."
          >
            <UserMinus size={11} />
            You're helping
          </button>
        )}
      </div>
    </div>
  );
}

function SousChefPill({
  profile, removable, onRemove,
}: {
  profile: Profile;
  removable: boolean;
  onRemove: () => void;
}) {
  const name = firstName(profile.display_name, profile.email);
  if (!removable) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
        {name}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cx(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition',
        'bg-slate-100 text-slate-700 hover:bg-coral-50 hover:text-coral-700',
      )}
      title="Remove from this meal"
    >
      {name}
      <X size={10} />
    </button>
  );
}

// Local X icon import to avoid pulling in an extra one from lucide.
function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
