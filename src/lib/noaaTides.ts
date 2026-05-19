// NOAA CO-OPS tide predictions for Port Aransas, station 8775237 (USCG).
// Free API, no key. Predictions are computed astronomically so they work for
// any future date.
//
// API docs: https://api.tidesandcurrents.noaa.gov/api/prod/

import type { TideDay } from './trip-data';

const PORT_A_STATION = '8775237';
const API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

interface NoaaPrediction {
  t: string;     // 'YYYY-MM-DD HH:MM' in station local time
  v: string;     // tide height in feet (MLLW)
  type: 'H' | 'L';
}

interface NoaaResponse {
  predictions?: NoaaPrediction[];
}

export async function fetchPortATides(
  startDate: string,                          // 'YYYY-MM-DD'
  endDate: string,
  signal?: AbortSignal,
): Promise<TideDay[]> {
  // NOAA wants YYYYMMDD (no hyphens). They're lenient and accept other
  // formats too, but stick to the documented one.
  const begin = startDate.replace(/-/g, '');
  const end = endDate.replace(/-/g, '');

  const params = new URLSearchParams({
    station: PORT_A_STATION,
    product: 'predictions',
    interval: 'hilo',                         // only high/low extremes (~4/day)
    datum: 'MLLW',                            // Mean Lower Low Water — standard
    units: 'english',                         // feet, °F (unused for hi/lo)
    time_zone: 'lst_ldt',                     // station local time, DST-aware
    format: 'json',
    application: 'port-a-2026-family-app',
    begin_date: begin,
    end_date: end,
  });

  const res = await fetch(`${API_BASE}?${params}`, { signal });
  if (!res.ok) throw new Error(`NOAA ${res.status}`);
  const json = (await res.json()) as NoaaResponse;
  return groupPredictionsByDay(json.predictions ?? []);
}

interface TimeEntry {
  hour24: number;       // 0–23
  label: string;        // '6:12 AM' (12-hour display string)
}

// Group NOAA's flat hi/lo prediction list into one TideDay per calendar day.
// Each row gives `t` as 'YYYY-MM-DD HH:MM' in station local time; we pivot
// on the date portion and split into highs/lows.
export function groupPredictionsByDay(predictions: NoaaPrediction[]): TideDay[] {
  const byDate = new Map<string, { highs: TimeEntry[]; lows: TimeEntry[] }>();
  for (const p of predictions) {
    const [datePart, timePart] = p.t.split(' ');
    if (!datePart || !timePart) continue;
    let bucket = byDate.get(datePart);
    if (!bucket) {
      bucket = { highs: [], lows: [] };
      byDate.set(datePart, bucket);
    }
    const entry: TimeEntry = {
      hour24: parseInt(timePart.split(':')[0] ?? '0', 10),
      label: formatTime(timePart),
    };
    if (p.type === 'H') bucket.highs.push(entry);
    else if (p.type === 'L') bucket.lows.push(entry);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, b]) => ({
      date: formatDateLabel(iso),
      highs: b.highs.map((h) => h.label),
      lows: b.lows.map((l) => l.label),
      best: bestTimeHint(b),
    }));
}

// Heuristic for the "Best Time" column. Mornings before the first high or
// around a low are good for shelling; right before a high is good for
// swimming. If we can't tell, return an empty string and the UI hides the
// note. (The hardcoded fallback in trip-data.ts uses richer prose.)
function bestTimeHint(b: { highs: TimeEntry[]; lows: TimeEntry[] }): string {
  const firstLow = b.lows[0];
  if (firstLow) {
    if (firstLow.hour24 < 12) return `Morning shelling near ${firstLow.label}`;
    return `Afternoon shelling at ${firstLow.label}`;
  }
  const firstHigh = b.highs[0];
  if (firstHigh) return `Swim near high tide at ${firstHigh.label}`;
  return '';
}

// '06:12' → '6:12 AM' (style matches the hardcoded TIDE_FORECAST entries).
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// 'YYYY-MM-DD' → 'Mon May 25'
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  const day = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const date = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${date}`;
}
