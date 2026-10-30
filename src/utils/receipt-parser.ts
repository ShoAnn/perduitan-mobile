/**
 * Turns raw OCR text from an Indonesian or English receipt into the fields the
 * transaction forms need. Everything in this module is pure so the heuristics
 * can be unit tested without a device.
 */

export type ReceiptKind = 'expense' | 'income';
export type ParseConfidence = 'high' | 'low';

export type ParsedReceipt = {
  kind: ReceiptKind;
  amountCents: number | null;
  amountConfidence: ParseConfidence;
  occurredOn: string | null;
  dateConfidence: ParseConfidence;
  merchant: string | null;
  description: string | null;
  suggestedCategoryName: string | null;
  warnings: string[];
  rawText: string;
};

type AmountCandidate = {
  cents: number;
  raw: string;
  lineIndex: number;
  keywordScore: number;
  fallbackEligible: boolean;
  hasDecimal: boolean;
  digitCount: number;
};

type DateCandidate = {
  date: Date;
  lineIndex: number;
  score: number;
  confidence: ParseConfidence;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  januari: 1,
  feb: 2,
  february: 2,
  februari: 2,
  febuary: 2,
  mar: 3,
  march: 3,
  maret: 3,
  apr: 4,
  april: 4,
  may: 5,
  mei: 5,
  jun: 6,
  june: 6,
  juni: 6,
  jul: 7,
  july: 7,
  juli: 7,
  aug: 8,
  august: 8,
  agu: 8,
  agt: 8,
  agustus: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  des: 12,
  dec: 12,
  december: 12,
  desember: 12,
};

const TOTAL_KEYWORDS: RegExp[] = [
  /\bgrand\s*total\b/i,
  /\btotal\s*(?:bayar|pembayaran|tagihan|transfer|belanja|amount|harga)\b/i,
  /\bjumlah\s*(?:bayar|pembayaran|transfer)\b/i,
  /\bamount\s*due\b/i,
  /\btotal\s*amount\b/i,
  /\bnilai\s*transfer\b/i,
];

const WEAK_TOTAL_KEYWORDS: RegExp[] = [
  /\btotal\b/i,
  /\bjumlah\b/i,
  /\bamount\b/i,
  /\bnominal\b/i,
];

const NEGATIVE_TOTAL_KEYWORDS: RegExp[] = [
  /\b(?:sub\s*total|subtotal|dpp)\b/i,
  /\b(?:tax|pajak|ppn|pph|service|servis)\b/i,
  /\b(?:discount|diskon|potongan|voucher)\b/i,
  /\b(?:kembali|kembalian|change)\b/i,
  /\b(?:tunai|cash|debit|kredit|credit|card|kartu|qris)\b/i,
  /\bitem\b/i,
];

const NON_AMOUNT_CONTEXT =
  /\b(?:npwp|telp|telepon|phone|hp|wa|whatsapp|card|kartu|rekening|account|no|nomor|ref|trx|transaksi|invoice|struk|kode|auth|approval|approve|kasir|cashier)\b/i;

const ITEM_CONTEXT = /\b(?:qty|item|harga|price|unit|pcs|pax|box|pack)\b|\d+\s*[x@]\s*\d+/i;

const MERCHANT_IGNORE =
  /\b(?:struk|receipt|invoice|nota|faktur|kwitansi|kasir|cashier|terima\s*kasih|thank\s*you|selamat\s*datang|welcome|jl\.?|jalan|telp|tel|phone|npwp|rt\/rw|kec|kab|kota|provinsi|transfer|pembayaran|payment|bukti|tanda\s*terima|detail|rincian)\b/i;

