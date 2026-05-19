import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, XCircle, Loader2, Inbox, Home, Save } from 'lucide-react';
import type { CondoInfo, CondoInfoPatch, Profile } from '@/types/db';
import { firstName, relativeTime } from '@/lib/format';

interface Props {
  pending: Profile[];
  onApprove: (id: string) => Promise<void>;
  onDeny: (id: string) => Promise<void>;
  onReconsider: (id: string) => Promise<void>;
  error: string | null;
  condoInfo: CondoInfo | null;
  onUpdateCondoInfo: (patch: CondoInfoPatch) => void;
}

export default function AdminPanel({ pending, onApprove, onDeny, error, condoInfo, onUpdateCondoInfo }: Props) {
  return (
    <div className="space-y-6">
      <section className="bg-sand-50 rounded-2xl shadow p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-ocean-600" />
          <h2 className="text-lg font-semibold text-slate-800">Admin</h2>
        </div>
        <p className="text-sm text-slate-600">
          Approve or deny new family members. Approved users see the dashboard immediately — no need for them to refresh.
        </p>
      </section>

      <section className="bg-sand-50 rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">Pending requests</h3>
          <span className="text-xs text-slate-500">
            {pending.length} {pending.length === 1 ? 'person' : 'people'} waiting
          </span>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-coral-50 border border-coral-200 text-coral-700 text-sm rounded-lg">{error}</div>
        )}

        {pending.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-slate-400">
            <Inbox size={32} className="mb-2" />
            <div className="text-sm">No pending requests right now.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map((p) => (
              <PendingRow key={p.id} profile={p} onApprove={onApprove} onDeny={onDeny} />
            ))}
          </div>
        )}
      </section>

      <CondoInfoEditor info={condoInfo} onUpdate={onUpdateCondoInfo} />
    </div>
  );
}

