import type { SQLiteDatabase } from 'expo-sqlite';

/** File name of the on-device database, relative to Expo's database directory. */
export const DATABASE_NAME = 'perduitan.db';

/** Bump this and add a matching block in `migrateDbIfNeeded` for every change. */
const DATABASE_VERSION = 1;

/**
 * Creates the schema and seeds the starter accounts/categories on first launch.
 * Passed to `SQLiteProvider`, which runs it once before rendering the app.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'cash', 'investment')),
          currency TEXT NOT NULL DEFAULT 'IDR' CHECK (length(currency) = 3),
          created_at TEXT NOT NULL,
          archived_at TEXT
        );

        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
          created_at TEXT NOT NULL
        );

        CREATE TABLE transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
          category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
          amount_cents INTEGER NOT NULL,
          description TEXT,
          occurred_on TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX transactions_account_date
          ON transactions (account_id, occurred_on DESC);
      `);

      // Record the version inside the transaction so a half-applied migration
      // can never be mistaken for a complete one.
      await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });

    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

