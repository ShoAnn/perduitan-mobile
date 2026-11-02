import type { SQLiteDatabase } from 'expo-sqlite';

/** File name of the on-device database, relative to Expo's database directory. */
export const DATABASE_NAME = 'perduitan.db';

/** Bump this and add a matching block in `migrateDbIfNeeded` for every change. */
const DATABASE_VERSION = 2;

/**
 * Creates the schema and seeds the starter accounts/categories on first launch.
 * Passed to `SQLiteProvider`, which runs it once before rendering the app.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

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

      const now = new Date().toISOString();

      // Seed starter account
      await txn.runAsync(
        `INSERT INTO accounts (name, type, currency, created_at, archived_at) VALUES (?, ?, ?, ?, ?)`,
        'Tabungan', 'savings', 'IDR', now, null
      );

      // Seed income categories
      const incomeCategories = [
        'salary',
        'commission/gig',
        'passive income',
        'investment return',
      ];
      for (const name of incomeCategories) {
        await txn.runAsync(
          `INSERT INTO categories (name, kind, created_at) VALUES (?, ?, ?)`,
          name, 'income', now
        );
      }

      // Seed expense categories
      const expenseCategories = [
        'Housing',
        'Utilities',
        'Groceries',
        'Dining Out',
        'Transportation',
        'Healthcare',
        'Entertainment',
        'Shopping',
        'Savings',
        'Miscellaneous',
      ];
      for (const name of expenseCategories) {
        await txn.runAsync(
          `INSERT INTO categories (name, kind, created_at) VALUES (?, ?, ?)`,
          name, 'expense', now
        );
      }

      // Record the version this block upgrades to (not DATABASE_VERSION) so a
      // half-applied migration can never be mistaken for a complete one.
      await txn.execAsync('PRAGMA user_version = 1');
    });
  }

  const categoryColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(categories)'
  );
  const hasArchivedAt = categoryColumns.some((column) => column.name === 'archived_at');

  if (!hasArchivedAt) {
    // Add `archived_at` for soft deletes and drop the table-level UNIQUE on name
    // (so a name can be reused after a category is archived). Guarded by schema
    // state rather than the version number, so a database that was mis-stamped
    // to a later version is still repaired. SQLite cannot ALTER a constraint
    // away, hence the table swap. Foreign keys must be toggled outside a
    // transaction.
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync(`
          CREATE TABLE categories_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE,
            kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
            created_at TEXT NOT NULL,
            archived_at TEXT
          );

          INSERT INTO categories_new (id, name, kind, created_at, archived_at)
            SELECT id, name, kind, created_at, NULL FROM categories;

          DROP TABLE categories;
          ALTER TABLE categories_new RENAME TO categories;

          CREATE UNIQUE INDEX categories_active_name_unique
            ON categories (name COLLATE NOCASE) WHERE archived_at IS NULL;
        `);

        await txn.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
      });
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON');
    }
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

