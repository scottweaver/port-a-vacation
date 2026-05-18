// Production Sender for the write queue — knows how to actually execute each
// op against Supabase. Kept in its own file (not queue.ts) so the queue core
// can be unit-tested without mocking the supabase client.

import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyError, type QueueOp, type Sender, type SendResult } from './queue';

export function makeSupabaseSender(client: SupabaseClient): Sender {
  return async (op: QueueOp): Promise<SendResult> => {
    try {
      const error = await execute(client, op);
      return classifyError(error);
    } catch (e) {
      // Fetch threw — almost always means we're offline. Retry on reconnect.
      if (isNetworkError(e)) return 'retry';
      console.warn('queueSender: send threw unexpectedly', e);
      return 'retry';
    }
  };
}

async function execute(
  client: SupabaseClient,
  op: QueueOp,
): Promise<{ code?: string; message?: string } | null> {
  if (op.table === 'contributions' && op.op === 'upsert') {
    const { error } = await client
      .from('contributions')
      .upsert(op.payload, { onConflict: 'item_id,family_id' });
    return error;
  }
  if (op.table === 'contributions' && op.op === 'delete') {
    const { error } = await client
      .from('contributions')
      .delete()
      .eq('item_id', op.key.item_id)
      .eq('family_id', op.key.family_id);
    return error;
  }
  if (op.table === 'contributions' && op.op === 'deleteByItem') {
    const { error } = await client
      .from('contributions')
      .delete()
      .eq('item_id', op.key.item_id);
    return error;
  }
  if (op.table === 'packing_status' && op.op === 'upsert') {
    const { error } = await client
      .from('packing_status')
      .upsert(op.payload, { onConflict: 'item_id,family_id', ignoreDuplicates: true });
    return error;
  }
  if (op.table === 'packing_status' && op.op === 'delete') {
    const { error } = await client
      .from('packing_status')
      .delete()
      .eq('item_id', op.key.item_id)
      .eq('family_id', op.key.family_id);
    return error;
  }
  if (op.table === 'hidden_items' && op.op === 'upsert') {
    const { error } = await client
      .from('hidden_items')
      .upsert(op.payload, { onConflict: 'item_id,family_id', ignoreDuplicates: true });
    return error;
  }
  if (op.table === 'hidden_items' && op.op === 'delete') {
    const { error } = await client
      .from('hidden_items')
      .delete()
      .eq('item_id', op.key.item_id)
      .eq('family_id', op.key.family_id);
    return error;
  }
  if (op.table === 'messages' && op.op === 'insert') {
    const { error } = await client
      .from('messages')
      .insert(op.payload);
    return error;
  }
  if (op.table === 'messages' && op.op === 'updateContent') {
    const { error } = await client
      .from('messages')
      .update({ content: op.payload.content })
      .eq('id', op.key.id);
    return error;
  }
  if (op.table === 'messages' && op.op === 'delete') {
    const { error } = await client
      .from('messages')
      .delete()
      .eq('id', op.key.id);
    return error;
  }
  if (op.table === 'thread_reads' && op.op === 'upsert') {
    const { error } = await client
      .from('thread_reads')
      .upsert(op.payload, { onConflict: 'item_id,user_id' });
    return error;
  }
  if (op.table === 'checklist_items' && op.op === 'insert') {
    const { error } = await client
      .from('checklist_items')
      .insert(op.payload);
    return error;
  }
  if (op.table === 'checklist_items' && op.op === 'delete') {
    const { error } = await client
      .from('checklist_items')
      .delete()
      .eq('id', op.key.id);
    return error;
  }
  if (op.table === 'meals' && op.op === 'insert') {
    const { error } = await client.from('meals').insert(op.payload);
    return error;
  }
  if (op.table === 'meals' && op.op === 'update') {
    const { error } = await client
      .from('meals')
      .update(op.payload)
      .eq('id', op.key.id);
    return error;
  }
  if (op.table === 'meals' && op.op === 'delete') {
    const { error } = await client.from('meals').delete().eq('id', op.key.id);
    return error;
  }
  if (op.table === 'meal_sous_chefs' && op.op === 'insert') {
    const { error } = await client.from('meal_sous_chefs').insert(op.payload);
    return error;
  }
  if (op.table === 'meal_sous_chefs' && op.op === 'delete') {
    const { error } = await client
      .from('meal_sous_chefs')
      .delete()
      .eq('meal_id', op.key.meal_id)
      .eq('user_id', op.key.user_id);
    return error;
  }
  // Should be unreachable given the exhaustive QueueOp union.
  return { code: 'UNKNOWN_OP', message: 'unknown op' };
}

function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /fetch|network|load failed/i.test(e.message);
}
