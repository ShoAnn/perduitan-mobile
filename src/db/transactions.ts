import type { SQLiteDatabase } from 'expo-sqlite';

import type { TransactionCreate } from '@/types/api';

/**
 * Returns the account_id of the most recent transaction on an active account,
 * or null if none exist. Archived (deleted) accounts are skipped so callers
 * never point at an account that is no longer available.
 */
export async function getLastUsedAccountId(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ account_id: number }>(
    `SELECT t.account_id
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.archived_at IS NULL
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 1`
  );
  return row?.account_id ?? null;
}

/** Sum of `amount_cents` for a given account. */
export async function getAccountBalance(db: SQLiteDatabase, accountId: number): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE account_id = ?',
    accountId
  );
  return row?.total ?? 0;
}

/** A transaction joined with its account and category names. */
export type TransactionWithNames = {
  id: number;
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  amount_cents: number;
  description: string | null;
  occurred_on: string;
  created_at: string;
};

/** Lists transactions with account and category names, ordered by day (newest first). */
export async function listTransactions(db: SQLiteDatabase): Promise<TransactionWithNames[]> {
  return db.getAllAsync<TransactionWithNames>(
    `SELECT t.id, t.account_id, a.name AS account_name, t.category_id, c.name AS category_name, t.amount_cents, t.description, t.occurred_on, t.created_at
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     ORDER BY t.occurred_on DESC, t.created_at DESC, t.id DESC`
  );
}

/** Returns a single transaction with account and category names, or null when missing. */
export async function getTransactionById(
  db: SQLiteDatabase,
  id: number
): Promise<TransactionWithNames | null> {
  return db.getFirstAsync<TransactionWithNames>(
    `SELECT t.id, t.account_id, a.name AS account_name, t.category_id, c.name AS category_name, t.amount_cents, t.description, t.occurred_on, t.created_at
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id = ?`,
    id
  );
}

/** Mirrors `POST /transactions`. Returns the new transaction's id. */
export async function insertTransaction(
  db: SQLiteDatabase,
  input: TransactionCreate
): Promise<number> {
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO transactions
       (account_id, category_id, amount_cents, description, occurred_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.account_id,
    input.category_id ?? null,
    input.amount_cents,
    input.description ?? null,
    input.occurred_on,
    now,
    now
  );

  return result.lastInsertRowId;
}
