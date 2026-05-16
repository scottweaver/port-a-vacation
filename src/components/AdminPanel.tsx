import { useState } from 'react';
import { Shield, CheckCircle2, XCircle, Loader2, Inbox } from 'lucide-react';
import type { Profile } from '@/types/db';
import { firstName, relativeTime } from '@/lib/format';

interface Props {
  pending: Profile[];
  onApprove: (id: string) => Promise<void>;
  onDeny: (id: string) => Promise<void>;
  onReconsider: (id: string) => Promise<void>;
  error: string | null;
}

export default function AdminPanel({ pending, onApprove, onDeny, error }: Props) {
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-ocean-600" />
          <h2 className="text-lg font-semibold text-slate-800">Admin</h2>
        </div>
        <p className="text-sm text-slate-600">
          Approve or deny new family members. Approved users see the dashboard immediately — no need for them to refresh.
        </p>
      </section>

      <section className="bg-white rounded-2xl shadow p-5">
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
