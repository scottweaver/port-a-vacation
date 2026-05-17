import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const TYPING_THROTTLE_MS = 1000; // most frequent "I'm typing" broadcast
const STALE_AFTER_MS = 4000;     // drop a typer if no refresh for this long
const PRUNE_INTERVAL_MS = 1000;

/**
 * Per-item typing indicator powered by Supabase Realtime *broadcast* channels.
 * No DB writes — broadcast messages are ephemeral, exactly the right tool
 * for a typing indicator.
 *
 * Each modal open joins a channel named `typing:{itemId}`. notifyTyping()
 * sends a throttled "I'm still typing" event with the user id; receivers
 * track per-user last-seen timestamps and prune stale entries every second.
 * notifyStop() broadcasts an immediate "I stopped" so others don't keep
 * seeing the indicator for the timeout window after a send.
 */
export function useTypingIndicator(itemId: string, currentUserId: string) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const lastSentRef = useRef(0);
  const lastSeen = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setTypingUsers(new Set());
    lastSeen.current.clear();
    lastSentRef.current = 0;
    subscribedRef.current = false;

    const channel = supabase.channel(`typing:${itemId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const userId = (payload as { userId?: string })?.userId;
      if (!userId || userId === currentUserId) return;
      lastSeen.current.set(userId, Date.now());
      setTypingUsers((prev) => {
        if (prev.has(userId)) return prev;
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    });

    channel.on('broadcast', { event: 'stop' }, ({ payload }) => {
      const userId = (payload as { userId?: string })?.userId;
      if (!userId || userId === currentUserId) return;
      lastSeen.current.delete(userId);
      setTypingUsers((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') subscribedRef.current = true;
    });
    channelRef.current = channel;

    const prune = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [uid, ts] of lastSeen.current) {
        if (now - ts > STALE_AFTER_MS) {
          lastSeen.current.delete(uid);
          changed = true;
        }
      }
      if (changed) setTypingUsers(new Set(lastSeen.current.keys()));
    }, PRUNE_INTERVAL_MS);

    return () => {
      clearInterval(prune);
      subscribedRef.current = false;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [itemId, currentUserId]);

  const notifyTyping = useCallback(() => {
    if (!subscribedRef.current || !channelRef.current) return;
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
    lastSentRef.current = now;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId },
    }).catch(() => { /* fire-and-forget — typing isn't critical */ });
  }, [currentUserId]);

  const notifyStop = useCallback(() => {
    if (!subscribedRef.current || !channelRef.current) return;
    lastSentRef.current = 0;
    channelRef.current.send({
      type: 'broadcast',
      event: 'stop',
      payload: { userId: currentUserId },
    }).catch(() => { /* ignore */ });
  }, [currentUserId]);

  return { typingUsers, notifyTyping, notifyStop };
}