const EXPENSE_CATEGORY_RULES: { name: string; keywords: RegExp[] }[] = [
  {
    name: 'Housing',
    keywords: [/\b(?:sewa|rent|kontrakan|kos|apartemen|apartment|property|properti)\b/i],
  },
  {
    name: 'Utilities',
    keywords: [
      /\b(?:pln|listrik|telkomsel|mytelkomsel|indosat|telkom|indihome|pdam|pulsa|kuota|internet|bpjs|gas|air)\b/i,
      /\bbima\+/i,
    ],
  },
  {
    name: 'Groceries',
    keywords: [
      /\b(?:indomaret|alfamart|supermarket|hypermarket|grocery|groceries|sayur|pasar|fresh|foodhall|ranch\s*market|tip\s*top)\b/i,
    ],
  },
  {
    name: 'Dining Out',
    keywords: [
      /\b(?:restoran|restaurant|resto|cafe|kafe|coffee|kopi|warung|warteg|kantin|canteen|koperasi|bakso|sate|mcd|mcdonald|kfc|starbucks|pizza|burger|food\s*court|dining)\b/i,
    ],
  },
  {
    name: 'Transportation',
    keywords: [
      /\b(?:grab|gojek|go-jek|maxim|taxi|taksi|pertamina|shell|spbu|bensin|parkir|tol|kereta|bus|ojek|travel)\b/i,
    ],
  },
  {
    name: 'Healthcare',
    keywords: [
      /\b(?:apotek|apotik|pharmacy|klinik|clinic|rumah\s*sakit|hospital|dokter|doctor|lab|medical|optik)\b/i,
    ],
  },
  {
    name: 'Entertainment',
    keywords: [
      /\b(?:bioskop|cinema|xxi|cgv|netflix|spotify|game|konser|concert|tiket|ticket)\b/i,
    ],
  },
  {
    name: 'Shopping',
    keywords: [
      /\b(?:tokopedia|shopee|lazada|blibli|mall|toko|store|uniqlo|h&m|zara|ikea|ace\s*hardware|electronic)\b/i,
    ],
  },
  {
    name: 'Savings',
    keywords: [/\b(?:tabungan|deposito|reksadana|investasi|investment|savings)\b/i],
  },
];

const INCOME_CATEGORY_RULES: { name: string; keywords: RegExp[] }[] = [
  {
    name: 'salary',
    keywords: [/\b(?:salary|gaji|payroll|upah|honor)\b/i],
  },
  {
    name: 'commission/gig',
    keywords: [/\b(?:commission|komisi|gig|freelance|fee|proyek|project)\b/i],
  },
  {
    name: 'passive income',
    keywords: [/\b(?:passive|royalti|royalty|sewa\s*diterima|rental\s*income)\b/i],
  },
  {
    name: 'investment return',
    keywords: [
      /\b(?:dividen|dividend|bunga|interest|coupon|kupon|capital\s*gain|reksadana)\b/i,
    ],
  },
];

const INCOME_SIGNALS = [
  /\b(?:salary|gaji|payroll|bonus|komisi|commission|dividen|dividend|bunga|interest|coupon|kupon)\b/i,
  /\b(?:transfer\s*masuk|dana\s*masuk|uang\s*masuk|payment\s*received|received\s*from|refund|cashback)\b/i,
];

const EXPENSE_SIGNALS = [
  /\b(?:struk|kasir|kembalian|kembali|tunai|cash|subtotal|sub\s*total|ppn|pajak|item|total\s*bayar)\b/i,
  /\b(?:qris|debit|kredit|credit|belanja|pembayaran)\b/i,
];

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Local `YYYY-MM-DD`, matching the format the forms expect. */
function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function parseSettingValue(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

/** Title-cases a merchant name while keeping short acronyms such as BCA intact. */
function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) {
        return word;
      }
      if (/^[A-Z]{2,4}$/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/** Removes text that looks like a date, time, phone, tax id, or card number. */
function maskNonAmountText(line: string): string {
  return line
    .replace(/\bnpwp\b.*/gi, ' ')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g, ' ')
    .replace(/\b\d{1,4}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{1,4}\b/g, ' ')
    .replace(/\b\d{1,2}\s+[a-z]{3,9}\.?\s+\d{2,4}\b/gi, ' ')
    .replace(/\b\d{10,}\b/g, ' ');
}

type ParsedNumber = {
  cents: number;
  hasDecimal: boolean;
  digitCount: number;
};

/**
 * Parses a single amount token using the separator conventions found on
 * Indonesian and English receipts:
 *
 * - `45.500` / `45,500` -> 45,500 (thousands)
 * - `1.234.567,89` / `1,234,567.89` -> 1,234,567.89
 * - `12,50` / `12.50` -> 12.50
 */
