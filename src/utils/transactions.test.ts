import {
  formatAmountWithSeparators,
  formatCentsForEditing,
  parseAmountToCents,
} from '@/utils/transactions';

describe('formatAmountWithSeparators', () => {
  it.each([
    ['', ''],
    ['12', '12'],
    ['1234', '1.234'],
    ['1234567', '1.234.567'],
    ['1234,5', '1.234,5'],
    ['1234567,89', '1.234.567,89'],
    ['12,', '12,'],
  ])('%s -> %s', (input, expected) => {
    expect(formatAmountWithSeparators(input)).toBe(expected);
  });
});

describe('parseAmountToCents with separators', () => {
  it.each([
    ['1.234.567', 123456700],
    ['1.234.567,89', 123456789],
    ['1234567', 123456700],
    ['1.234,5', 123450],
  ])('parses %s as %i cents', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });
});

describe('formatCentsForEditing with separators', () => {
  it.each([
    [123456789, '1.234.567,89'],
    [123450, '1.234,50'],
    [100000, '1.000'],
  ])('%i cents -> %s', (cents, expected) => {
    expect(formatCentsForEditing(cents)).toBe(expected);
  });
});
