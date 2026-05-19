// Open-Meteo weather forecast for Port Aransas. Free API, no key, no rate
// limit at our usage. 7-day daily forecast covers the trip (May 25–29).
//
// API docs: https://open-meteo.com/en/docs
// Returns daily max/min temp (°F), weather code, precipitation probability.

import type { Condition, DayForecast } from './trip-data';

// Port Aransas, TX — coordinates of the USCG Station (matches the NOAA tide
// station for consistency).
const PORT_A_LAT = 27.8336;
const PORT_A_LON = -97.0608;

const API_BASE = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  daily: {
    time: string[];                          // ISO dates 'YYYY-MM-DD'
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
  };
}

export async function fetchPortAWeather(
  startDate: string,                          // 'YYYY-MM-DD'
  endDate: string,
  signal?: AbortSignal,
): Promise<DayForecast[]> {
  const params = new URLSearchParams({
    latitude: String(PORT_A_LAT),
    longitude: String(PORT_A_LON),
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    temperature_unit: 'fahrenheit',
    timezone: 'America/Chicago',
    start_date: startDate,
    end_date: endDate,
  });

  const res = await fetch(`${API_BASE}?${params}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as OpenMeteoResponse;
  return parseOpenMeteoResponse(json);
}

export function parseOpenMeteoResponse(json: OpenMeteoResponse): DayForecast[] {
  const d = json.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((iso, i) => ({
    date: formatDateLabel(iso),
    day: dayLabel(iso, i),
    high: Math.round(d.temperature_2m_max[i] ?? 0),
    low: Math.round(d.temperature_2m_min[i] ?? 0),
    condition: weatherCodeToCondition(d.weather_code[i] ?? 0),
    rainChance: Math.round(d.precipitation_probability_max[i] ?? 0),
    note: '',
  }));
}

// Open-Meteo WMO weather codes → our 5-bucket Condition. Reference:
// https://open-meteo.com/en/docs (search "WMO Weather interpretation codes")
export function weatherCodeToCondition(code: number): Condition {
  if (code === 0) return 'sunny';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'cloudy';            // fog
  if (code >= 51 && code <= 57) return 'drizzle';             // drizzle / freezing drizzle
  if (code >= 61 && code <= 67) return 'rain';                // rain
  if (code >= 71 && code <= 77) return 'cloudy';              // snow (not expected in May)
  if (code >= 80 && code <= 82) return 'rain';                // rain showers
  if (code >= 85 && code <= 86) return 'cloudy';              // snow showers
  if (code >= 95 && code <= 99) return 'rain';                // thunderstorms
  return 'partly-cloudy';                                     // safe default
}

// 'YYYY-MM-DD' → 'Mon May 25' (match the format of the hardcoded fallback)
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  const day = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const date = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} ${date}`;
}

function dayLabel(_iso: string, index: number): string {
  return `Day ${index + 1}`;
}
