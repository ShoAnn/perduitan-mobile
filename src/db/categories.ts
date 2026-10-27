import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, CategoryCreate } from '@/types/api';

/** Mirrors `GET /categories`: every category, ordered by name. */
export async function listCategories(db: SQLiteDatabase): Promise<Category[]> {
  return db.getAllAsync<Category>(
    'SELECT id, name, kind, created_at FROM categories ORDER BY name COLLATE NOCASE'
  );
}

/** Mirrors `POST /categories`; throws on a duplicate name. */
export async function insertCategory(
  db: SQLiteDatabase,
  input: CategoryCreate
): Promise<Category> {
  const category: Omit<Category, 'id'> = {
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

  return { id: result.lastInsertRowId, ...category };
}
