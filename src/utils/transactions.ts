import type { TransactionCreate } from '@/types/api';
import { formatDisplayDate } from '@/utils/format';

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

/** Local date without a time, formatted `YYYY-MM-DD`. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Locale-aware local date for display, for example `Oct 23, 2026`. */
export function formatDate(date: Date): string {
  return formatDisplayDate(date);
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
 * Groups the integer part of an editing amount with `.` thousands
 * separators, keeping the `,` decimal part untouched. Empty or decimal-only
 * values pass through unchanged.
 */
export function formatAmountWithSeparators(value: string): string {
  if (!value) {
    return value;
  }

  const commaIndex = value.indexOf(',');
  const integerPart = commaIndex === -1 ? value : value.slice(0, commaIndex);
  const decimals = commaIndex === -1 ? '' : value.slice(commaIndex);

  if (!/^\d+$/.test(integerPart)) {
    return value;
  }

  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return grouped + decimals;
}

/**
 * Parses a positive major-unit amount (`45.99`, `1.234,5` or `45,99`) into
 * integer cents. Grouped thousands dots are stripped. Returns `null` for
 * invalid input.
 */
export function parseAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
}

/**
 * Formats signed cents for the amount field, using the comma decimal
 * separator the numeric keypad expects. Thousands are grouped with `.` and
 * trailing zero decimals are dropped.
 */
export function formatCentsForEditing(amountCents: number): string {
  const value = (Math.abs(amountCents) / 100).toFixed(2);
  const raw = value.replace(/\.00$/, '').replace('.', ',');
  return formatAmountWithSeparators(raw);
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