function PendingRow({
  profile, onApprove, onDeny,
}: {
  profile: Profile;
  onApprove: (id: string) => Promise<void>;
  onDeny: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);

  async function handle(action: 'approve' | 'deny') {
    setBusy(action);
    try {
      if (action === 'approve') await onApprove(profile.id);
      else await onDeny(profile.id);
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
            {firstName(profile.display_name, profile.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">
            {profile.display_name ?? profile.email}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {profile.email} · requested {relativeTime(profile.created_at)}
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => handle('deny')}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy === 'deny' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Deny
        </button>
        <button
          onClick={() => handle('approve')}
          disabled={busy !== null}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Approve
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// CondoInfoEditor — single-form editor for the condo_info row. All approved
// users CAN see this section (we don't gate the UI by is_admin since the
// admin tab itself is already gated), but RLS blocks non-admin saves at the
// server. Save button rejects empty diffs.
// =============================================================================

type FormState = {
  door_code: string;
  pool_code: string;
  wifi_ssid: string;
  wifi_password: string;
  host_name: string;
  host_phone: string;
  check_in_time: string;
  check_out_time: string;
  bike_rental_name: string;
  bike_rental_address: string;
  bike_rental_phone: string;
  golf_cart_name: string;
  golf_cart_address: string;
  golf_cart_phone: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  door_code: '', pool_code: '',
  wifi_ssid: '', wifi_password: '',
  host_name: '', host_phone: '',
  check_in_time: '', check_out_time: '',
  bike_rental_name: '', bike_rental_address: '', bike_rental_phone: '',
  golf_cart_name: '', golf_cart_address: '', golf_cart_phone: '',
  notes: '',
};

function infoToForm(info: CondoInfo | null): FormState {
  if (!info) return EMPTY_FORM;
  return {
    door_code: info.door_code ?? '',
    pool_code: info.pool_code ?? '',
    wifi_ssid: info.wifi_ssid ?? '',
    wifi_password: info.wifi_password ?? '',
    host_name: info.host_name ?? '',
    host_phone: info.host_phone ?? '',
    check_in_time: info.check_in_time ?? '',
    check_out_time: info.check_out_time ?? '',
    bike_rental_name: info.bike_rental_name ?? '',
    bike_rental_address: info.bike_rental_address ?? '',
    bike_rental_phone: info.bike_rental_phone ?? '',
    golf_cart_name: info.golf_cart_name ?? '',
    golf_cart_address: info.golf_cart_address ?? '',
    golf_cart_phone: info.golf_cart_phone ?? '',
    notes: info.notes ?? '',
  };
}

function diff(form: FormState, info: CondoInfo | null): CondoInfoPatch {
  const patch: CondoInfoPatch = {};
  const k = Object.keys(form) as (keyof FormState)[];
  for (const key of k) {
    const next = form[key].trim() === '' ? null : form[key];
    const prev = (info?.[key] ?? null) as string | null;
    if (next !== prev) patch[key] = next;
  }
  return patch;
}

function CondoInfoEditor({ info, onUpdate }: { info: CondoInfo | null; onUpdate: (patch: CondoInfoPatch) => void }) {
  const [form, setForm] = useState<FormState>(() => infoToForm(info));
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Sync form state in from realtime updates only when the user isn't
  // actively editing (avoids overwriting in-progress typing). We approximate
  // "not editing" by checking whether the form currently matches what the
  // server had before this incoming update — i.e. no local diff.
  useEffect(() => {
    setForm((current) => {
      const patch = diff(current, info);
      if (Object.keys(patch).length === 0) return infoToForm(info);
      return current;
    });
  }, [info]);

  const patch = diff(form, info);
  const dirty = Object.keys(patch).length > 0;

  function field<K extends keyof FormState>(key: K) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  function handleSave() {
    if (!dirty) return;
    onUpdate(patch);
    setSavedAt(Date.now());
  }

  return (
    <section className="bg-sand-50 rounded-2xl shadow p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Home size={20} className="text-coral-500" />
          <h3 className="font-semibold text-slate-800">Condo info</h3>
        </div>
        <span className="text-xs text-slate-500">
          {info?.updated_at ? `Last edit ${relativeTime(info.updated_at)}` : 'Not set yet'}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Visible to every approved family member. Changes appear on everyone's app instantly — no refresh needed.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Door code" {...field('door_code')} />
        <Field label="Pool code" {...field('pool_code')} />
        <Field label="Wifi SSID" {...field('wifi_ssid')} />
        <Field label="Wifi password" {...field('wifi_password')} />
        <Field label="Host name" {...field('host_name')} />
        <Field label="Host phone" {...field('host_phone')} placeholder="361-555-1234" />
        <Field label="Check-in time" {...field('check_in_time')} placeholder="Mon 4:00 PM" />
        <Field label="Check-out time" {...field('check_out_time')} placeholder="Fri 10:00 AM" />
      </div>

      <fieldset className="border border-slate-200 rounded-xl p-3 space-y-2">
        <legend className="text-xs text-slate-500 px-1">Bike Rental</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name" {...field('bike_rental_name')} />
          <Field label="Address" {...field('bike_rental_address')} />
          <Field label="Phone" {...field('bike_rental_phone')} />
        </div>
      </fieldset>

      <fieldset className="border border-slate-200 rounded-xl p-3 space-y-2">
        <legend className="text-xs text-slate-500 px-1">Golf Cart Rental</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name" {...field('golf_cart_name')} />
          <Field label="Address" {...field('golf_cart_address')} />
          <Field label="Phone" {...field('golf_cart_phone')} />
        </div>
      </fieldset>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea
          {...field('notes')}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-ocean-400 focus:outline-none focus:ring-1 focus:ring-ocean-400"
          placeholder="Anything else worth surfacing — gate codes, garbage pickup days, quiet hours..."
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {dirty
            ? `${Object.keys(patch).length} unsaved change${Object.keys(patch).length === 1 ? '' : 's'}`
            : savedAt
              ? 'Saved'
              : ' '}
        </span>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="px-4 py-2 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700 text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          Save
        </button>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-ocean-400 focus:outline-none focus:ring-1 focus:ring-ocean-400"
      />
    </div>
  );
}
