import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, CategoryCreate, CategoryUpdate } from '@/types/api';

/** Mirrors `GET /categories`: active categories only, ordered by name. */
export async function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>(
    `SELECT id, name, kind, created_at, archived_at
     FROM categories
     WHERE archived_at IS NULL
     ORDER BY name COLLATE NOCASE`
  );
}

/** Mirrors `GET /categories/{categoryId}`. Returns archived rows too. */
export async function getCategoryById(
  db: SQLiteDatabase,
  id: number
): Promise<Category | null> {
  return db.getFirstAsync<Category>(
    'SELECT id, name, kind, created_at, archived_at FROM categories WHERE id = ?',
    id
  );
}

/** Mirrors `POST /categories`; throws on a duplicate active name. */
export async function insertCategory(
  db: SQLiteDatabase,
  input: CategoryCreate
): Promise<Category> {
  const category: Omit<Category, 'id' | 'archived_at'> = {
    name: input.name.trim(),
    kind: input.kind,
    created_at: new Date().toISOString(),
  };

  const result = await db.runAsync(
    'INSERT INTO categories (name, kind, created_at) VALUES (?, ?, ?)',
    category.name,
    category.kind,
    category.created_at
  );

  return { id: result.lastInsertRowId, archived_at: null, ...category };
}

/** Mirrors `PUT /categories/{categoryId}`. Replaces mutable fields. */
export async function updateCategory(
  db: SQLiteDatabase,
  id: number,
  input: CategoryUpdate
): Promise<Category> {
  await db.runAsync(
    'UPDATE categories SET name = ?, kind = ? WHERE id = ?',
    input.name.trim(),
    input.kind,
    id
  );

  const updated = await getCategoryById(db, id);
  if (!updated) {
    throw new Error('Category not found after update');
  }
  return updated;
}

/** Mirrors `DELETE /categories/{categoryId}` via soft delete: stamps `archived_at`. */
export async function archiveCategory(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET archived_at = ? WHERE id = ?',
    new Date().toISOString(),
    id
  );
}

/** Number of transactions that reference a category (used to warn before archiving). */
export async function countTransactionsByCategory(
  db: SQLiteDatabase,
  id: number
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?',
    id
  );
  return row?.count ?? 0;
}
