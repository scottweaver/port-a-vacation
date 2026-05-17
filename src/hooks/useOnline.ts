import { useEffect, useState } from 'react';
import { isOnline, subscribeOnlineState } from '@/lib/online';
import { writeQueue } from '@/lib/supabase';

/** Tracks the browser's online/offline status. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => subscribeOnlineState(() => setOnline(isOnline())), []);
  return online;
}

/** Tracks how many ops are waiting in the write queue. */
export function useQueueSize(): number {
  const [size, setSize] = useState(() => writeQueue.size());
  useEffect(() => writeQueue.subscribe(() => setSize(writeQueue.size())), []);
  return size;
}
