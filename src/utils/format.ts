import type { TFunction } from 'i18next';

import i18n from '@/i18n';

/** Locale tag for `Intl`, derived from the currently active language. */
function currentLocale(): string {
  return i18n.language?.startsWith('id') ? 'id-ID' : 'en-US';
}

/** Currency for the given cents, e.g. `Rp 1.234.567` or `IDR 1,234,567`. */
export function formatCurrency(amountCents: number, currency = 'IDR'): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency,
  }).format(Math.abs(amountCents) / 100);
}

/**
 * Compact currency for tight spaces (chart centre), e.g. `IDR 1.5M` /
 * `Rp 1,5 jt`. Below one million it falls back to full `formatCurrency`.
 */
export function formatCompactCurrency(amountCents: number, currency = 'IDR'): string {
  const amount = Math.abs(amountCents) / 100;
  if (amount < 1_000_000) {
    return formatCurrency(amountCents, currency);
  }

  const locale = currentLocale();
  const isId = locale.startsWith('id');
  const isBillion = amount >= 1_000_000_000;
  const value = amount / (isBillion ? 1_000_000_000 : 1_000_000);
  const suffix = isBillion ? (isId ? 'M' : 'B') : isId ? 'jt' : 'M';
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
  const prefix = new Intl.NumberFormat(locale, { style: 'currency', currency })
    .format(0)
    .replace(/[0-9\s.,]/g, '')
    .trim();

  return `${prefix} ${formatted}${isId ? ` ${suffix}` : suffix}`;
}

/** Plain grouping for the given value, e.g. `1.234.567`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(currentLocale()).format(value);
}

/** Short display date, e.g. `Oct 23, 2026` / `23 Okt 2026`. */
export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Long month label for a `YYYY-MM` key, e.g. `October 2026` / `Oktober 2026`. */
export function formatMonthLong(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(currentLocale(), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

/** Compact month label for a `YYYY-MM` key, e.g. `Oct 2026` / `Okt 2026`. */
export function formatMonthShort(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(currentLocale(), {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

/** Medium date with time for a timestamp; `fallback` when unparseable. */
export function formatTimestamp(value: string, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Day header for a `YYYY-MM-DD` value: the date, plus Today/Yesterday. */
export function formatDayLabel(value: string, t: TFunction): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(year, month - 1, day);
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  const formatted = new Intl.DateTimeFormat(currentLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year !== today.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);

  if (diffDays === 0) {
    return `${formatted} · ${t('history.today')}`;
  }
  if (diffDays === 1) {
    return `${formatted} · ${t('history.yesterday')}`;
  }

  return formatted;
}
