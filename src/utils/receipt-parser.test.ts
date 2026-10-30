/// <reference types="jest" />

import { parseAmountToken, parseReceiptText } from '@/utils/receipt-parser';

/** Fixed "today" so future-date rejection is deterministic. */
const TODAY = new Date(2026, 9, 29);

function parse(text: string, kind?: 'expense' | 'income') {
  return parseReceiptText(text, { kind, today: TODAY });
}

describe('parseAmountToken', () => {
  it.each([
    ['45.500', 4550000],
    ['45,500', 4550000],
    ['1.234.567,89', 123456789],
    ['1,234,567.89', 123456789],
    ['50.000,-', 5000000],
    ['12,50', 1250],
    ['12.50', 1250],
    ['Rp 15.000', 1500000],
  ])('parses %s as %i cents', (input, cents) => {
    expect(parseAmountToken(input)?.cents).toBe(cents);
  });

  it('returns null for text with no number', () => {
    expect(parseAmountToken('Total')).toBeNull();
  });
});

describe('parseReceiptText', () => {
  it('reads an Indonesian minimarket receipt', () => {
    const receipt = parse(
      [
        'INDOMARET',
        'Jl. Sudirman No. 12',
        'TOTAL 45.500',
        '21/10/2026',
      ].join('\n')
    );

    expect(receipt.amountCents).toBe(4550000);
    expect(receipt.amountConfidence).toBe('high');
    expect(receipt.occurredOn).toBe('2026-10-21');
    expect(receipt.merchant).toBe('Indomaret');
    expect(receipt.description).toBe('Indomaret');
    expect(receipt.suggestedCategoryName).toBe('Groceries');
    expect(receipt.kind).toBe('expense');
  });

  it('prefers the grand total over subtotal, tax, and service', () => {
    const receipt = parse(
      [
        'RESTO SEDERHANA',
        'Sub Total 100.000',
        'Tax 10.000',
        'Service 5.000',
        'Grand Total 115.000',
        '21/10/2026',
      ].join('\n')
    );

    expect(receipt.amountCents).toBe(11500000);
    expect(receipt.amountConfidence).toBe('high');
    expect(receipt.suggestedCategoryName).toBe('Dining Out');
  });

  it('detects an incoming transfer as income', () => {
    const receipt = parse(
      [
        'BCA',
        'Transfer Masuk',
        'Total Transfer Rp 1.500.000',
        '05 Okt 2026',
      ].join('\n')
    );

    expect(receipt.kind).toBe('income');
    expect(receipt.amountCents).toBe(150000000);
    expect(receipt.occurredOn).toBe('2026-10-05');
    expect(receipt.dateConfidence).toBe('high');
    expect(receipt.merchant).toBe('BCA');
  });

  it('uses the requested kind and suggests an income category', () => {
    const receipt = parse(
      ['PT CONTOH', 'Gaji Oktober 2026', 'Total 12.500.000', '25/10/2026'].join('\n'),
      'income'
    );

    expect(receipt.kind).toBe('income');
    expect(receipt.suggestedCategoryName).toBe('salary');
    expect(receipt.amountCents).toBe(1250000000);
  });

  it('ignores NPWP, phone numbers, and dates when looking for the amount', () => {
    const receipt = parse(
      [
        'TOKO MAJU',
        'NPWP 01.234.567.8-901.000',
        'Telp 0812-3456-7890',
        '21/10/2026',
        'TOTAL 45.500',
      ].join('\n')
    );

    expect(receipt.amountCents).toBe(4550000);
    expect(receipt.occurredOn).toBe('2026-10-21');
  });

  it('ignores a small quantity next to JUMLAH', () => {
    const receipt = parse(
      ['WARUNG MAKAN', 'JUMLAH 2', 'TOTAL 25.000', '21/10/2026'].join('\n')
    );

    expect(receipt.amountCents).toBe(2500000);
  });

  it('does not treat a time as an amount outside total lines', () => {
    const receipt = parse(
      ['CAFE KOPI', '14.32', 'TOTAL $14.32', '21/10/2026'].join('\n')
    );

    expect(receipt.amountCents).toBe(1432);
  });

  it('falls back to the largest plausible amount when no total keyword exists', () => {
    const receipt = parse(['TOKO MAJU', '10.000', '25.000', '21/10/2026'].join('\n'));

    expect(receipt.amountCents).toBe(2500000);
    expect(receipt.amountConfidence).toBe('low');
    expect(receipt.warnings).toContain('The total was inferred. Check the amount carefully.');
  });

  it('returns empty fields and warnings for unreadable text', () => {
    const receipt = parse('   ');

    expect(receipt.amountCents).toBeNull();
    expect(receipt.occurredOn).toBeNull();
    expect(receipt.merchant).toBeNull();
    expect(receipt.suggestedCategoryName).toBeNull();
    expect(receipt.warnings.length).toBeGreaterThan(0);
  });

  it('rejects dates in the future', () => {
    const receipt = parse(['TOKO MAJU', 'TOTAL 10.000', '25/12/2026'].join('\n'));

    expect(receipt.occurredOn).toBeNull();
  });
});

describe('category suggestions', () => {
  it.each([
    ['TELKOMSEL', 'Paket Data 10GB'],
    ['MYTELKOMSEL', 'Paket 8GB'],
    ['INDOSAT', 'Paket Internet 12GB'],
    ['Bima+ 15GB', 'Masa aktif 30 hari'],
  ])('suggests Utilities for %s', (merchant, item) => {
    const receipt = parse([merchant, item, 'TOTAL 75.000', '21/10/2026'].join('\n'));

    expect(receipt.suggestedCategoryName).toBe('Utilities');
  });

  it.each([
    ['WARTEG BAHARI', 'Nasi + Telur'],
    ['KANTIN KAMPUS', 'Makan Siang'],
    ['CANTEEN OFFICE', 'Lunch Set'],
    ['KOPERASI SEKOLAH', 'Snack'],
    ['WARUNG MAKAN', 'Nasi Goreng'],
  ])('suggests Dining Out for %s', (merchant, item) => {
    const receipt = parse([merchant, item, 'TOTAL 18.000', '21/10/2026'].join('\n'));

    expect(receipt.suggestedCategoryName).toBe('Dining Out');
  });
});
