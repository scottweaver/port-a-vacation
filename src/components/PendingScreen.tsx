import { Clock, LogOut } from 'lucide-react';
import type { Profile } from '@/types/db';
import { OWNER_EMAIL } from '@/lib/supabase';

interface Props {
  profile: Profile;
  onSignOut: () => Promise<void>;
}

export default function PendingScreen({ profile, onSignOut }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-amber-100 text-amber-700 rounded-full p-3 flex-shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Waiting for approval</h1>
              <p className="text-sm text-slate-600 mt-1">
                Hi {profile.display_name?.split(/\s+/)[0] ?? 'there'} — Scott needs to approve your access before you can see the trip dashboard.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Signed in as</span>
              <span className="font-medium text-slate-700">{profile.email}</span>
            </div>
            <div className="text-xs text-slate-500">
              This page will update automatically once Scott approves you — no need to refresh. You can also email <a href={`mailto:${OWNER_EMAIL}`} className="text-ocean-600 hover:underline">{OWNER_EMAIL}</a> to give him a nudge.
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium transition"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}


