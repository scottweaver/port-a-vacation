import { describe, it, expect } from 'vitest';
import { parseOpenMeteoResponse, weatherCodeToCondition } from './openMeteo';

describe('weatherCodeToCondition', () => {
  it('maps clear sky to sunny', () => {
    expect(weatherCodeToCondition(0)).toBe('sunny');
  });
  it('maps mainly clear / partly cloudy', () => {
    expect(weatherCodeToCondition(1)).toBe('partly-cloudy');
    expect(weatherCodeToCondition(2)).toBe('partly-cloudy');
  });
  it('maps overcast to cloudy', () => {
    expect(weatherCodeToCondition(3)).toBe('cloudy');
  });
  it('maps fog to cloudy', () => {
    expect(weatherCodeToCondition(45)).toBe('cloudy');
    expect(weatherCodeToCondition(48)).toBe('cloudy');
  });
  it('maps drizzle codes to drizzle', () => {
    expect(weatherCodeToCondition(51)).toBe('drizzle');
    expect(weatherCodeToCondition(55)).toBe('drizzle');
    expect(weatherCodeToCondition(57)).toBe('drizzle');
  });
  it('maps rain codes to rain', () => {
    expect(weatherCodeToCondition(61)).toBe('rain');
    expect(weatherCodeToCondition(65)).toBe('rain');
    expect(weatherCodeToCondition(80)).toBe('rain');
    expect(weatherCodeToCondition(82)).toBe('rain');
  });
  it('maps thunderstorms to rain', () => {
    expect(weatherCodeToCondition(95)).toBe('rain');
    expect(weatherCodeToCondition(99)).toBe('rain');
  });
  it('falls back to partly-cloudy for unknown codes', () => {
    expect(weatherCodeToCondition(999)).toBe('partly-cloudy');
  });
});

describe('parseOpenMeteoResponse', () => {
  it('maps the daily arrays to DayForecast records', () => {
    const result = parseOpenMeteoResponse({
      daily: {
        time: ['2026-05-25', '2026-05-26'],
        temperature_2m_max: [84.3, 86.7],
        temperature_2m_min: [73.5, 75.2],
        weather_code: [0, 61],
        precipitation_probability_max: [10, 65],
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      high: 84,
      low: 74,
      condition: 'sunny',
      rainChance: 10,
    });
    expect(result[1]).toMatchObject({
      high: 87,
      low: 75,
      condition: 'rain',
      rainChance: 65,
    });
    // date label format check
    expect(result[0]!.date).toMatch(/^\w{3} \w{3} \d+$/);
    // day label is index-based
    expect(result[0]!.day).toBe('Day 1');
    expect(result[1]!.day).toBe('Day 2');
  });

  it('returns empty array when daily is missing', () => {
    expect(parseOpenMeteoResponse({ daily: undefined as never })).toEqual([]);
  });

  it('handles missing values gracefully (treats undefined as 0)', () => {
    const result = parseOpenMeteoResponse({
      daily: {
        time: ['2026-05-25'],
        temperature_2m_max: [],
        temperature_2m_min: [],
        weather_code: [],
        precipitation_probability_max: [],
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      high: 0,
      low: 0,
      condition: 'sunny',
      rainChance: 0,
    });
  });
});