export function parseAmountToken(token: string): ParsedNumber | null {
  let raw = token.replace(/[^\d.,]/g, '');
  raw = raw.replace(/[.,]+$/, '');

  if (!raw) {
    return null;
  }

  const digitCount = (raw.match(/\d/g) ?? []).length;
  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  let normalized: string;
  let hasDecimal = false;

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const thousandSeparator = decimalSeparator === '.' ? ',' : '.';
    const decimalIndex = raw.lastIndexOf(decimalSeparator);
    const fraction = raw.slice(decimalIndex + 1);
    hasDecimal = /^\d{1,2}$/.test(fraction);
    normalized = raw.split(thousandSeparator).join('').replace(decimalSeparator, '.');
  } else if (lastDot !== -1) {
    const parts = raw.split('.');
    if (parts.length > 2) {
      normalized = parts.join('');
    } else {
      const [integer, fraction] = parts;
      if (fraction.length === 3) {
        normalized = `${integer}${fraction}`;
      } else {
        normalized = `${integer}.${fraction}`;
        hasDecimal = fraction.length > 0 && fraction.length <= 2;
      }
    }
  } else if (lastComma !== -1) {
    const parts = raw.split(',');
    if (parts.length > 2) {
      normalized = parts.join('');
    } else {
      const [integer, fraction] = parts;
      if (fraction.length === 3) {
        normalized = `${integer}${fraction}`;
      } else {
        normalized = `${integer}.${fraction}`;
        hasDecimal = fraction.length > 0 && fraction.length <= 2;
      }
    }
  } else {
    normalized = raw;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return {
    cents: Math.round(value * 100),
    hasDecimal,
    digitCount,
  };
}

/**
 * Extracts plausible numeric amount tokens from one line of OCR text.
 * `allowTimeLikeAmount` is set for lines that contain a total keyword, where
 * `14.32` is far more likely to be $14.32 than a time.
 */
function collectAmountTokens(line: string, allowTimeLikeAmount = false): ParsedNumber[] {
  const normalizedSpaces = line.replace(/(\d)\s+(?=\d)/g, '$1');
  const masked = maskNonAmountText(normalizedSpaces);
  const tokenPattern = /\d[\d.,]*\d|\d/g;
  const found: ParsedNumber[] = [];

  for (const match of masked.matchAll(tokenPattern)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const before = masked[start - 1];
    const after = masked[start + raw.length];

    // Date separators around a token mean it is not money.
    if (before && /[/:-]/.test(before)) {
      continue;
    }
    if (after && /[/:-]/.test(after)) {
      continue;
    }
    if (/^(?:19|20)\d{2}$/.test(raw)) {
      continue;
    }

    const parsed = parseAmountToken(raw);
    if (!parsed) {
      continue;
    }

    // OCR often splits a time into `08.30`; reject those outside total lines.
    if (!allowTimeLikeAmount && /^\d{1,2}[.,]\d{2}$/.test(raw)) {
      const [hours, minutes] = raw.split(/[.,]/).map(Number);
      if (hours <= 23 && minutes <= 59) {
        continue;
      }
    }

    if (parsed.digitCount > 12 || parsed.cents > 1_000_000_000_000) {
      continue;
    }

    found.push(parsed);
  }

  return found;
}

function totalKeywordScore(line: string): number {
  let score = 0;

  if (TOTAL_KEYWORDS.some((pattern) => pattern.test(line))) {
    score = 120;
  } else if (WEAK_TOTAL_KEYWORDS.some((pattern) => pattern.test(line))) {
    score = 100;
  }

  if (score === 0) {
    return 0;
  }

  for (const pattern of NEGATIVE_TOTAL_KEYWORDS) {
    if (pattern.test(line)) {
      score -= 70;
    }
  }

  return Math.max(score, 0);
}

