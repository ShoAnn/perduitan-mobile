import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useSyncExternalStore } from 'react';

import { listAccounts } from '@/db/accounts';
import type { Account } from '@/types/api';

/** Shared cache of the active accounts stored in SQLite. */
let accounts: Account[] = [];
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
  return accounts;
}

function emit() {
  listeners.forEach((listener) => listener());
}

/** Reloads the cache from SQLite, sharing an in-flight query between callers. */
export async function refreshAccounts(db: SQLiteDatabase): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    accounts = await listAccounts(db);
    isLoaded = true;
    emit();
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

/** Subscribes to the stored accounts, loading them on first use. */
export function useAccounts(db: SQLiteDatabase): Account[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!isLoaded) {
      refreshAccounts(db).catch((error: unknown) => {
        console.error('Failed to load accounts', error);
      });
    }
  }, [db]);

  return snapshot;
}
