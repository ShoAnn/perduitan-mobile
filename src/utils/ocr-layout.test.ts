/// <reference types="jest" />

import { buildReadingOrderText } from '@/utils/ocr-layout';
import { parseReceiptText } from '@/utils/receipt-parser';

const HEIGHT = 30;

function line(text: string, x: number, y: number) {
  return { text, boundingBox: { x, y, width: text.length * 12, height: HEIGHT } };
}

describe('buildReadingOrderText', () => {
  it('joins column-first OCR output back into visual rows', () => {
    // ML Kit often returns every label first and every amount second.
    const text = buildReadingOrderText([
      line('INDOMARET', 40, 40),
      line('Susu Ultra 1L', 40, 120),
      line('TOTAL', 40, 160),
      line('25.000', 500, 120),
      line('49.950', 500, 160),
    ]);

    expect(text).toBe('INDOMARET\nSusu Ultra 1L 25.000\nTOTAL 49.950');
  });

  it('returns null when no line has a bounding box', () => {
    expect(buildReadingOrderText([{ text: 'INDOMARET' }])).toBeNull();
  });

  it('produces text the receipt parser can read', () => {
    const text = buildReadingOrderText([
      line('INDOMARET', 40, 40),
      line('21/10/ 2026 14:32', 40, 80),
      line('Sub Total', 40, 120),
      line('PPN 11%', 40, 160),
      line('TOTAL', 40, 200),
      line('45.000', 500, 120),
      line('4.950', 500, 160),
      line('49.950', 500, 200),
    ]);

    expect(text).not.toBeNull();
    const receipt = parseReceiptText(text ?? '', {
      kind: 'expense',
      today: new Date(2026, 9, 29),
    });

    expect(receipt.amountCents).toBe(4995000);
    expect(receipt.occurredOn).toBe('2026-10-21');
    expect(receipt.merchant).toBe('Indomaret');
  });
});
