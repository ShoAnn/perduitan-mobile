import { useSyncExternalStore } from 'react';

import { SAMPLE_CATEGORIES } from '@/constants/sample-data';
import type { Category, CategoryCreate } from '@/types/api';

/**
 * Temporary in-memory stand-in for `GET /categories` and `POST /categories`
 * until the API client is wired up. Mirrors the API's ordering (by name) and
 * its name-conflict rule so screens behave the same once it is.
 */
let categories: Category[] = [...SAMPLE_CATEGORIES].sort((a, b) => a.name.localeCompare(b.name));

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

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

/** Whether another category already uses this name (case-insensitive). */
export function hasCategoryName(name: string): boolean {
  const normalized = normalizeName(name);
  return categories.some((category) => normalizeName(category.name) === normalized);
}

/** Adds a category and returns it, keeping the list ordered by name. */
export function addCategory(input: CategoryCreate): Category {
  const category: Category = {
    id: Math.max(0, ...categories.map((existing) => existing.id)) + 1,
    name: input.name.trim(),
    kind: input.kind,
    created_at: new Date().toISOString(),
  };

  categories = [...categories, category].sort((a, b) => a.name.localeCompare(b.name));
  listeners.forEach((listener) => listener());

  return category;
}

/** Subscribes to the category list, so screens update after an add. */
export function useCategories(): Category[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