function extractAmount(
  text: string
): { cents: number | null; confidence: ParseConfidence } {
  const lines = splitLines(text);
  const usesRupiah = /\b(?:rp|idr)\b/i.test(text);
  const usesOtherCurrency = /[$€£]|\b(?:usd|eur|gbp|sgd|myr)\b/i.test(text);
  const candidates: AmountCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const keywordScore = totalKeywordScore(line);
    const allowTimeLikeAmount = keywordScore > 0;
    let tokens = collectAmountTokens(line, allowTimeLikeAmount);

    // Receipts frequently split `TOTAL` and the amount onto separate lines.
    if (tokens.length === 0 && keywordScore > 0 && lineIndex + 1 < lines.length) {
      tokens = collectAmountTokens(lines[lineIndex + 1], true);
    }

    if (tokens.length === 0) {
      return;
    }

    const hasNonAmountContext = NON_AMOUNT_CONTEXT.test(line);
    const hasItemContext = ITEM_CONTEXT.test(line);
    const fallbackEligible = !hasNonAmountContext && !hasItemContext;

    tokens.forEach((token) => {
      candidates.push({
        cents: token.cents,
        raw: '',
        lineIndex,
        keywordScore,
        fallbackEligible,
        hasDecimal: token.hasDecimal,
        digitCount: token.digitCount,
      });
    });
  });

  // Ignore tiny whole numbers such as `JUMLAH 2` (quantity) unless the
  // receipt clearly uses another currency where a $2 total is plausible.
  const isPlausible = (candidate: AmountCandidate) => {
    if (isWeakSmallInteger(candidate)) {
      return usesOtherCurrency && !usesRupiah ? true : false;
    }
    return candidate.cents >= 100;
  };

  const keywordCandidates = candidates
    .filter((candidate) => candidate.keywordScore > 0 && isPlausible(candidate))
    .sort((a, b) => {
      if (a.keywordScore !== b.keywordScore) {
        return a.keywordScore - b.keywordScore;
      }
      return a.lineIndex - b.lineIndex;
    });

  const best = keywordCandidates.at(-1);
  if (best) {
    return {
      cents: best.cents,
      confidence: best.keywordScore >= 100 ? 'high' : 'low',
    };
  }

  // Fall back to the largest plausible amount on the receipt.
  const fallback = candidates
    .filter((candidate) => candidate.fallbackEligible && isPlausible(candidate))
    .sort((a, b) => a.cents - b.cents)
    .at(-1);

  if (fallback) {
    return { cents: fallback.cents, confidence: 'low' };
  }

  return { cents: null, confidence: 'low' };
}

function isWeakSmallInteger(candidate: AmountCandidate): boolean {
  return !candidate.hasDecimal && candidate.digitCount <= 2 && candidate.keywordScore <= 100;
}

function createDate(year: number, month: number, day: number): Date | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? date : null;
}

function normalizeYear(value: number): number {
  return value < 100 ? 2000 + value : value;
}

function extractDateInfo(
  text: string,
  today: Date
): { value: string | null; confidence: ParseConfidence } {
  const lines = splitLines(text);
  const candidates: DateCandidate[] = [];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const addCandidate = (date: Date | null, lineIndex: number, hasTime: boolean, confidence: ParseConfidence) => {
    if (!date || date > tomorrow) {
      return;
    }

    const score =
      (hasTime ? 20 : 0) +
      (lineIndex < 6 ? 10 : 0) +
      (date.getFullYear() >= 2000 ? 2 : 0);

    candidates.push({ date, lineIndex, score, confidence });
  };

  lines.forEach((line, lineIndex) => {
    const hasTime = /\b\d{1,2}[:.]\d{2}(?::\d{2})?\b/.test(line);

    const numericPattern = /\b(\d{1,4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,4})\b/g;
    for (const match of line.matchAll(numericPattern)) {
      const [, firstRaw, secondRaw, thirdRaw] = match;
      const first = Number(firstRaw);
      const second = Number(secondRaw);
      const third = Number(thirdRaw);

      let year: number;
      let month: number;
      let day: number;

      if (firstRaw.length === 4) {
        year = first;
        month = second;
        day = third;
      } else if (first > 12 && second <= 12) {
        day = first;
        month = second;
        year = third;
      } else if (second > 12 && first <= 12) {
        month = first;
        day = second;
        year = third;
      } else {
        // Indonesian receipts are day-first; English receipts usually are too
        // when the month name is spelled out. For numeric dates we assume DMY.
        day = first;
        month = second;
        year = third;
      }

      const normalizedYear = normalizeYear(year);
      const date = createDate(normalizedYear, month, day);
      const confidence: ParseConfidence =
        thirdRaw.length === 4 || firstRaw.length === 4 ? 'high' : 'low';
      addCandidate(date, lineIndex, hasTime, confidence);
    }

    const wordPattern = /\b(\d{1,2})\s*[-/ ]\s*([a-z]{3,9})\.?\s*[-/ ,.]\s*(\d{2,4})\b/gi;
    for (const match of line.matchAll(wordPattern)) {
      const [, dayRaw, monthRaw, yearRaw] = match;
      const month = MONTHS[parseSettingValue(monthRaw)];
      if (!month) {
        continue;
      }

      const date = createDate(
        normalizeYear(Number(yearRaw)),
        month,
        Number(dayRaw)
      );
      addCandidate(
        date,
        lineIndex,
        hasTime,
        yearRaw.length === 4 ? 'high' : 'low'
      );
    }
  });

  if (candidates.length === 0) {
    return { value: null, confidence: 'low' };
  }

  candidates.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.date.getTime() - b.date.getTime();
  });

  const best = candidates[0];
  return { value: toDateString(best.date), confidence: best.confidence };
}

