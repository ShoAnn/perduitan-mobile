import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { insertCategory, listCategories } from '@/db/categories';
import type { Category, CategoryCreate } from '@/types/api';

/**
 * Shared cache of the categories stored in SQLite. Screens subscribe through
 * `useCategories`, which keeps them in sync after a category is added.
 */
let categories: Category[] = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return categories;
}

function emit() {
  listeners.forEach((listener) => listener());
}

/** Reloads the cache from SQLite, sharing an in-flight query between callers. */
export async function refreshCategories(db: SQLiteDatabase): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    categories = await listCategories(db);
    isLoaded = true;
    emit();
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

/** Whether another category already uses this name (case-insensitive). */
export function hasCategoryName(name: string): boolean {
  const normalized = normalizeName(name);
  return categories.some((category) => normalizeName(category.name) === normalized);
}

/**
 * Adds a category to SQLite and refreshes the cache. Throws when the name is
 * already taken, so callers can surface a field error.
 */
export async function addCategory(
  db: SQLiteDatabase,
  input: CategoryCreate
): Promise<Category> {
  const category = await insertCategory(db, input);
  await refreshCategories(db);
  return category;
}

/** Subscribes to the stored categories, loading them on first use. */
export function useCategories(db: SQLiteDatabase): Category[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!isLoaded) {
      refreshCategories(db).catch((error: unknown) => {
        console.error('Failed to load categories', error);
      });
    }
  }, [db]);

  return snapshot;
}
