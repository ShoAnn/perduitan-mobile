import i18n from '@/i18n';
import { formatCompactCurrency, formatCurrency } from '@/utils/format';

function setLocale(language: 'en' | 'id') {
  // i18n.language is read via currentLocale() in utils/format
  Object.defineProperty(i18n, 'language', {
    configurable: true,
    get: () => language,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('formatCompactCurrency', () => {
  it('keeps full currency below one million', () => {
    setLocale('en');
    expect(formatCompactCurrency(99999900)).toBe(formatCurrency(99999900));
  });

  it('shortens one million to M (en)', () => {
    setLocale('en');
    expect(formatCompactCurrency(100000000)).toBe('IDR 1M');
    expect(formatCompactCurrency(150000000)).toBe('IDR 1.5M');
    expect(formatCompactCurrency(250000000000)).toBe('IDR 2.5B');
  });

  it('shortens one million to jt (id)', () => {
    setLocale('id');
    expect(formatCompactCurrency(100000000)).toBe('Rp 1 jt');
    expect(formatCompactCurrency(150000000)).toBe('Rp 1,5 jt');
    expect(formatCompactCurrency(250000000000)).toBe('Rp 2,5 M');
  });

  it('uses absolute value', () => {
    setLocale('en');
    expect(formatCompactCurrency(-150000000)).toBe('IDR 1.5M');
  });
});
