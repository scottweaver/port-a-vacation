import { ShieldX, LogOut } from 'lucide-react';
import type { Profile } from '@/types/db';
import { OWNER_EMAIL, OWNER_NAME } from '@/lib/supabase';

interface Props {
  profile: Profile;
  onSignOut: () => Promise<void>;
}

export default function DeniedScreen({ profile, onSignOut }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-coral-100 text-coral-600 rounded-full p-3 flex-shrink-0">
              <ShieldX size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Access not granted</h1>
              <p className="text-sm text-slate-600 mt-1">
                {OWNER_EMAIL ? (
                  <>
                    If this is a mistake, reach out to {OWNER_NAME} at{' '}
                    <a href={`mailto:${OWNER_EMAIL}`} className="text-ocean-600 hover:underline">{OWNER_EMAIL}</a>.
                  </>
                ) : (
                  <>If this is a mistake, reach out to {OWNER_NAME}.</>
                )}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-500">Signed in as</span>
              <span className="font-medium text-slate-700">{profile.email}</span>
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


