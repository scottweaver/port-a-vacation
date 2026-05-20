import { describe, expect, it } from 'vitest';
import { cx, firstName } from './format';

describe('cx', () => {
  it('joins truthy parts with spaces', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('drops false / null / undefined', () => {
    expect(cx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('handles empty input', () => {
    expect(cx()).toBe('');
  });
});

describe('firstName', () => {
  it('returns the first word of a display name', () => {
    expect(firstName('Test User')).toBe('Test');
  });

  it('falls back to the email local-part when no display name', () => {
    expect(firstName(null, 'test.user@example.com')).toBe('test.user');
  });

  it("returns 'Someone' when both are missing", () => {
    expect(firstName(null, null)).toBe('Someone');
  });

  it('skips a blank display name and falls back to email', () => {
    expect(firstName('   ', 'a@b.com')).toBe('a');
  });
});
