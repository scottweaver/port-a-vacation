import { memo, useState } from 'react';
import { Minus, Plus, X, Check, Circle, Hand, EyeOff } from 'lucide-react';
import type { ChecklistItem, Contribution, Family, Profile } from '@/types/db';
import { cx, firstName, relativeTime } from '@/lib/format';

interface Props {
  item: ChecklistItem;
  families: Family[];
  profiles: Map<string, Profile>;
  familyById: Map<string, Family>;
  getContribution: (itemId: string, familyId: string) => Contribution | undefined;
  onAdjustQuantity: (itemId: string, familyId: string, delta: number) => Promise<void>;
  onToggleTask: (itemId: string, familyId: string) => Promise<void>;
  onClaim: (itemId: string, familyId: string) => Promise<void>;
  onUnclaim: (itemId: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onHide: (itemId: string) => void;
  currentUserId: string;
  myFamilyId: string | null;
  isAdmin: boolean;
}

const stripThe = (name: string) => name.replace(/^The\s+/i, '');

export default function ChecklistRow({
  item, families, profiles, familyById,
  getContribution, onAdjustQuantity, onToggleTask, onClaim, onUnclaim, onDelete, onHide,
  myFamilyId, isAdmin,
}: Props) {
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [unclaimConfirming, setUnclaimConfirming] = useState(false);

  const allContribs = families
    .map((f) => getContribution(item.id, f.id))
    .filter((c): c is Contribution => Boolean(c));

  let summary = '';
  let isDone = false;
  let claimingFamily: Family | undefined;

  if (item.tracking_type === 'quantity') {
    const total = allContribs.reduce((s, c) => s + c.quantity, 0);
    summary = total > 0 ? `${total} total` : '';
    isDone = total > 0;
  } else if (item.tracking_type === 'task') {
    const doneFamilies = allContribs.filter((c) => c.done).length;
    summary = `${doneFamilies}/${families.length}`;
    isDone = doneFamilies === families.length;
  } else {
    const claimContrib = allContribs.find((c) => c.done);
    claimingFamily = claimContrib ? familyById.get(claimContrib.family_id) : undefined;
    summary = claimingFamily ? 'Provided' : '';
    isDone = !!claimingFamily;
  }

  const latest = allContribs
    .filter((c) => c.updated_by)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  const latestProfile = latest?.updated_by ? profiles.get(latest.updated_by) : undefined;
  const latestFamily = latest?.family_id ? familyById.get(latest.family_id) : undefined;

  return (
    <div className="py-3 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cx('text-sm font-medium', isDone ? 'text-slate-800' : 'text-slate-700')}>
              {item.label}
            </span>
            {summary && (
              <span className={cx(
                'text-xs px-1.5 py-0.5 rounded font-medium',
                isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
              )}>
                {summary}
              </span>
            )}
            {!item.is_default && (
              <span className="text-xs text-ocean-600 bg-ocean-50 px-1.5 py-0.5 rounded">custom</span>
            )}
          </div>
          {latest && latestProfile && latestFamily && (
            <div className="text-xs text-slate-400 mt-0.5">
              Last updated by {firstName(latestProfile.display_name, latestProfile.email)} ({latestFamily.display_name}) · {relativeTime(latest.updated_at)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onHide(item.id)}
            className="opacity-0 group-hover:opacity-100 sm:opacity-100 p-1 rounded transition text-slate-300 hover:text-slate-600"
            title="Hide from your family's planning view"
          >
            <EyeOff size={16} />
          </button>
          {(!item.is_default || isAdmin) && (
            <button
              onClick={() => (deleteConfirming ? onDelete(item.id) : setDeleteConfirming(true))}
              onBlur={() => setDeleteConfirming(false)}
              className={cx(
                'opacity-0 group-hover:opacity-100 sm:opacity-100 p-1 rounded transition',
                deleteConfirming ? 'text-coral-600 bg-coral-50' : 'text-slate-300 hover:text-coral-500',
              )}
              title={
                deleteConfirming
                  ? 'Click again to confirm'
                  : item.is_default
                    ? 'Remove (admin)'
                    : 'Remove'
              }
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {item.tracking_type === 'claim' ? (
        claimingFamily ? (
          <button
            onClick={() => (unclaimConfirming ? onUnclaim(item.id) : setUnclaimConfirming(true))}
            onBlur={() => setUnclaimConfirming(false)}
            className={cx(
              'mt-2 w-full rounded-lg border p-2 flex items-center justify-center gap-2 transition text-sm font-medium',
              unclaimConfirming
                ? 'bg-coral-50 border-coral-200 text-coral-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
              claimingFamily.id === myFamilyId && !unclaimConfirming && 'ring-1 ring-ocean-300',
            )}
            title={unclaimConfirming ? 'Click again to release' : 'Click to release'}
          >
            <Check size={16} className="flex-shrink-0" />
            <span>
              {unclaimConfirming
                ? `Tap again to release`
                : `Provided by the ${stripThe(claimingFamily.display_name)}`}
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {families.map((family) => (
              <ClaimButton
                key={family.id}
                family={family}
                isMine={family.id === myFamilyId}
                onClaim={() => onClaim(item.id, family.id)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {families.map((family) => {
            const contrib = getContribution(item.id, family.id);
            const isMine = family.id === myFamilyId;
            return (
              <FamilyControl
                key={family.id}
                itemId={item.id}
                familyId={family.id}
                family={family}
                isMine={isMine}
                tracking={item.tracking_type}
                quantity={contrib?.quantity ?? 0}
                done={contrib?.done ?? false}
                onAdjust={onAdjustQuantity}
                onToggle={onToggleTask}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClaimButton({
  family, isMine, onClaim,
}: {
  family: Family;
  isMine: boolean;
  onClaim: () => Promise<void>;
}) {
  const short = stripThe(family.display_name);
  return (
    <button
      onClick={onClaim}
      className={cx(
        'rounded-lg border p-2 flex items-center justify-between gap-2 transition',
        'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700',
        isMine && 'ring-1 ring-ocean-300',
      )}
      title={`Claim for ${short}`}
    >
      <div className="text-xs truncate flex items-center gap-1">
        {isMine && <span className="text-ocean-600">●</span>}
        <span className="truncate">{short}</span>
      </div>
      <Hand size={16} className="text-slate-400 flex-shrink-0" />
    </button>
  );
}

const FamilyControl = memo(function FamilyControl({
  itemId, familyId, family, isMine, tracking, quantity, done, onAdjust, onToggle,
}: {
  itemId: string;
  familyId: string;
  family: Family;
  isMine: boolean;
  tracking: 'quantity' | 'task' | 'claim';
  quantity: number;
  done: boolean;
  onAdjust: (itemId: string, familyId: string, delta: number) => Promise<void>;
  onToggle: (itemId: string, familyId: string) => Promise<void>;
}) {
  const short = stripThe(family.display_name);

  if (tracking === 'quantity') {
    const active = quantity > 0;
    return (
      <div className={cx(
        'rounded-lg border p-2 flex flex-col gap-1.5',
        active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200',
        isMine && 'ring-1 ring-ocean-300',
      )}>
        <div className="text-xs text-slate-600 truncate flex items-center gap-1">
          {isMine && <span className="text-ocean-600">●</span>}
          <span className="truncate">{short}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => onAdjust(itemId, familyId, -1)}
            disabled={quantity <= 0}
            className="w-7 h-7 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Decrease ${short}`}
          >
            <Minus size={14} />
          </button>
          <span className={cx(
            'font-bold tabular-nums min-w-[1.5rem] text-center',
            active ? 'text-emerald-700' : 'text-slate-400',
          )}>
            {quantity}
          </span>
          <button
            onClick={() => onAdjust(itemId, familyId, 1)}
            className="w-7 h-7 rounded flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            aria-label={`Increase ${short}`}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onToggle(itemId, familyId)}
      className={cx(
        'rounded-lg border p-2 flex items-center justify-between gap-2 transition',
        done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100',
        isMine && 'ring-1 ring-ocean-300',
      )}
    >
      <div className="text-xs text-slate-600 truncate flex items-center gap-1">
        {isMine && <span className="text-ocean-600">●</span>}
        <span className="truncate">{short}</span>
      </div>
      {done ? <Check size={18} className="text-emerald-600 flex-shrink-0" /> : <Circle size={18} className="text-slate-300 flex-shrink-0" />}
    </button>
  );
});
