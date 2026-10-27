import type { SQLiteDatabase } from 'expo-sqlite';

import type { TransactionCreate } from '@/types/api';

/** Returns the account_id of the most recent transaction, or null if none exist. */
export async function getLastUsedAccountId(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ account_id: number }>(
    'SELECT account_id FROM transactions ORDER BY created_at DESC, id DESC LIMIT 1'
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

/** Lists transactions with account and category names, ordered newest first. */
export async function listTransactions(db: SQLiteDatabase): Promise<{
  id: number;
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  amount_cents: number;
  description: string | null;
  occurred_on: string;
  created_at: string;
}[]> {
  return db.getAllAsync(
    `SELECT t.id, t.account_id, a.name AS account_name, t.category_id, c.name AS category_name, t.amount_cents, t.description, t.occurred_on, t.created_at
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     ORDER BY t.created_at DESC, t.id DESC`
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
