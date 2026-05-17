import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const VERSION_CHANNEL = 'app-version';
// 4s in dev so the test cycle (write fake version.json → wait → see banner)
// is bearable; 3 minutes in prod so we don't hammer /version.json. Broadcast
// is the fast path anyway — first client to detect cascades to everyone.
const POLL_INTERVAL_MS = import.meta.env.DEV ? 4 * 1000 : 3 * 60 * 1000;

export interface VersionInfo {
  build_id: string;
  app_version: string;
  built_at?: string;
}

interface RawPayload {
  build_id?: string;
  app_version?: string;
  built_at?: string;
}

function normalize(raw: RawPayload | null | undefined): VersionInfo | null {
  if (!raw || !raw.build_id) return null;
  return {
    build_id: raw.build_id,
    app_version: raw.app_version ?? 'dev',
    built_at: raw.built_at,
  };
}

/**
 * Versioning + reload-prompt for the app.
 *
 * Loads /version.json on mount and stores it as `mountedVersion` — that's
 * what the header displays, so the user always sees "the version I'm
 * actually running." Polls /version.json on an interval (4s dev, 3 min
 * prod) plus on visibilitychange→visible. A poll that returns a different
 * build_id than mountedVersion sets `updateAvailable = true`, which the
 * Dashboard renders as a red banner under the TopBar. Clicking the banner
 * calls window.location.reload(); the next mount fetches the new
 * /version.json and the header updates.
 *
 * Realtime broadcast on `app-version` channel speeds up the cascade when
 * multiple clients are connected — the first to detect a mismatch
 * broadcasts (deduped per detected build_id); others trigger their own
 * poll instead of waiting for their interval.
 */
export function useVersionCheck() {
  const [mountedVersion, setMountedVersion] = useState<VersionInfo | null>(null);
  const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const mountedRef = useRef<VersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscribed = false;
    let broadcastedFor: string | null = null;

    async function fetchVersion(): Promise<VersionInfo | null> {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return null;
        return normalize(await res.json());
      } catch {
        return null;
      }
    }

    async function poll() {
      if (cancelled) return;
      const latest = await fetchVersion();
      if (cancelled) return;
      const mounted = mountedRef.current;
      if (!latest || !mounted) {
        setUpdateAvailable(false);
        return;
      }
      setLatestVersion(latest);
      const mismatch = latest.build_id !== mounted.build_id;
      setUpdateAvailable(mismatch);
      if (mismatch) {
        if (subscribed && broadcastedFor !== latest.build_id) {
          broadcastedFor = latest.build_id;
          channel.send({
            type: 'broadcast',
            event: 'new-version',
            payload: { build_id: latest.build_id },
          }).catch(() => { /* best-effort */ });
        }
      } else {
        broadcastedFor = null;
      }
    }

    const channel = supabase.channel(VERSION_CHANNEL);
    channel.on('broadcast', { event: 'new-version' }, () => {
      // Trust local poll, not payload — broadcast just kicks us into action.
      void poll();
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') subscribed = true;
    });

    // Mount: capture the running version. If the fetch fails (no
    // /version.json), we leave mountedVersion null and never trigger the
    // banner — useful in dev sessions where the file may not exist yet.
    void (async () => {
      const initial = await fetchVersion();
      if (cancelled || !initial) return;
      mountedRef.current = initial;
      setMountedVersion(initial);
    })();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };

    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { mountedVersion, latestVersion, updateAvailable, reload };
}
