import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { TRIP_START } from '@/lib/trip-data';
import { useCountdown } from '@/lib/countdown';

interface Props {
  onSignIn: () => Promise<void>;
}

export default function SignInScreen({ onSignIn }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(TRIP_START);

  async function handle() {
    setError(null);
    setLoading(true);
    try {
      await onSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again?');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2">🏖️</div>
          <h1 className="text-3xl font-bold text-slate-800">Port A 2026</h1>
          <p className="text-slate-600 mt-2">Family Trip Dashboard</p>
          {!countdown.isPast && (
            <p className="text-sm text-coral-500 mt-4 mb-2 font-medium">
              {countdown.days} days, {countdown.hours} hours until we leave Austin
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="font-semibold text-slate-800 mb-1">Sign in to get started</h2>
          <p className="text-sm text-slate-600 mb-4">
            Use your Google account. Scott will approve new family members.
          </p>

          <button
            onClick={handle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <GoogleIcon />}
            <span>{loading ? 'Redirecting…' : 'Sign in with Google'}</span>
          </button>

          {error && (
            <div className="mt-4 p-3 bg-coral-50 border border-coral-200 text-coral-700 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          May 25–29, 2026 · Port Aransas, Texas
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}


