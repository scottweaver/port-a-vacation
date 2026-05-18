import { useMemo, useRef, useState } from 'react';
import { ChefHat, Plus, Pencil, UserPlus, UserMinus, ChevronDown, ChevronRight } from 'lucide-react';
import type { Meal, MealIngredient, MealType, Profile } from '@/types/db';
import { cx, firstName } from '@/lib/format';
import { useCollapsedState } from '@/lib/useCollapsed';
import CollapsibleCard from './CollapsibleCard';
import MealFormModal from './MealFormModal';

interface Props {
  meals: Meal[];
  sousChefs: Map<string, Set<string>>;
  ingredients: Map<string, MealIngredient[]>;
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
  onAddIngredient: (mealId: string, input: { name: string; quantity: string | null; notes?: string | null }) => void;
  onDeleteIngredient: (mealId: string, ingredientId: string) => void;
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
  meals, sousChefs, ingredients, profiles, currentUserId, isAdmin,
  onCreate, onUpdate, onDelete, onJoinSous, onLeaveSous,
  onAddIngredient, onDeleteIngredient,
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
                      ingredients={ingredients.get(meal.id) ?? []}
                      profiles={profiles}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onEdit={() => setModalState({ mode: 'edit', meal })}
                      onJoinSous={() => onJoinSous(meal.id)}
                      onLeaveSous={(uid) => onLeaveSous(meal.id, uid)}
                      onAddIngredient={(input) => onAddIngredient(meal.id, input)}
                      onDeleteIngredient={(ingredientId) => onDeleteIngredient(meal.id, ingredientId)}
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
  meal, sousChefSet, ingredients, profiles, currentUserId, isAdmin,
  onEdit, onJoinSous, onLeaveSous, onAddIngredient, onDeleteIngredient,
}: {
  meal: Meal;
  sousChefSet: Set<string>;
  ingredients: MealIngredient[];
  profiles: Map<string, Profile>;
  currentUserId: string;
  isAdmin: boolean;
  onEdit: () => void;
  onJoinSous: () => void;
  onLeaveSous: (userId?: string) => void;
  onAddIngredient: (input: { name: string; quantity: string | null; notes?: string | null }) => void;
  onDeleteIngredient: (ingredientId: string) => void;
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
  // Anyone signed up to cook can edit ingredients; matches the RLS.
  const canEditIngredients = isHeadChef || isSousChef || isAdmin;
  // Per-meal collapse state, persisted per-user. Default collapsed so the
  // meal list stays compact; tap the summary line to expand.
  const [collapsed, setCollapsed] = useCollapsedState(`meal:${meal.id}`, currentUserId, true);
  // Ingredients sub-section: default expanded (when the meal itself is
  // expanded) if there are any ingredients to look at.
  const [showIngredients, setShowIngredients] = useState(ingredients.length > 0);

  const headChefName = headChef ? firstName(headChef.display_name, headChef.email) : 'Unknown';

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-100">
      <div className="flex items-center gap-2">
        {/* Summary line — always visible. Tap anywhere to toggle collapse. */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
        >
          {collapsed
            ? <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
            : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
          <span className="text-base leading-none flex-shrink-0" aria-label={meta.label}>{meta.emoji}</span>
          <span className="text-sm text-slate-800 min-w-0 flex-1 truncate">
            <span className="text-slate-500">{meta.label}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="font-semibold">{meal.title}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <ChefHat size={11} className="text-ocean-600" />
              {headChefName}
            </span>
          </span>
        </button>
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

      {!collapsed && meal.notes && (
        <p className="text-xs text-slate-500 whitespace-pre-wrap pl-6">{meal.notes}</p>
      )}

      {!collapsed && (
      <div className="flex items-center gap-2 flex-wrap pl-6">
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
      )}

      {/* Ingredients section — only when meal is expanded. Inner toggle still
          collapses just the ingredients without collapsing the whole meal.
          Visible to all when expanded; the add form + delete buttons only
          render for head_chef / sous_chefs / admin (mirrors RLS). */}
      {!collapsed && (ingredients.length > 0 || canEditIngredients) && (
        <div className="border-t border-slate-100 pt-2 pl-6">
          <button
            type="button"
            onClick={() => setShowIngredients((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 transition"
          >
            {showIngredients
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />}
            Ingredients
            <span className="text-slate-400 font-normal">
              ({ingredients.length})
            </span>
          </button>
          {showIngredients && (
            <div className="mt-2 space-y-1">
              {ingredients.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No ingredients yet.</p>
              ) : (
                ingredients.map((ing) => (
                  <IngredientRow
                    key={ing.id}
                    ingredient={ing}
                    canDelete={canEditIngredients}
                    onDelete={() => onDeleteIngredient(ing.id)}
                  />
                ))
              )}
              {canEditIngredients && (
                <AddIngredientForm onAdd={onAddIngredient} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IngredientRow({
  ingredient, canDelete, onDelete,
}: {
  ingredient: MealIngredient;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      {ingredient.quantity && (
        <span className="font-medium text-slate-700 tabular-nums">{ingredient.quantity}</span>
      )}
      <span className="text-slate-800 flex-1 min-w-0">
        {ingredient.name}
        {ingredient.notes && (
          <span className="text-slate-400 text-xs ml-1.5">— {ingredient.notes}</span>
        )}
      </span>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-300 hover:text-coral-500 p-0.5 rounded transition flex-shrink-0"
          aria-label={`Remove ${ingredient.name}`}
          title="Remove"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function AddIngredientForm({
  onAdd,
}: {
  onAdd: (input: { name: string; quantity: string | null; notes?: string | null }) => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const quantityRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  function submit() {
    const n = name.trim();
    if (!n) return;
    onAdd({ name: n, quantity: quantity.trim() || null });
    setName('');
    setQuantity('');
    // After adding, return focus to the quantity field so the next
    // ingredient can be entered with the natural flow: qty → Enter →
    // name → Enter → submitted, focus back to qty for the next one.
    quantityRef.current?.focus();
  }

  return (
    <div className="flex gap-1.5 mt-2 pt-2 border-t border-slate-100">
      <input
        ref={quantityRef}
        type="text"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.focus(); } }}
        placeholder="2 lbs"
        className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200 tabular-nums"
      />
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Ingredient"
        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-200"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        className={cx(
          'px-2 py-1 rounded text-xs font-medium flex items-center gap-0.5 transition flex-shrink-0',
          !name.trim()
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-ocean-600 text-white hover:bg-ocean-700',
        )}
      >
        <Plus size={12} />
        Add
      </button>
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
