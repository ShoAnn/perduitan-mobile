import type { TFunction } from 'i18next';

/**
 * Seeded category names are stored in SQLite in English and reused as stable
 * keys (receipt parsing, duplicate-name checks). This maps those canonical
 * names to display translations; anything else is shown as the user typed it.
 */
const CATEGORY_KEYS: Record<string, string> = {
  salary: 'categories.salary',
  'commission/gig': 'categories.commissionGig',
  'passive income': 'categories.passiveIncome',
  'investment return': 'categories.investmentReturn',
  housing: 'categories.housing',
  utilities: 'categories.utilities',
  groceries: 'categories.groceries',
  'dining out': 'categories.diningOut',
  transportation: 'categories.transportation',
  healthcare: 'categories.healthcare',
  entertainment: 'categories.entertainment',
  shopping: 'categories.shopping',
  savings: 'categories.savings',
  miscellaneous: 'categories.miscellaneous',
};

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Display label for a category name, translating the seeded categories. */
export function categoryLabel(name: string, t: TFunction): string {
  const key = CATEGORY_KEYS[name.trim().toLowerCase()];
  return key ? t(key) : sentenceCase(name);
}
