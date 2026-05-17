// Stable per-user bubble color. Deterministic hash of the user id → HSL hue;
// saturation and lightness fixed so the palette stays cohesive and readable
// against dark text. Returns { bubbleBg, ringBorder } so a bubble and its
// avatar ring share the same hue.

// FNV-1a + Murmur3 fmix32. FNV alone gives near-linear hash deltas for the
// dev test UUIDs that differ only in the last character, and mod 360 then
// collapses those to just two distinct hues. The fmix32 avalanche
// finalizer scrambles bits so trailing input differences produce
// well-distributed output hues.
function hashUserId(userId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface MessageColor {
  bubbleBg: string;
  bubbleBorder: string;
  ring: string;
}

export function messageColor(userId: string): MessageColor {
  const hue = hashUserId(userId) % 360;
  return {
    bubbleBg: `hsl(${hue} 70% 92%)`,
    bubbleBorder: `hsl(${hue} 60% 80%)`,
    ring: `hsl(${hue} 60% 65%)`,
  };
}
