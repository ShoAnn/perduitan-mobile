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
  /** i18n keys for the caveats the user should review. */
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

/**
 * Rupiah is written glued to the amount (`Rp14.000`), so `\brp\b` never matches
 * because there is no word boundary between `p` and the following digit.
 */
const RUPIAH_HINT = /\brp\.?\s*\d|\bidr\b/i;

const MERCHANT_IGNORE =
  /\b(?:struk|receipt|invoice|nota|faktur|kwitansi|kasir|cashier|terima\s*kasih|thank\s*you|selamat\s*datang|welcome|jl\.?|jalan|telp|tel|phone|npwp|rt\/rw|kec|kab|kota|provinsi|transfer|pembayaran|payment|bukti|tanda\s*terima|detail|rincian|menyimpan|hemat|cashback|saldo|sisa|kembalian)\b/i;

/**
 * Wallet and payment-app brands rendered as a logo line (for example the `gopay`
 * on a GoPay receipt). Skipped in favour of a real business name, but kept as a
 * last resort so a brand-only receipt still yields something.
 */
const PAYMENT_APP_BRAND =
  /\b(?:gopay|gojek|go-pay|ovo|dana|shopeepay|shopee\s*pay|linkaja|qris|flip|jenius|seabank)\b/i;

/** Money, date, time, and phone/account numbers disqualify a merchant line. */
const MERCHANT_NUMBER_CONTEXT =
  /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{1,4}\s*[/.-]\s*\d{1,2}(?:\s*[/.-]\s*\d{1,4})?\b|\b\d{4,}\b|\b\d{1,2}[:.]\d{2}(?::\d{2})?\b/;

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
 * Resolves the group after a single separator into a normalized numeric string.
 * Rupiah amounts have no meaningful fractional part, so a short trailing group
 * is a thousands group that OCR shortened (`14.0`, `14.00`) or lengthened
 * (`14.0000`) rather than a decimal.
 */
function resolveSeparatorGroup(
  integer: string,
  fraction: string,
  rupiah: boolean
): { normalized: string; hasDecimal: boolean } {
  if (rupiah) {
    if (fraction.length > 0 && fraction.length <= 2) {
      return { normalized: `${integer}${fraction.padEnd(3, '0')}`, hasDecimal: false };
    }
    if (fraction.length >= 4 && /^0+$/.test(fraction)) {
      return { normalized: `${integer}000`, hasDecimal: false };
    }
    return { normalized: `${integer}${fraction}`, hasDecimal: false };
  }

  if (fraction.length > 0 && fraction.length <= 2) {
    return { normalized: `${integer}.${fraction}`, hasDecimal: true };
  }

  return { normalized: `${integer}${fraction}`, hasDecimal: false };
}

/**
 * Parses a single amount token using the separator conventions found on
 * Indonesian and English receipts:
 *
 * - `45.500` / `45,500` -> 45,500 (thousands)
 * - `1.234.567,89` / `1,234,567.89` -> 1,234,567.89
 * - `12,50` / `12.50` -> 12.50
 *
 * A decimal part is at most two digits; a longer group is treated as
 * thousands so a garbled `14.0000` never collapses back to `14`.
 *
 * Pass `{ rupiah: true }` for receipts that use Rupiah, where a trailing group
 * is always a thousands group: `14.0` / `14.00` / `14.0000` all read as 14,000.
 */
