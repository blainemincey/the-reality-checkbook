import { Cash } from '@/money';
import { parseCashInput } from '@/money';
import type { IsoDate } from '@/domain/accounts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ColumnType =
  | 'date'
  | 'payee'
  | 'amount'
  | 'memo'
  | 'check_number'
  | 'category'
  | 'ignored';

export interface ParsedColumn {
  readonly index: number;
  readonly header: string | null;
  readonly detectedType: ColumnType;
  readonly detectionConfidence: 'high' | 'medium' | 'low';
}

export interface ParsedRow {
  readonly rowIndex: number;
  readonly cells: readonly string[];
  readonly date: IsoDate | null;
  readonly dateError: string | null;
  readonly amount: Cash | null;
  readonly amountError: string | null;
  readonly payee: string;
  readonly memo: string | null;
  readonly checkNumber: string | null;
  readonly category: string | null;
}

export interface ParsedPaste {
  readonly hasHeader: boolean;
  readonly columns: readonly ParsedColumn[];
  readonly rows: readonly ParsedRow[];
  readonly warnings: readonly string[];
}

export interface ParseOptions {
  /** User-provided column-type overrides by column index (wins over detection). */
  readonly columnOverrides?: Readonly<Record<number, ColumnType>>;
  /** Force header detection result (bypasses auto-detection). */
  readonly hasHeader?: boolean;
  /**
   * Year-interpretation cutoff for 2-digit years. A 2-digit year below this
   * is treated as 2000+yy, at/above as 1900+yy. Default 70.
   */
  readonly twoDigitYearCutoff?: number;
}

// ---------------------------------------------------------------------------
// Lexing: split pasted text into a table of string cells
// ---------------------------------------------------------------------------

/**
 * Split pasted clipboard text into rows of cells. Google Sheets copies as TSV
 * (tab-delimited). We also tolerate CSV-style quoted fields for robustness.
 * Windows/Unix line endings both handled.
 */
export function tokenize(raw: string): string[][] {
  const text = raw.replace(/\r\n?/g, '\n');
  // Strip a single trailing newline if present so we don't emit an empty row.
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (trimmed === '') return [];

  // Delimiter detection: if any unquoted line contains a tab, treat as TSV;
  // else assume CSV with commas. Pasted spreadsheet content is almost always TSV.
  const looksLikeTsv = /(^|[^"])\t/.test(trimmed);

  if (looksLikeTsv) {
    return trimmed.split('\n').map((line) => line.split('\t'));
  }
  return parseCsv(trimmed);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell === '') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cell);
        cell = '';
      } else if (ch === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<ColumnType, readonly string[]> = {
  date: ['date', 'txn date', 'transaction date', 'posted', 'posted date', 'when'],
  payee: ['payee', 'description', 'vendor', 'merchant', 'name', 'who', 'transaction'],
  amount: ['amount', 'value', 'total'],
  memo: ['memo', 'notes', 'note', 'comment', 'comments', 'details'],
  check_number: ['check', 'check #', 'check number', 'check no', 'cheque', 'ref', 'reference'],
  category: ['category', 'type', 'tag'],
  ignored: [],
};

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyHeader(header: string): ColumnType {
  const norm = normalizeHeader(header);
  if (norm === '') return 'ignored';

  // Split-column debit/credit tables aren't supported in v1; we fold them to
  // 'amount' and let the detector/overrides catch it.
  if (norm === 'debit' || norm === 'credit' || norm === 'withdrawal' || norm === 'deposit') {
    return 'amount';
  }

  for (const [type, aliases] of Object.entries(HEADER_ALIASES) as [ColumnType, readonly string[]][]) {
    for (const alias of aliases) {
      if (norm === alias || norm.includes(alias)) return type;
    }
  }
  return 'ignored';
}

function looksLikeHeaderRow(row: readonly string[]): boolean {
  if (row.length === 0) return false;
  let matches = 0;
  for (const cell of row) {
    const type = classifyHeader(cell);
    if (type !== 'ignored') matches++;
    // A header row must also not parse as a data row — e.g., no cell should be
    // an obvious amount or date.
    if (parseCashInput(cell).ok) return false;
    if (parseAnyDate(cell) !== null) return false;
  }
  return matches >= Math.max(1, Math.ceil(row.length / 3));
}

// ---------------------------------------------------------------------------
// Column-type detection (when there's no header)
// ---------------------------------------------------------------------------

function detectColumnType(
  samples: readonly string[],
): { type: ColumnType; confidence: 'high' | 'medium' | 'low' } {
  const nonEmpty = samples.filter((s) => s.trim() !== '');
  if (nonEmpty.length === 0) return { type: 'ignored', confidence: 'low' };

  const dateHits = nonEmpty.filter((s) => parseAnyDate(s) !== null).length;
  const amountHits = nonEmpty.filter((s) => parseCashInput(s).ok).length;

  const dateRatio = dateHits / nonEmpty.length;
  const amountRatio = amountHits / nonEmpty.length;

  if (dateRatio >= 0.8) return { type: 'date', confidence: dateRatio === 1 ? 'high' : 'medium' };
  if (amountRatio >= 0.8)
    return { type: 'amount', confidence: amountRatio === 1 ? 'high' : 'medium' };

  // Short-numeric columns are likely check numbers.
  const shortNumHits = nonEmpty.filter((s) => /^\d{1,6}$/.test(s.trim())).length;
  if (shortNumHits / nonEmpty.length >= 0.8) {
    return { type: 'check_number', confidence: 'medium' };
  }

  // The widest text column (by avg length) is the payee.
  return { type: 'payee', confidence: 'low' };
}

// ---------------------------------------------------------------------------
// Date parsing: ISO YYYY-MM-DD, US MDY with 2 or 4 digit year, both / and -
// ---------------------------------------------------------------------------

const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const MDY_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/;

export function parseAnyDate(input: string, twoDigitYearCutoff = 70): IsoDate | null {
  const s = input.trim();
  if (!s) return null;

  const iso = s.match(ISO_RE);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    return assembleDate(y, m, d);
  }

  const mdy = s.match(MDY_RE);
  if (mdy) {
    const m = Number(mdy[1]);
    const d = Number(mdy[2]);
    let y = Number(mdy[3]);
    if (mdy[3]!.length === 2) {
      y = y < twoDigitYearCutoff ? 2000 + y : 1900 + y;
    }
    return assembleDate(y, m, d);
  }

  return null;
}

