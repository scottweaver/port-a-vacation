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

/**
 * Project owner contact info — surfaced on the Pending/Denied screens as
 * "email <owner> to nudge them." Both come from env vars so a fork doesn't
 * have to edit source to point at a different person:
 *
 *   VITE_OWNER_EMAIL — required for the mailto link to be useful. If unset,
 *     the screens fall back to a generic "an admin will approve you" copy.
 *   VITE_OWNER_NAME  — optional. Used in the personable "Scott needs to
 *     approve" sentence. Falls back to extracting the first chunk of the
 *     email local-part ("scott.t.weaver" → "Scott"), then to "the admin".
 *
 * NOTE: there's still a `scott.t.weaver@gmail.com` hardcoded in the
 * `handle_new_user` SQL trigger (migration 0001). Removing that requires a
 * new migration introducing an `app_config(owner_email)` table; tracked as
 * a follow-up. Forkers must edit that line in 0001_init.sql before applying.
 */
export const OWNER_EMAIL: string = (import.meta.env.VITE_OWNER_EMAIL ?? '').trim();
export const OWNER_NAME: string =
  (import.meta.env.VITE_OWNER_NAME ?? '').trim() || ownerNameFromEmail(OWNER_EMAIL);

function ownerNameFromEmail(email: string): string {
  if (!email) return 'the admin';
  const local = email.split('@')[0] ?? '';
  const firstChunk = local.split(/[.\-_]/)[0] ?? local;
  if (!firstChunk) return 'the admin';
  return firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1).toLowerCase();
}