export function parseAmountToken(
  token: string,
  options: { rupiah?: boolean } = {}
): ParsedNumber | null {
  const { rupiah = false } = options;
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
      const resolved = resolveSeparatorGroup(integer, fraction, rupiah);
      normalized = resolved.normalized;
      hasDecimal = resolved.hasDecimal;
    }
  } else if (lastComma !== -1) {
    const parts = raw.split(',');
    if (parts.length > 2) {
      normalized = parts.join('');
    } else {
      const [integer, fraction] = parts;
      const resolved = resolveSeparatorGroup(integer, fraction, rupiah);
      normalized = resolved.normalized;
      hasDecimal = resolved.hasDecimal;
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
function collectAmountTokens(
  line: string,
  allowTimeLikeAmount = false,
  rupiah = false
): ParsedNumber[] {
  // OCR often splits a grouped number around its separator (`15. 000`,
  // `15 .000`) or between digit runs (`15 000`); rejoin them so the whole
  // amount is read as a single token instead of just its integer part.
  const normalizedSpaces = line
    .replace(/([.,])\s+(?=\d)/g, '$1')
    .replace(/(\d)\s+(?=[.,]\d)/g, '$1')
    .replace(/(\d)\s+(?=\d)/g, '$1');
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

    const parsed = parseAmountToken(raw, { rupiah });
    if (!parsed) {
      continue;
    }

    // OCR often splits a time into `08.30`; reject those outside total lines.
    // A Rupiah group of zeros (`14.00`) is a thousands group, not a clock time.
    const isRupiahThousandsGroup = rupiah && /^\d{1,2}[.,]0+$/.test(raw);
    if (!allowTimeLikeAmount && !isRupiahThousandsGroup && /^\d{1,2}[.,]\d{2}$/.test(raw)) {
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
  const usesRupiah = RUPIAH_HINT.test(text);
  const usesOtherCurrency = /[$€£]|\b(?:usd|eur|gbp|sgd|myr)\b/i.test(text);
  const candidates: AmountCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const keywordScore = totalKeywordScore(line);
    const allowTimeLikeAmount = keywordScore > 0;
    let tokens = collectAmountTokens(line, allowTimeLikeAmount, usesRupiah);

    // Receipts frequently split `TOTAL` and the amount onto separate lines.
    if (tokens.length === 0 && keywordScore > 0 && lineIndex + 1 < lines.length) {
      tokens = collectAmountTokens(lines[lineIndex + 1], true, usesRupiah);
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

function isMerchantCandidate(line: string): boolean {
  if (line.length < 3 || line.length > 48) {
    return false;
  }

  if (!/[a-z]{3}/i.test(line)) {
    return false;
  }

  // Reject money, dates, and phone numbers, but keep business names that merely
  // contain a branch number such as `WARTEG PESONA 21`.
  if (MERCHANT_NUMBER_CONTEXT.test(line)) {
    return false;
  }

  if (MERCHANT_IGNORE.test(line)) {
    return false;
  }

  const letterCount = (line.match(/[a-z]/gi) ?? []).length;
  return letterCount / line.length >= 0.5;
}

function extractMerchantInfo(lines: string[]): {
  merchant: string | null;
  service: string | null;
} {
  const window = lines.slice(0, 10).map((raw) => raw.replace(/\s+/g, ' ').trim());

  // The wallet/app brand line (`gopay`) names the service, while the first
  // other business-like line names the merchant. Both are kept so the
  // description can read `Gopay - Warteg Pesona 21`.
  const service = window.find((line) => PAYMENT_APP_BRAND.test(line) && isMerchantCandidate(line));
  const merchant = window.find((line) => !PAYMENT_APP_BRAND.test(line) && isMerchantCandidate(line));

  return {
    merchant: merchant ? toTitleCase(merchant) : null,
    service: service ? toTitleCase(service) : null,
  };
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
  const { merchant, service } = extractMerchantInfo(splitLines(text));
  const description = service
    ? merchant
      ? `${service} - ${merchant}`
      : service
    : merchant;
  const suggestedCategoryName = suggestCategory(text, kind);
  const warnings: string[] = [];

  if (amount.cents === null) {
    warnings.push('receipt.warnings.amountMissing');
  } else if (amount.confidence === 'low') {
    warnings.push('receipt.warnings.amountInferred');
  }

  if (date.value === null) {
    warnings.push('receipt.warnings.dateMissing');
  } else if (date.confidence === 'low') {
    warnings.push('receipt.warnings.dateAmbiguous');
  }

  if (description === null) {
    warnings.push('receipt.warnings.merchantMissing');
  }

  return {
    kind,
    amountCents: amount.cents,
    amountConfidence: amount.confidence,
    occurredOn: date.value,
    dateConfidence: date.confidence,
    merchant,
    description,
    suggestedCategoryName,
    warnings,
    rawText: text,
  };
}
