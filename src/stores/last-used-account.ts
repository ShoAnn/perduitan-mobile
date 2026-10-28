import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { getLastUsedAccountId } from '@/db/transactions';

/**
 * Shared cache of the id of the account used by the most recent transaction.
 * The query skips archived (deleted) accounts, so consumers always point at an
 * active account even after the previously used one was removed.
 */
let lastUsedAccountId: number | null = null;
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
  return lastUsedAccountId;
}

function emit() {
  listeners.forEach((listener) => listener());
}

/** Reloads the cache from SQLite, sharing an in-flight query between callers. */
export async function refreshLastUsedAccountId(db: SQLiteDatabase): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    lastUsedAccountId = await getLastUsedAccountId(db);
    isLoaded = true;
    emit();
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

/** Subscribes to the last used account id, loading it on first use. */
export function useLastUsedAccountId(db: SQLiteDatabase): number | null {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!isLoaded) {
      refreshLastUsedAccountId(db).catch((error: unknown) => {
        console.error('Failed to load the last used account', error);
      });
    }
  }, [db]);

  return snapshot;
}
