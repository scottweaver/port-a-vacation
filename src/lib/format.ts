export function relativeTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

export function firstName(displayName: string | null | undefined, email?: string | null): string {
  if (displayName && displayName.trim()) {
    const first = displayName.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (email) return email.split('@')[0] ?? email;
  return 'Someone';
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}


