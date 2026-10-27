import type { SQLiteDatabase } from 'expo-sqlite';

import type { Account, AccountType } from '@/types/api';

/** Mirrors `GET /accounts/{accountId}`. */
export async function getAccountById(db: SQLiteDatabase, id: number): Promise<Account | null> {
  return db.getFirstAsync<Account>(
    `SELECT id, name, type, currency, created_at, archived_at FROM accounts WHERE id = ?`,
    id
  );
}

/** Mirrors `PUT /accounts/{accountId}`. Replaces mutable fields. */
export async function updateAccount(
  db: SQLiteDatabase,
  id: number,
  input: { name: string; type: AccountType; currency: string }
): Promise<Account> {
  await db.runAsync(
    'UPDATE accounts SET name = ?, type = ?, currency = ? WHERE id = ?',
    input.name,
    input.type,
    input.currency,
    id
  );
  const updated = await getAccountById(db, id);
  if (!updated) {
    throw new Error('Account not found after update');
  }
  return updated;
}

/** Mirrors `GET /accounts`: active accounts only, ordered by name. */
export async function listAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>(
    `SELECT id, name, type, currency, created_at, archived_at
     FROM accounts
     WHERE archived_at IS NULL
     ORDER BY name COLLATE NOCASE`
  );
}