function extractMerchant(lines: string[]): string | null {
  for (const rawLine of lines.slice(0, 10)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (line.length < 3 || line.length > 48) {
      continue;
    }

    if (!/[a-z]{3}/i.test(line)) {
      continue;
    }

    if (/\d{2,}/.test(line)) {
      continue;
    }

    if (MERCHANT_IGNORE.test(line)) {
      continue;
    }

    const letterCount = (line.match(/[a-z]/gi) ?? []).length;
    if (letterCount / line.length < 0.5) {
      continue;
    }

    return toTitleCase(line);
  }

  return null;
}

function detectKind(text: string): ReceiptKind {
  const incomeScore = INCOME_SIGNALS.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0
  );
  const expenseScore = EXPENSE_SIGNALS.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0
  );

  return incomeScore > expenseScore ? 'income' : 'expense';
}

function suggestCategory(text: string, kind: ReceiptKind): string | null {
  const rules = kind === 'income' ? INCOME_CATEGORY_RULES : EXPENSE_CATEGORY_RULES;

  let best: { name: string; score: number } | null = null;

  for (const rule of rules) {
    const score = rule.keywords.reduce(
      (total, keyword) => total + (keyword.test(text) ? 1 : 0),
      0
    );

    if (score === 0) {
      continue;
    }

    if (!best || score > best.score) {
      best = { name: rule.name, score };
    }
  }

  return best?.name ?? null;
}

/**
 * Parses receipt OCR text. `options.kind` is the user-selected transaction
 * type; when omitted the text is used to guess.
 */
export function parseReceiptText(
  text: string,
  options: { kind?: ReceiptKind; today?: Date } = {}
): ParsedReceipt {
  const today = options.today ?? new Date();
  const kind = options.kind ?? detectKind(text);
  const amount = extractAmount(text);
  const date = extractDateInfo(text, today);
  const merchant = extractMerchant(splitLines(text));
  const suggestedCategoryName = suggestCategory(text, kind);
  const warnings: string[] = [];

  if (amount.cents === null) {
    warnings.push('Could not find the total. Enter the amount manually.');
  } else if (amount.confidence === 'low') {
    warnings.push('The total was inferred. Check the amount carefully.');
  }

  if (date.value === null) {
    warnings.push('Could not find the receipt date. Today was used.');
  } else if (date.confidence === 'low') {
    warnings.push('The receipt date may be ambiguous. Check it carefully.');
  }

  if (merchant === null) {
    warnings.push('Could not find the merchant name.');
  }

  return {
    kind,
    amountCents: amount.cents,
    amountConfidence: amount.confidence,
    occurredOn: date.value,
    dateConfidence: date.confidence,
    merchant,
    description: merchant,
    suggestedCategoryName,
    warnings,
    rawText: text,
  };
}
