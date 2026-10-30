export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment';

export type CategoryKind = 'income' | 'expense';

export type Account = {
  id: number;
  name: string;
  type: AccountType;
  /** ISO 4217 currency code, for example `IDR`. */
  currency: string;
  created_at: string;
  archived_at: string | null;
};

export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  created_at: string;
};

/** Request body for `POST /categories` (`CategoryCreate` in openapi.yaml). */
export type CategoryCreate = {
  /** Unique category name. */
  name: string;
  kind: CategoryKind;
};

/** Request body for `POST /transactions` (`TransactionCreate` in openapi.yaml). */
export type TransactionCreate = {
  account_id: number;
  /** Optional category, or `null` when uncategorized. */
  category_id?: number | null;
  /** Signed amount in cents; positive is money in, negative is money out. */
  amount_cents: number;
  description?: string | null;
  /** Date without a time, formatted `YYYY-MM-DD`. */
  occurred_on: string;
};

/** Request body for `PUT /transactions/{transactionId}` (`TransactionUpdate` in openapi.yaml). */
export type TransactionUpdate = TransactionCreate;