function assembleDate(y: number, m: number, d: number): IsoDate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Confirm the date is real (JS Date rolls over, e.g. Feb 30 → Mar 2).
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function parsePaste(raw: string, options: ParseOptions = {}): ParsedPaste {
  const warnings: string[] = [];
  const table = tokenize(raw);
  if (table.length === 0) {
    return { hasHeader: false, columns: [], rows: [], warnings: ['empty input'] };
  }

  // Normalize row widths to the max column count so column-index math is stable.
  const width = Math.max(...table.map((r) => r.length));
  const padded: string[][] = table.map((r) => {
    const out = [...r];
    while (out.length < width) out.push('');
    return out;
  });

  const firstRow = padded[0]!;
  const hasHeader = options.hasHeader ?? looksLikeHeaderRow(firstRow);
  const dataRows = hasHeader ? padded.slice(1) : padded;

  // Build columns: for each index, pick header-driven type, then override with
  // detection, then user override.
  const columns: ParsedColumn[] = [];
  for (let i = 0; i < width; i++) {
    const header = hasHeader ? firstRow[i]!.trim() : null;
    const samples = dataRows.map((r) => r[i] ?? '');
    const detected = detectColumnType(samples);
    const typeFromHeader = header ? classifyHeader(header) : 'ignored';

    let detectedType: ColumnType;
    let confidence: 'high' | 'medium' | 'low';
    if (typeFromHeader !== 'ignored') {
      detectedType = typeFromHeader;
      confidence = 'high';
    } else {
      detectedType = detected.type;
      confidence = detected.confidence;
    }

    const override = options.columnOverrides?.[i];
    if (override !== undefined) {
      detectedType = override;
      confidence = 'high';
    }

    columns.push({ index: i, header, detectedType, detectionConfidence: confidence });
  }

  // Ensure at most one column of each singleton type (date, amount, payee, memo,
  // check_number, category). If multiple, keep the first and demote the rest.
  for (const type of ['date', 'amount', 'payee', 'memo', 'check_number', 'category'] as const) {
    const indexes = columns.filter((c) => c.detectedType === type).map((c) => c.index);
    if (indexes.length > 1) {
      warnings.push(`Multiple '${type}' columns detected; using column ${indexes[0]}`);
      for (const idx of indexes.slice(1)) {
        const col = columns[idx]!;
        columns[idx] = { ...col, detectedType: 'ignored', detectionConfidence: 'low' };
      }
    }
  }

  const byType = (t: ColumnType) => columns.find((c) => c.detectedType === t)?.index ?? -1;
  const dateIdx = byType('date');
  const amountIdx = byType('amount');
  const payeeIdx = byType('payee');
  const memoIdx = byType('memo');
  const checkIdx = byType('check_number');
  const categoryIdx = byType('category');

  const parsedRows: ParsedRow[] = dataRows.map((cells, i) => {
    const getCell = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');

    let date: IsoDate | null = null;
    let dateError: string | null = null;
    if (dateIdx >= 0) {
      const raw = getCell(dateIdx);
      if (raw === '') {
        dateError = 'missing date';
      } else {
        date = parseAnyDate(raw, options.twoDigitYearCutoff);
        if (!date) dateError = `unparseable date: "${raw}"`;
      }
    } else {
      dateError = 'no date column mapped';
    }

    let amount: Cash | null = null;
    let amountError: string | null = null;
    if (amountIdx >= 0) {
      const raw = getCell(amountIdx);
      if (raw === '') {
        amountError = 'missing amount';
      } else {
        const parsed = parseCashInput(raw);
        if (parsed.ok && parsed.value) amount = parsed.value;
        else amountError = parsed.error ?? `unparseable amount: "${raw}"`;
      }
    } else {
      amountError = 'no amount column mapped';
    }

    return {
      rowIndex: i,
      cells,
      date,
      dateError,
      amount,
      amountError,
      payee: getCell(payeeIdx),
      memo: memoIdx >= 0 ? getCell(memoIdx) || null : null,
      checkNumber: checkIdx >= 0 ? getCell(checkIdx) || null : null,
      category: categoryIdx >= 0 ? getCell(categoryIdx) || null : null,
    };
  });

  return { hasHeader, columns, rows: parsedRows, warnings };
}
