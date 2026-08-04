// offline_queue.ts
// Manages a local SQLite queue of pending requests for offline‑first synchronization.
// Uses the Tauri `@tauri-apps/plugin-sql` plugin (SQLite with optional SQLCipher).

import { Database } from '@tauri-apps/plugin-sql';

export type PendingRequest = {
  id: string; // UUID
  type: string; // e.g., "new_form", "profile_edit"
  payload: string; // JSON string of request data
  created_at: string; // ISO timestamp
  status: 'queued' | 'sent' | 'failed';
};

const DB_PATH = 'sqlite:offline_queue.db'; // Stored in the Tauri app data directory

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_PATH);
    const db = await dbPromise;
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pending_requests (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued','sent','failed'))
      );
    `);
  }
  return dbPromise;
}

/** Add a new request to the queue */
export async function enqueueRequest(type: string, payload: object): Promise<void> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  await db.execute(
    `INSERT INTO pending_requests (id, type, payload, created_at, status) VALUES (?, ?, ?, ?, 'queued')`,
    [id, type, JSON.stringify(payload), created_at]
  );
}

/** Retrieve all queued requests */
export async function getQueuedRequests(): Promise<PendingRequest[]> {
  const db = await getDb();
  const rows = await db.select<PendingRequest[]>(
    `SELECT * FROM pending_requests WHERE status = 'queued' ORDER BY created_at ASC`
  );
  return rows;
}

/** Mark a request as sent or failed */
export async function updateRequestStatus(id: string, status: 'sent' | 'failed'): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE pending_requests SET status = ? WHERE id = ?`, [status, id]);
}

/** Purge processed requests (optional cleanup) */
export async function purgeProcessed(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM pending_requests WHERE status != 'queued'`);
}

export const OfflineQueue = {
  enqueueRequest,
  getQueuedRequests,
  updateRequestStatus,
  purgeProcessed,
};
