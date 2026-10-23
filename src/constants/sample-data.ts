import type { Account, Category } from '@/types/api';

/**
 * Temporary stand-in for `GET /accounts` and `GET /categories` until the API
 * client is wired up. Values mirror the examples in openapi.yaml.
 */
export const SAMPLE_ACCOUNTS: Account[] = [
  {
    id: 1,
    name: 'Everyday Checking',
    type: 'checking',
    currency: 'IDR',
    created_at: '2026-01-15T09:30:00Z',
    archived_at: null,
  },
  {
    id: 2,
    name: 'Savings',
    type: 'savings',
    currency: 'IDR',
    created_at: '2026-01-15T09:30:00Z',
    archived_at: null,
  },
  {
    id: 3,
    name: 'Cash',
    type: 'cash',
    currency: 'IDR',
    created_at: '2026-01-15T09:30:00Z',
    archived_at: null,
  },
];

export const SAMPLE_CATEGORIES: Category[] = [
  { id: 1, name: 'Groceries', kind: 'expense', created_at: '2026-01-15T09:30:00Z' },
  { id: 2, name: 'Transport', kind: 'expense', created_at: '2026-01-15T09:30:00Z' },
  { id: 3, name: 'Utilities', kind: 'expense', created_at: '2026-01-15T09:30:00Z' },
  { id: 4, name: 'Dining', kind: 'expense', created_at: '2026-01-15T09:30:00Z' },
  { id: 5, name: 'Salary', kind: 'income', created_at: '2026-01-15T09:30:00Z' },
];
