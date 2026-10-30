import type { TransactionCreate } from '@/types/api';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

/** Local date without a time, formatted `YYYY-MM-DD`. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local date for display, for example `Oct 23, 2026`. */
export function formatDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Date in the format the inline date editor accepts, `YYYY-MM-DD`. */
export function formatEditableDate(date: Date): string {
  return toDateString(date);
}

/**
 * Parses `YYYY-MM-DD` in local time. Returns `null` for unparseable or
 * out-of-range values (for example `2026-02-31`).
 */
export function parseEditableDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return isValid ? date : null;
}

/**
 * Parses a positive major-unit amount (`45.99` or `45,99`) into integer cents.
 * Returns `null` for invalid input.
 */
export function parseAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

/**
 * Formats signed cents for the amount field, using the comma decimal
 * separator the numeric keypad expects. Trailing zero decimals are dropped.
 */
export function formatCentsForEditing(amountCents: number): string {
  const value = (Math.abs(amountCents) / 100).toFixed(2);
  return value.replace(/\.00$/, '').replace('.', ',');
}

type ExpenseInput = {
  accountId: number;
  categoryId: number | null;
  amountCents: number;
  description: string;
  occurredOn: Date;
};

/**
 * Builds the `POST /transactions` body for an expense. The entered amount is
 * positive, but expenses are stored as negative cents.
 */
export function buildExpensePayload({
  accountId,
  categoryId,
  amountCents,
  description,
  occurredOn,
}: ExpenseInput): TransactionCreate {
  const trimmedDescription = description.trim();

  return {
    account_id: accountId,
    category_id: categoryId,
    amount_cents: -Math.abs(amountCents),
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
    occurred_on: toDateString(occurredOn),
  };
}
