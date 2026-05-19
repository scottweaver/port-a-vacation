import { describe, it, expect } from 'vitest';
import { groupPredictionsByDay } from './noaaTides';

describe('groupPredictionsByDay', () => {
  it('splits hi/lo by day and formats times to 12-hour', () => {
    const result = groupPredictionsByDay([
      { t: '2026-05-25 06:12', v: '1.234', type: 'H' },
      { t: '2026-05-25 13:08', v: '-0.234', type: 'L' },
      { t: '2026-05-25 19:42', v: '1.500', type: 'H' },
      { t: '2026-05-26 07:01', v: '1.300', type: 'H' },
      { t: '2026-05-26 13:54', v: '-0.100', type: 'L' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      highs: ['6:12 AM', '7:42 PM'],
      lows: ['1:08 PM'],
    });
    expect(result[0]!.date).toMatch(/^\w{3} \w{3} \d+$/);
    expect(result[1]).toMatchObject({
      highs: ['7:01 AM'],
      lows: ['1:54 PM'],
    });
  });

  it('returns sorted by date ASC even if input is out of order', () => {
    const result = groupPredictionsByDay([
      { t: '2026-05-27 06:00', v: '1.0', type: 'H' },
      { t: '2026-05-25 06:00', v: '1.0', type: 'H' },
      { t: '2026-05-26 06:00', v: '1.0', type: 'H' },
    ]);
    expect(result.map((r) => r.date)).toEqual([
      'Mon May 25',
      'Tue May 26',
      'Wed May 27',
    ]);
  });

  it('best time hint picks morning shelling for an AM low', () => {
    const result = groupPredictionsByDay([
      { t: '2026-05-25 06:12', v: '0.0', type: 'L' },
    ]);
    expect(result[0]!.best).toBe('Morning shelling near 6:12 AM');
  });

  it('best time hint picks afternoon shelling for a PM low', () => {
    const result = groupPredictionsByDay([
      { t: '2026-05-25 13:08', v: '0.0', type: 'L' },
    ]);
    expect(result[0]!.best).toBe('Afternoon shelling at 1:08 PM');
  });

  it('best time hint falls back to swim-at-high when no low is given', () => {
    const result = groupPredictionsByDay([
      { t: '2026-05-25 06:12', v: '1.0', type: 'H' },
    ]);
    expect(result[0]!.best).toBe('Swim near high tide at 6:12 AM');
  });

  it('best time hint is empty if no predictions at all (shouldn’t happen)', () => {
    expect(groupPredictionsByDay([])).toEqual([]);
  });

  it('skips malformed rows (missing t field)', () => {
    const result = groupPredictionsByDay([
      { t: '', v: '1.0', type: 'H' } as never,
      { t: '2026-05-25 06:00', v: '1.0', type: 'H' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('handles midnight / noon boundary correctly (12-hour formatting)', () => {
    const result = groupPredictionsByDay([
      { t: '2026-05-25 00:00', v: '1.0', type: 'L' },
      { t: '2026-05-25 12:00', v: '2.0', type: 'H' },
    ]);
    expect(result[0]!.lows).toEqual(['12:00 AM']);
    expect(result[0]!.highs).toEqual(['12:00 PM']);
  });
});
