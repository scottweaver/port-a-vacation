// Splits message text into plain-text and URL segments so the renderer can
// emit anchor tags for the URLs. Deliberately simple — only matches
// http(s):// schemes (covers what the family actually pastes) and strips
// trailing punctuation so "see https://example.com." doesn't grab the period.
//
// No HTML parsing, no XSS surface: the renderer puts each segment into JSX
// either as text or as <a href={url}>{url}</a>, which React safely escapes.

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const TRAILING_PUNCT = /[.,;:!?)\]}>]+$/;

export interface TextSegment {
  type: 'text' | 'link';
  value: string;
}

export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_RE)) {
    const idx = match.index;
    if (idx === undefined) continue;

    if (idx > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, idx) });
    }

    const raw = match[0];
    const trail = raw.match(TRAILING_PUNCT);
    if (trail) {
      const url = raw.slice(0, raw.length - trail[0].length);
      segments.push({ type: 'link', value: url });
      segments.push({ type: 'text', value: trail[0] });
    } else {
      segments.push({ type: 'link', value: raw });
    }

    lastIndex = idx + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}
