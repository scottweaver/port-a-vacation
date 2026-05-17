import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, writeQueue } from '@/lib/supabase';
import { cache } from '@/lib/cache';
import { subscribeReconnect } from '@/lib/online';
import type { Message, MessageMeta, ThreadRead } from '@/types/db';

interface State {
  /** Lightweight per-message metadata for every message in the database.
   *  Sufficient to drive per-item unread counts and the chat-icon badge
   *  without pulling content. */
  metadata: MessageMeta[];
  /** Full messages keyed by item_id, populated lazily when a modal opens. */
  threads: Map<string, Message[]>;
  /** My last-opened time per thread. Absent = never read. */
  threadReads: Map<string, string>;
  loading: boolean;
  error: string | null;
}

const META_CACHE_KEY = 'messages-meta';
const threadReadsCacheKey = (userId: string) => `thread-reads:${userId}`;

function stripContent(m: Message): MessageMeta {
  return {
    id: m.id,
    item_id: m.item_id,
    author_id: m.author_id,
    created_at: m.created_at,
    edited_at: m.edited_at,
  };
}

function hydrate(userId: string | null): State {
  const cachedMeta = cache.get<MessageMeta[]>(META_CACHE_KEY) ?? [];
  const cachedReads = userId ? cache.get<Array<[string, string]>>(threadReadsCacheKey(userId)) : null;
  return {
    metadata: cachedMeta,
    threads: new Map(),
    threadReads: new Map(cachedReads ?? []),
    loading: cachedMeta.length === 0 && !cachedReads,
    error: null,
  };
}

