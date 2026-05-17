// Global online/offline event wiring. Imported for side effects from main.tsx.
//
// Listens to window 'online'/'offline' events plus visibilitychange→visible
// (some browsers don't fire 'online' reliably when waking a backgrounded tab,
// so this is a backstop). On reconnect, triggers a writeQueue flush AND
// notifies subscribers so hooks can refetch state that may have changed
// during the offline window.

import { writeQueue } from './supabase';

type Listener = () => void;

const stateListeners = new Set<Listener>();
const reconnectListeners = new Set<Listener>();

function notify(set: Set<Listener>) {
  for (const l of set) {
    try { l(); } catch (e) { console.warn('online listener threw', e); }
  }
}

let installed = false;

export function installNetworkSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('online', async () => {
    notify(stateListeners);
    // Order matters: flush our queued writes BEFORE refetching. Otherwise
    // the refetch can race the upserts and return stale rows (for existing
    // contributions) or no row at all (for new contributions), clobbering
    // the user's optimistic state. Realtime can't cover the gap because
    // its WebSocket is still mid-reconnect and won't replay missed inserts.
    await writeQueue.flush();
    notify(reconnectListeners);
  });

  window.addEventListener('offline', () => {
    notify(stateListeners);
  });

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      // Backstop for tabs woken from background where 'online' may not
      // fire reliably. Same order: flush, then refetch.
      await writeQueue.flush();
      notify(reconnectListeners);
    }
  });
}

export function subscribeOnlineState(listener: Listener): () => void {
  stateListeners.add(listener);
  return () => { stateListeners.delete(listener); };
}

/**
 * Fires when transitioning offline → online. Use this to refetch state that
 * realtime may have missed events for during the offline window.
 */
export function subscribeReconnect(listener: Listener): () => void {
  reconnectListeners.add(listener);
  return () => { reconnectListeners.delete(listener); };
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
