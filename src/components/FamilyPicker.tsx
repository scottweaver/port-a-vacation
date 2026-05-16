import { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import type { Profile } from '@/types/db';
import { useFamilies } from '@/hooks/useFamilies';
import { cx } from '@/lib/format';

interface Props {
  profile: Profile;
}

export default function FamilyPicker({ profile }: Props) {
  const { families, loading, setMyFamily } = useFamilies();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await setMyFamily(profile.id, selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center bg-ocean-100 text-ocean-600 rounded-full p-3 mb-3">
            <Users size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {profile.display_name?.split(/\s+/)[0]}!</h1>
          <p className="text-sm text-slate-600 mt-1">Which family are you in?</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
          ) : (
            <div className="space-y-2">
              {families.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={cx(
                    'w-full p-4 rounded-xl border-2 text-left transition',
                    selected === f.id
                      ? 'border-ocean-500 bg-ocean-50 text-ocean-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700',
                  )}
                >
                  <div className="font-semibold">{f.display_name}</div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selected || saving}
            className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3 bg-ocean-600 text-white rounded-lg font-medium hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : null}
            {saving ? 'Saving…' : 'Continue'}
          </button>

          {error && (
            <div className="mt-3 p-3 bg-coral-50 border border-coral-200 text-coral-700 text-sm rounded-lg">{error}</div>
          )}

          <p className="mt-4 text-xs text-slate-500 text-center">
            You can change this later from your profile menu.
          </p>
        </div>
      </div>
    </div>
  );
}


