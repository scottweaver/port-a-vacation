// Write queue for offline-tolerant operation. Failed writes (network errors)
// are persisted to localStorage and retried on reconnect.
//
// The queue's core logic (enqueue, flush, retry, persistence) is decoupled
// from supabase via the Sender abstraction — pass any function that knows
// how to actually execute an op. In production, that's makeSupabaseSender.
// In tests, it's a fake. The core can therefore be unit-tested without
// touching the supabase client.

import type { Cache } from './cache';
import type { ChecklistItem, CondoInfoPatch, Contribution, HiddenItem, Meal, MealIngredient, MealSousChef, Message, PackingStatus, ShoppingListEntry, ThreadRead } from '@/types/db';

export type QueueOp =
  | { table: 'contributions'; op: 'upsert'; payload: Contribution }
  | { table: 'contributions'; op: 'delete'; key: { item_id: string; family_id: string } }
  | { table: 'contributions'; op: 'deleteByItem'; key: { item_id: string } }
  | { table: 'packing_status'; op: 'upsert'; payload: PackingStatus }
  | { table: 'packing_status'; op: 'delete'; key: { item_id: string; family_id: string } }
  | { table: 'hidden_items'; op: 'upsert'; payload: HiddenItem }
  | { table: 'hidden_items'; op: 'delete'; key: { item_id: string; family_id: string } }
  | { table: 'messages'; op: 'insert'; payload: Message }
  | { table: 'messages'; op: 'updateContent'; key: { id: string }; payload: { content: string } }
  | { table: 'messages'; op: 'delete'; key: { id: string } }
  | { table: 'thread_reads'; op: 'upsert'; payload: ThreadRead }
  | { table: 'checklist_items'; op: 'insert'; payload: ChecklistItem }
  | { table: 'checklist_items'; op: 'delete'; key: { id: string } }
  | { table: 'meals'; op: 'insert'; payload: Meal }
  | { table: 'meals'; op: 'update'; key: { id: string }; payload: Partial<Omit<Meal, 'id' | 'created_at' | 'updated_at' | 'created_by'>> }
  | { table: 'meals'; op: 'delete'; key: { id: string } }
  | { table: 'meal_sous_chefs'; op: 'insert'; payload: MealSousChef }
  | { table: 'meal_sous_chefs'; op: 'delete'; key: { meal_id: string; user_id: string } }
  | { table: 'meal_ingredients'; op: 'insert'; payload: MealIngredient }
  | { table: 'meal_ingredients'; op: 'delete'; key: { id: string } }
  | { table: 'condo_info'; op: 'update'; payload: CondoInfoPatch }
  | { table: 'shopping_list'; op: 'upsert'; payload: ShoppingListEntry }
  | { table: 'shopping_list'; op: 'updatePurchased'; key: { item_id: string; family_id: string }; payload: { purchased: boolean } }
  | { table: 'shopping_list'; op: 'delete'; key: { item_id: string; family_id: string } };

export interface QueueEntry {
  id: string;
  createdAt: string;
  attempts: number;
  op: QueueOp;
}

/** A function that knows how to send one op to the server. */
export type Sender = (op: QueueOp) => Promise<SendResult>;

export type SendResult =
  /** Server accepted the write — remove from queue. */
  | 'ok'
  /** Transient error (network, 5xx) — keep in queue, retry later. */
  | 'retry'
  /** Permanent error (RLS, constraint, unknown op) — log and drop. */
  | 'drop';

const QUEUE_KEY = 'write-queue';
const DEFAULT_MAX_ATTEMPTS = 5;

export class WriteQueue {
  private flushing = false;
  private listeners = new Set<() => void>();
  private maxAttempts: number;
  private genId: () => string;

  constructor(
    private cache: Cache,
    private sender: Sender,
    options: { maxAttempts?: number; genId?: () => string } = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.genId = options.genId ?? (() => crypto.randomUUID());
  }

  read(): QueueEntry[] {
    return this.cache.get<QueueEntry[]>(QUEUE_KEY) ?? [];
  }

  size(): number {
    return this.read().length;
  }

  enqueue(op: QueueOp): string {
    const entry: QueueEntry = {
      id: this.genId(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      op,
    };
    const entries = this.read();
    entries.push(entry);
    this.write(entries);
    return entry.id;
  }

  /**
   * Try to send each pending entry in FIFO order. Returns the number of
   * entries that successfully flushed.
   *
   * Reentrant-safe: a concurrent flush() call returns 0 immediately.
   */
  async flush(): Promise<number> {
    if (this.flushing) return 0;
    this.flushing = true;
    let flushed = 0;
    try {
      const entries = this.read();
      const next: QueueEntry[] = [];
      for (const entry of entries) {
        const result = await this.sender(entry.op);
        if (result === 'ok') {
          flushed++;
        } else if (result === 'drop') {
          console.warn('queue: dropping entry (permanent error)', entry);
        } else {
          const attempts = entry.attempts + 1;
          if (attempts < this.maxAttempts) {
            next.push({ ...entry, attempts });
          } else {
            console.warn('queue: max attempts exceeded, dropping', entry);
          }
        }
      }
      this.write(next);
    } finally {
      this.flushing = false;
    }
    return flushed;
  }

  /** Notify when the queue contents change (enqueue or flush). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Clear the queue. Use for sign-out or recovery. */
  clear(): void {
    this.write([]);
  }

  private write(entries: QueueEntry[]): void {
    this.cache.set(QUEUE_KEY, entries);
    for (const l of this.listeners) l();
  }
}

/**
 * Classify a Supabase error to decide whether to retry or drop.
 * - PostgREST RLS / constraint codes: permanent, drop.
 * - Auth errors: permanent (don't retry forever), drop.
 * - Anything else (including transient network errors): retry.
 */
export function classifyError(error: { code?: string; message?: string } | null | undefined): SendResult {
  if (!error) return 'ok';
  const code = error.code ?? '';
  // Postgres constraint violations (23xxx), insufficient privilege (42501), etc.
  if (/^23/.test(code)) return 'drop';
  if (/^42/.test(code)) return 'drop';
  // PostgREST specific permission/RLS codes
  if (code === 'PGRST301' || code === 'PGRST302') return 'drop';
  return 'retry';
}
