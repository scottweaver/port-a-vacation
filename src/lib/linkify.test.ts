import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('returns a single text segment for plain text', () => {
    expect(linkify('hello world')).toEqual([
      { type: 'text', value: 'hello world' },
    ]);
  });

  it('returns a single link segment for a bare URL', () => {
    expect(linkify('https://example.com')).toEqual([
      { type: 'link', value: 'https://example.com' },
    ]);
  });

  it('splits a URL inside surrounding text', () => {
    expect(linkify('see https://example.com here')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: ' here' },
    ]);
  });

  it('strips trailing punctuation from a URL', () => {
    expect(linkify('check https://example.com.')).toEqual([
      { type: 'text', value: 'check ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: '.' },
    ]);
  });

  it('strips multiple trailing punctuation chars', () => {
    expect(linkify('what about https://example.com?!')).toEqual([
      { type: 'text', value: 'what about ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: '?!' },
    ]);
  });

  it('handles two URLs in one string', () => {
    expect(linkify('https://a.com and https://b.com')).toEqual([
      { type: 'link', value: 'https://a.com' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'https://b.com' },
    ]);
  });

  it('handles http (not just https)', () => {
    expect(linkify('http://example.com')).toEqual([
      { type: 'link', value: 'http://example.com' },
    ]);
  });

  it('keeps deep paths and query strings intact', () => {
    expect(linkify('see https://example.com/path/to/thing?a=1&b=2 ok')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'https://example.com/path/to/thing?a=1&b=2' },
      { type: 'text', value: ' ok' },
    ]);
  });

  it('does not match URLs without an http(s) scheme', () => {
    expect(linkify('go to example.com')).toEqual([
      { type: 'text', value: 'go to example.com' },
    ]);
  });

  it('handles URL at start with surrounding paren', () => {
    expect(linkify('(see https://example.com)')).toEqual([
      { type: 'text', value: '(see ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: ')' },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(linkify('')).toEqual([]);
  });
});
