import { useCallback, useEffect, useRef, useState } from 'react';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import { fetchPortAWeather } from '@/lib/openMeteo';
import { WEATHER_FORECAST, type DayForecast } from '@/lib/trip-data';

export type DataSource = 'live' | 'cache' | 'fallback';

interface State {
  forecast: DayForecast[];
  source: DataSource;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
}

interface CacheEntry {
  forecast: DayForecast[];
  fetchedAt: string;
}

const CACHE_KEY = 'weather:open-meteo';
const STALE_AFTER_MS = 60 * 60 * 1000;        // 1 hour
const TRIP_START_DATE = '2026-05-25';
const TRIP_END_DATE = '2026-05-29';

/**
 * Open-Meteo-backed weather for the trip window. Stale-while-revalidate:
 * shows cached data instantly, fetches fresh in background, falls back to
 * the hardcoded WEATHER_FORECAST constant if both cache and network miss.
 *
 * Refresh triggers: mount (always), reconnect, visibilitychange→visible
 * when cache is older than 1h.
 */
export function useWeather() {
  const [state, setState] = useState<State>(() => hydrate());

  const inFlight = useRef<AbortController | null>(null);

  const fetchNow = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const forecast = await fetchPortAWeather(TRIP_START_DATE, TRIP_END_DATE, controller.signal);
      const fetchedAt = new Date().toISOString();
      try {
        cache.set<CacheEntry>(CACHE_KEY, { forecast, fetchedAt });
      } catch {
        // Quota / unavailable — proceed with in-memory only.
      }
      setState({
        forecast,
        source: 'live',
        lastUpdated: new Date(fetchedAt),
        loading: false,
        error: null,
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      // On failure, keep whatever we already had on screen. If we had nothing
      // (no cache, first load), we're still on the fallback constant per hydrate().
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
    forecast: state.forecast,
    source: state.source,
    lastUpdated: state.lastUpdated,
    loading: state.loading,
    error: state.error,
    refresh: fetchNow,
  };
}

function hydrate(): State {
  const cached = cache.get<CacheEntry>(CACHE_KEY);
  if (cached && Array.isArray(cached.forecast) && cached.forecast.length > 0) {
    return {
      forecast: cached.forecast,
      source: 'cache',
      lastUpdated: new Date(cached.fetchedAt),
      loading: false,
      error: null,
    };
  }
  return {
    forecast: WEATHER_FORECAST,
    source: 'fallback',
    lastUpdated: null,
    loading: true,
    error: null,
  };
}