export function useConversations(currentUserId: string | null) {
  const [state, setState] = useState<State>(() => hydrate(currentUserId));

  useEffect(() => {
    if (state.loading) return;
    cache.set(META_CACHE_KEY, state.metadata);
  }, [state.metadata, state.loading]);

  useEffect(() => {
    if (state.loading || !currentUserId) return;
    cache.set(threadReadsCacheKey(currentUserId), [...state.threadReads.entries()]);
  }, [state.threadReads, state.loading, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setState({ metadata: [], threads: new Map(), threadReads: new Map(), loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function loadAll() {
      const [metaRes, readsRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, item_id, author_id, created_at, edited_at')
          .order('created_at'),
        supabase.from('thread_reads').select('*').eq('user_id', currentUserId),
      ]);
      if (cancelled) return;
      if (metaRes.error || readsRes.error) {
        setState((s) => ({
          ...s,
          loading: false,
          error: metaRes.error?.message ?? readsRes.error?.message ?? 'Failed to load',
        }));
        return;
      }
      const metadata = (metaRes.data ?? []) as MessageMeta[];
      const threadReads = new Map<string, string>();
      for (const r of (readsRes.data ?? []) as ThreadRead[]) {
        threadReads.set(r.item_id, r.last_read_at);
      }
      setState((s) => ({ ...s, metadata, threadReads, loading: false, error: null }));
    }

    loadAll();
    const unsubReconnect = subscribeReconnect(() => { void loadAll(); });

    const channel = supabase
      .channel('messages-and-thread-reads')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const metadata = [...s.metadata];
            const threads = new Map(s.threads);

            if (payload.eventType === 'INSERT') {
              const row = payload.new as Message;
              if (!metadata.some((m) => m.id === row.id)) {
                metadata.push(stripContent(row));
                metadata.sort((a, b) => a.created_at.localeCompare(b.created_at));
              }
              const thread = threads.get(row.item_id);
              if (thread && !thread.some((m) => m.id === row.id)) {
                const next = [...thread, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
                threads.set(row.item_id, next);
              }
            } else if (payload.eventType === 'UPDATE') {
              const row = payload.new as Message;
              const idx = metadata.findIndex((m) => m.id === row.id);
              if (idx >= 0) metadata[idx] = stripContent(row);
              const thread = threads.get(row.item_id);
              if (thread) {
                const tidx = thread.findIndex((m) => m.id === row.id);
                if (tidx >= 0) {
                  const next = [...thread];
                  next[tidx] = row;
                  threads.set(row.item_id, next);
                }
              }
            } else if (payload.eventType === 'DELETE') {
              const old = payload.old as Partial<Message>;
              if (!old.id) return s;
              const newMeta = metadata.filter((m) => m.id !== old.id);
              // payload.old only includes the PK under REPLICA IDENTITY DEFAULT,
              // so we scan loaded threads instead of indexing by item_id.
              for (const [iid, thread] of threads) {
                if (thread.some((m) => m.id === old.id)) {
                  threads.set(iid, thread.filter((m) => m.id !== old.id));
                }
              }
              return { ...s, metadata: newMeta, threads };
            }
            return { ...s, metadata, threads };
          });
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'thread_reads', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          if (cancelled) return;
          setState((s) => {
            const threadReads = new Map(s.threadReads);
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Partial<ThreadRead>;
              if (old.item_id) threadReads.delete(old.item_id);
            } else {
              const row = payload.new as ThreadRead;
              threadReads.set(row.item_id, row.last_read_at);
            }
            return { ...s, threadReads };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      unsubReconnect();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  /** Fetch full message content for an item the first time its modal opens.
   *  Idempotent — calling again refetches and replaces the loaded thread. */
  const loadThread = useCallback(async (itemId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at');
    if (error) {
      console.warn('useConversations: loadThread failed', error);
      return;
    }
    const messages = (data ?? []) as Message[];
    setState((s) => {
      const threads = new Map(s.threads);
      threads.set(itemId, messages);
      return { ...s, threads };
    });
  }, []);

  const messageCountByItem = useMemo(() => {
    const result = new Map<string, number>();
    for (const m of state.metadata) {
      result.set(m.item_id, (result.get(m.item_id) ?? 0) + 1);
    }
    return result;
  }, [state.metadata]);

  const unreadByItem = useMemo(() => {
    const result = new Map<string, number>();
    if (!currentUserId) return result;
    for (const m of state.metadata) {
      if (m.author_id === currentUserId) continue;
      const lastRead = state.threadReads.get(m.item_id);
      if (!lastRead || m.created_at > lastRead) {
        result.set(m.item_id, (result.get(m.item_id) ?? 0) + 1);
      }
    }
    return result;
  }, [state.metadata, state.threadReads, currentUserId]);

  const postMessage = useCallback((itemId: string, content: string) => {
    if (!currentUserId) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: Message = {
      id,
      item_id: itemId,
      author_id: currentUserId,
      content: trimmed,
      created_at: createdAt,
      edited_at: null,
    };
    setState((s) => {
      const metadata = [...s.metadata, stripContent(optimistic)];
      const threads = new Map(s.threads);
      if (threads.has(itemId)) {
        threads.set(itemId, [...(threads.get(itemId) ?? []), optimistic]);
      }
      return { ...s, metadata, threads };
    });
    writeQueue.enqueue({ table: 'messages', op: 'insert', payload: optimistic });
    void writeQueue.flush();
  }, [currentUserId]);

  const editMessage = useCallback((messageId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const nowIso = new Date().toISOString();
    setState((s) => {
      const metadata = s.metadata.map((m) => m.id === messageId ? { ...m, edited_at: nowIso } : m);
      const threads = new Map(s.threads);
      for (const [iid, thread] of threads) {
        const idx = thread.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          const next = [...thread];
          next[idx] = { ...next[idx]!, content: trimmed, edited_at: nowIso };
          threads.set(iid, next);
        }
      }
      return { ...s, metadata, threads };
    });
    writeQueue.enqueue({
      table: 'messages',
      op: 'updateContent',
      key: { id: messageId },
      payload: { content: trimmed },
    });
    void writeQueue.flush();
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setState((s) => {
      const metadata = s.metadata.filter((m) => m.id !== messageId);
      const threads = new Map(s.threads);
      for (const [iid, thread] of threads) {
        if (thread.some((m) => m.id === messageId)) {
          threads.set(iid, thread.filter((m) => m.id !== messageId));
        }
      }
      return { ...s, metadata, threads };
    });
    writeQueue.enqueue({ table: 'messages', op: 'delete', key: { id: messageId } });
    void writeQueue.flush();
  }, []);

  const markRead = useCallback((itemId: string) => {
    if (!currentUserId) return;
    const nowIso = new Date().toISOString();
    setState((s) => {
      const threadReads = new Map(s.threadReads);
      threadReads.set(itemId, nowIso);
      return { ...s, threadReads };
    });
    writeQueue.enqueue({
      table: 'thread_reads',
      op: 'upsert',
      payload: { item_id: itemId, user_id: currentUserId, last_read_at: nowIso },
    });
    void writeQueue.flush();
  }, [currentUserId]);

  return {
    threads: state.threads,
    messageCountByItem,
    unreadByItem,
    loading: state.loading,
    error: state.error,
    loadThread,
    postMessage,
    editMessage,
    deleteMessage,
    markRead,
  };
}
