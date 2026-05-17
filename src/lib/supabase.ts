import { createClient } from '@supabase/supabase-js';
import { cache } from './cache';
import { WriteQueue } from './queue';
import { makeSupabaseSender } from './queueSender';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in your project URL and anon key.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/**
 * Singleton write queue. Hooks enqueue ops here when offline (or always —
 * see useChecklist/usePacking). Flushes happen on `online` events, on
 * visibilitychange→visible, and via an interval backstop.
 */
export const writeQueue = new WriteQueue(cache, makeSupabaseSender(supabase));

export const OWNER_EMAIL = 'scott.t.weaver@gmail.com';


