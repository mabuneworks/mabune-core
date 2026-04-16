import type { SupabaseClient } from '@supabase/supabase-js';

const DB_NAME = 'mabune-offline-v1';
const DB_VERSION = 1;

export type QueueInsert = { kind: 'insert'; row: Record<string, unknown> };
export type QueueUpdate = { kind: 'update'; patientId: string; payload: Record<string, unknown> };
export type QueueDelete = { kind: 'delete'; patientId: string };
export type QueueOp = QueueInsert | QueueUpdate | QueueDelete;
export type QueuedOp = QueueOp & { qid: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { autoIncrement: true });
      }
    };
  });
}

export async function readPatientRowsCache(): Promise<unknown[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly');
      const req = tx.objectStore('cache').get('patients');
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error ?? new Error('cache read failed'));
    });
  } catch {
    return [];
  }
}

export async function writePatientRowsCache(rows: unknown[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put(rows, 'patients');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('cache write failed'));
    });
  } catch {
    /* ignore */
  }
}

export async function readAllQueue(): Promise<QueuedOp[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const out: QueuedOp[] = [];
    const tx = db.transaction('queue', 'readonly');
    const cur = tx.objectStore('queue').openCursor();
    cur.onerror = () => reject(cur.error ?? new Error('queue read failed'));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        const value = c.value as QueueOp;
        out.push({ ...value, qid: c.key as number });
        c.continue();
      } else {
        resolve(out);
      }
    };
  });
}

export async function addQueueOp(op: QueueOp): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('queue add failed'));
  });
}

export async function removeQueueOp(qid: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(qid);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('queue delete failed'));
  });
}

export async function getQueueLength(): Promise<number> {
  const ops = await readAllQueue();
  return ops.length;
}

function isDuplicateKeyError(error: { message?: string; code?: string }): boolean {
  const m = (error.message ?? '').toLowerCase();
  return error.code === '23505' || m.includes('duplicate key') || m.includes('unique constraint');
}

async function mutateWithColumnRetry(
  client: SupabaseClient,
  run: (payload: Record<string, unknown>) => PromiseLike<{ error: { message: string; code?: string } | null }>,
  initialPayload: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const mutablePayload: Record<string, unknown> = { ...initialPayload };
  let { error } = await Promise.resolve(run(mutablePayload));
  let retryCount = 0;
  while (error && retryCount < 12) {
    const match = error.message.match(/Could not find the '([^']+)' column/);
    if (!match) break;
    const missingColumn = match[1];
    if (!(missingColumn in mutablePayload)) break;
    delete mutablePayload[missingColumn];
    ({ error } = await Promise.resolve(run(mutablePayload)));
    retryCount += 1;
  }
  return { error };
}

/**
 * キューを順にサーバーへ送り、最後に patient 全件を取得する。
 */
export async function flushSyncQueue(
  client: SupabaseClient,
): Promise<{ pulledRows: unknown[] | null; error?: string }> {
  const ops = await readAllQueue();
  for (const op of ops) {
    if (op.kind === 'insert') {
      const row = { ...op.row };
      const { error } = await mutateWithColumnRetry(client, async (payload) => {
        const r = await client.from('patient').insert([payload]);
        return { error: r.error };
      }, row);
      if (error && !isDuplicateKeyError(error)) {
        return { pulledRows: null, error: error.message };
      }
    } else if (op.kind === 'update') {
      const { error } = await mutateWithColumnRetry(
        client,
        async (payload) => {
          const r = await client.from('patient').update(payload).eq('id', op.patientId);
          return { error: r.error };
        },
        { ...op.payload },
      );
      if (error) {
        return { pulledRows: null, error: error.message };
      }
    } else if (op.kind === 'delete') {
      const { error } = await client.from('patient').delete().eq('id', op.patientId);
      if (error) {
        return { pulledRows: null, error: error.message };
      }
    }
    await removeQueueOp(op.qid);
  }

  const { data, error: pullError } = await client.from('patient').select('*');
  if (pullError) {
    return { pulledRows: null, error: pullError.message };
  }
  return { pulledRows: data ?? [] };
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}
