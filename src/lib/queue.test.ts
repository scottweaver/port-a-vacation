import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache } from './cache';
import { WriteQueue, classifyError, type QueueOp, type SendResult, type Sender } from './queue';

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string) { return store.has(key) ? (store.get(key) ?? null) : null; },
    setItem(key: string, value: string) { store.set(key, value); },
    removeItem(key: string) { store.delete(key); },
  };
}

function makeSender(handler: (op: QueueOp) => SendResult | Promise<SendResult>): Sender {
  return async (op) => handler(op);
}

function makeQueue(sender: Sender, maxAttempts = 5) {
  const storage = memoryStorage();
  const cache = new Cache(storage);
  let counter = 0;
  const queue = new WriteQueue(cache, sender, {
    maxAttempts,
    genId: () => `id-${++counter}`,
  });
  return { queue, cache, storage };
}

const sampleOp: QueueOp = {
  table: 'contributions',
  op: 'upsert',
  payload: {
    item_id: 'i1',
    family_id: 'f1',
    quantity: 3,
    done: true,
    updated_by: 'u1',
    updated_at: '2026-05-17T00:00:00Z',
  },
};

describe('WriteQueue', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('enqueue', () => {
    it('adds an entry with id, createdAt, attempts=0', () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      const id = queue.enqueue(sampleOp);
      const entries = queue.read();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.id).toBe(id);
      expect(entries[0]?.attempts).toBe(0);
      expect(entries[0]?.op).toEqual(sampleOp);
      expect(typeof entries[0]?.createdAt).toBe('string');
    });

    it('persists entries to the cache (survives queue instance)', () => {
      const { queue, cache } = makeQueue(makeSender(() => 'ok'));
      queue.enqueue(sampleOp);
      // Build a second queue against the same cache — entries should be there.
      const queue2 = new WriteQueue(cache, makeSender(() => 'ok'));
      expect(queue2.read()).toHaveLength(1);
    });

    it('preserves FIFO order', () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      queue.enqueue(sampleOp);
      queue.enqueue({ table: 'packing_status', op: 'delete', key: { item_id: 'i2', family_id: 'f1' } });
      const ops = queue.read().map((e) => e.op.table);
      expect(ops).toEqual(['contributions', 'packing_status']);
    });

    it('notifies subscribers', () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      const listener = vi.fn();
      queue.subscribe(listener);
      queue.enqueue(sampleOp);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('removes entries the sender returns ok for', async () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      queue.enqueue(sampleOp);
      queue.enqueue(sampleOp);
      const flushed = await queue.flush();
      expect(flushed).toBe(2);
      expect(queue.read()).toHaveLength(0);
    });

    it('keeps entries the sender returns retry for, with attempts incremented', async () => {
      const { queue } = makeQueue(makeSender(() => 'retry'));
      queue.enqueue(sampleOp);
      const flushed = await queue.flush();
      expect(flushed).toBe(0);
      const entries = queue.read();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.attempts).toBe(1);
    });

    it('drops entries the sender returns drop for, without retry', async () => {
      const { queue } = makeQueue(makeSender(() => 'drop'));
      queue.enqueue(sampleOp);
      await queue.flush();
      expect(queue.read()).toHaveLength(0);
      expect(warn).toHaveBeenCalled();
    });

    it('drops entries that exceed maxAttempts', async () => {
      const { queue } = makeQueue(makeSender(() => 'retry'), 3);
      queue.enqueue(sampleOp);
      // attempts: 0 -> 1 -> 2 -> 3 (drop on 3rd flush since max is 3)
      await queue.flush(); // attempts=1
      expect(queue.read()[0]?.attempts).toBe(1);
      await queue.flush(); // attempts=2
      expect(queue.read()[0]?.attempts).toBe(2);
      await queue.flush(); // attempts=3, drop
      expect(queue.read()).toHaveLength(0);
    });

    it('flushes entries in FIFO order', async () => {
      const calls: QueueOp[] = [];
      const sender: Sender = async (op) => {
        calls.push(op);
        return 'ok';
      };
      const { queue } = makeQueue(sender);
      const op1: QueueOp = { ...sampleOp, payload: { ...sampleOp.payload, item_id: 'first' } as never };
      const op2: QueueOp = { ...sampleOp, payload: { ...sampleOp.payload, item_id: 'second' } as never };
      queue.enqueue(op1);
      queue.enqueue(op2);
      await queue.flush();
      expect((calls[0] as { payload: { item_id: string } }).payload.item_id).toBe('first');
      expect((calls[1] as { payload: { item_id: string } }).payload.item_id).toBe('second');
    });

    it('mixed result: ok flushed, retry kept, drop discarded', async () => {
      const sender: Sender = async (op) => {
        const itemId = (op as { payload?: { item_id?: string }; key?: { item_id?: string } }).payload?.item_id
          ?? (op as { key?: { item_id?: string } }).key?.item_id;
        if (itemId === 'ok') return 'ok';
        if (itemId === 'retry') return 'retry';
        return 'drop';
      };
      const { queue } = makeQueue(sender);
      queue.enqueue({ ...sampleOp, payload: { ...sampleOp.payload, item_id: 'ok' } } as QueueOp);
      queue.enqueue({ ...sampleOp, payload: { ...sampleOp.payload, item_id: 'retry' } } as QueueOp);
      queue.enqueue({ ...sampleOp, payload: { ...sampleOp.payload, item_id: 'drop' } } as QueueOp);
      const flushed = await queue.flush();
      expect(flushed).toBe(1);
      const remaining = queue.read();
      expect(remaining).toHaveLength(1);
      const remainingOp = remaining[0]?.op as Extract<QueueOp, { op: 'upsert' }>;
      expect(remainingOp.payload.item_id).toBe('retry');
    });

    it('returns 0 and does nothing if a concurrent flush is in progress', async () => {
      let resolve!: () => void;
      const sender: Sender = () => new Promise<SendResult>((r) => {
        resolve = () => r('ok');
      });
      const { queue } = makeQueue(sender);
      queue.enqueue(sampleOp);

      const first = queue.flush();
      const second = queue.flush();
      expect(await second).toBe(0); // second returns immediately
      resolve();
      expect(await first).toBe(1);
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      const listener = vi.fn();
      const off = queue.subscribe(listener);
      queue.enqueue(sampleOp);
      expect(listener).toHaveBeenCalledTimes(1);
      off();
      queue.enqueue(sampleOp);
      expect(listener).toHaveBeenCalledTimes(1); // not called again
    });

    it('fires after flush mutates the queue', async () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      queue.enqueue(sampleOp);
      const listener = vi.fn();
      queue.subscribe(listener);
      await queue.flush();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('size + clear', () => {
    it('size reflects pending entries', () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      expect(queue.size()).toBe(0);
      queue.enqueue(sampleOp);
      queue.enqueue(sampleOp);
      expect(queue.size()).toBe(2);
    });

    it('clear empties the queue', () => {
      const { queue } = makeQueue(makeSender(() => 'ok'));
      queue.enqueue(sampleOp);
      queue.clear();
      expect(queue.size()).toBe(0);
    });
  });
});

describe('classifyError', () => {
  it("returns 'ok' for no error", () => {
    expect(classifyError(null)).toBe('ok');
    expect(classifyError(undefined)).toBe('ok');
  });

  it("drops on Postgres constraint codes (23xxx)", () => {
    expect(classifyError({ code: '23505', message: 'duplicate' })).toBe('drop');
    expect(classifyError({ code: '23503', message: 'fkey' })).toBe('drop');
  });

  it("drops on permission codes (42xxx)", () => {
    expect(classifyError({ code: '42501', message: 'insufficient privilege' })).toBe('drop');
  });

  it("drops on PostgREST RLS codes", () => {
    expect(classifyError({ code: 'PGRST301', message: 'forbidden' })).toBe('drop');
    expect(classifyError({ code: 'PGRST302', message: 'unauth' })).toBe('drop');
  });

  it("retries unknown / transient errors", () => {
    expect(classifyError({ code: 'NETWORK', message: 'Failed to fetch' })).toBe('retry');
    expect(classifyError({ message: 'something else' })).toBe('retry');
    expect(classifyError({})).toBe('retry');
  });
});
