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

/** Mirrors `POST /accounts`: creates a new account. */
export async function addAccount(
  db: SQLiteDatabase,
  input: { name: string; type: AccountType; currency?: string }
): Promise<Account> {
  const currency = input.currency ?? 'IDR';
  const createdAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO accounts (name, type, currency, created_at, archived_at) VALUES (?, ?, ?, ?, ?)',
    input.name,
    input.type,
    currency,
    createdAt,
    null
  );
  const id = result.lastInsertRowId ? Number(result.lastInsertRowId) : null;
  if (id === null) {
    throw new Error('Failed to insert account');
  }
  const account = await getAccountById(db, id);
  if (!account) {
    throw new Error('Account not found after insert');
  }
  return account;
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

/**
 * Lists every account, including soft-deleted ones, ordered by name. Used where
 * historical data (for example old transactions) still references archived
 * accounts.
 */
export async function listAllAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>(
    `SELECT id, name, type, currency, created_at, archived_at
     FROM accounts
     ORDER BY name COLLATE NOCASE`
  );
}

/** Mirrors `DELETE /accounts/{accountId}` via soft delete: stamps `archived_at`. */
export async function archiveAccount(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    'UPDATE accounts SET archived_at = ? WHERE id = ?',
    new Date().toISOString(),
    id
  );
}
