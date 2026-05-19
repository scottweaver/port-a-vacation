import { useCallback, useEffect, useRef, useState } from 'react';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import { fetchPortATides } from '@/lib/noaaTides';
import { TIDE_FORECAST, type TideDay } from '@/lib/trip-data';
import type { DataSource } from './useWeather';

interface State {
  tides: TideDay[];
  source: DataSource;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
}

interface CacheEntry {
  tides: TideDay[];
  fetchedAt: string;
}

const CACHE_KEY = 'tides:noaa';
// Tides are astronomical so they barely change — once a day is plenty, but
// the cheap API doesn't punish us for hourly checks either. Match weather.
const STALE_AFTER_MS = 60 * 60 * 1000;
const TRIP_START_DATE = '2026-05-25';
const TRIP_END_DATE = '2026-05-29';

/**
 * NOAA CO-OPS-backed tide predictions for the trip window. Same
 * stale-while-revalidate pattern as useWeather, same fallback to the
 * hardcoded TIDE_FORECAST when network fails.
 */
export function useTides() {
  const [state, setState] = useState<State>(() => hydrate());

  const inFlight = useRef<AbortController | null>(null);

  const fetchNow = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const tides = await fetchPortATides(TRIP_START_DATE, TRIP_END_DATE, controller.signal);
      const fetchedAt = new Date().toISOString();
      try {
        cache.set<CacheEntry>(CACHE_KEY, { tides, fetchedAt });
      } catch {
        // Quota / unavailable — proceed with in-memory only.
      }
      setState({
        tides,
        source: 'live',
        lastUpdated: new Date(fetchedAt),
        loading: false,
        error: null,
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    void fetchNow();
    const unsubReconnect = subscribeReconnect(() => { void fetchNow(); });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const cached = cache.get<CacheEntry>(CACHE_KEY);
      if (!cached) return;
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age > STALE_AFTER_MS) void fetchNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      inFlight.current?.abort();
      unsubReconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNow]);

  return {
    tides: state.tides,
    source: state.source,
    lastUpdated: state.lastUpdated,
    loading: state.loading,
    error: state.error,
    refresh: fetchNow,
  };
}

function hydrate(): State {
  const cached = cache.get<CacheEntry>(CACHE_KEY);
  if (cached && Array.isArray(cached.tides) && cached.tides.length > 0) {
    return {
      tides: cached.tides,
      source: 'cache',
      lastUpdated: new Date(cached.fetchedAt),
      loading: false,
      error: null,
    };
  }
  return {
    tides: TIDE_FORECAST,
    source: 'fallback',
    lastUpdated: null,
    loading: true,
    error: null,
  };
}
