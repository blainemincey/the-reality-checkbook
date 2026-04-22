import { describe, it, expect } from 'vitest';
import { tokenize, parseAnyDate, parsePaste } from './paste-parser';

describe('tokenize', () => {
  it('splits TSV (Google Sheets clipboard default)', () => {
    const raw = 'Date\tPayee\tAmount\n11/2/2026\tTarget\t-45.67';
    expect(tokenize(raw)).toEqual([
      ['Date', 'Payee', 'Amount'],
      ['11/2/2026', 'Target', '-45.67'],
    ]);
  });

  it('handles CRLF line endings', () => {
    const raw = 'a\tb\r\nc\td\r\n';
    expect(tokenize(raw)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles CSV with quoted fields containing commas', () => {
    const raw = 'Date,Payee,Amount\n2026-11-02,"Target, Inc",-45.67';
    expect(tokenize(raw)).toEqual([
      ['Date', 'Payee', 'Amount'],
      ['2026-11-02', 'Target, Inc', '-45.67'],
    ]);
  });

  it('handles CSV with escaped quotes', () => {
    const raw = 'a,"she said ""hi""",c';
    expect(tokenize(raw)).toEqual([['a', 'she said "hi"', 'c']]);
  });

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('parseAnyDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseAnyDate('2026-11-02')).toBe('2026-11-02');
    expect(parseAnyDate('2026-1-2')).toBe('2026-01-02');
  });

  it('parses MDY with slashes', () => {
    expect(parseAnyDate('11/2/2026')).toBe('2026-11-02');
    expect(parseAnyDate('1/1/2026')).toBe('2026-01-01');
    expect(parseAnyDate('12/31/2025')).toBe('2025-12-31');
  });

  it('parses MDY with dashes', () => {
    expect(parseAnyDate('11-02-2026')).toBe('2026-11-02');
  });

  it('handles 2-digit years via cutoff', () => {
    expect(parseAnyDate('1/1/26')).toBe('2026-01-01');
    expect(parseAnyDate('1/1/99')).toBe('1999-01-01');
    expect(parseAnyDate('1/1/70')).toBe('1970-01-01');
  });

  it('rejects invalid dates (Feb 30, month 13)', () => {
    expect(parseAnyDate('2/30/2026')).toBeNull();
    expect(parseAnyDate('13/1/2026')).toBeNull();
    expect(parseAnyDate('2026-13-01')).toBeNull();
  });

  it('returns null for non-date input', () => {
    expect(parseAnyDate('hello')).toBeNull();
    expect(parseAnyDate('')).toBeNull();
    expect(parseAnyDate('45.67')).toBeNull();
  });
});

describe('parsePaste', () => {
  it('parses the realistic Google Sheets copy case with a header', () => {
    const raw = [
      'Date\tPayee\tAmount\tMemo',
      '11/1/2026\tTarget\t-45.67\tgroceries',
      '11/2/2026\tDirect Deposit\t2500.00\tpaycheck',
      '11/3/2026\tElectric Co\t(125.00)\tbill',
    ].join('\n');

    const result = parsePaste(raw);
    expect(result.hasHeader).toBe(true);
    expect(result.rows).toHaveLength(3);
    expect(result.columns.map((c) => c.detectedType)).toEqual([
      'date',
      'payee',
      'amount',
      'memo',
    ]);

    const [r0, r1, r2] = result.rows;
    expect(r0!.date).toBe('2026-11-01');
    expect(r0!.amount!.toString()).toBe('-45.6700');
    expect(r0!.payee).toBe('Target');
    expect(r0!.memo).toBe('groceries');

    expect(r1!.amount!.toString()).toBe('2500.0000');
    expect(r2!.amount!.toString()).toBe('-125.0000');
    expect(result.warnings).toEqual([]);
  });

  it('parses headerless data by heuristic column detection', () => {
    const raw = [
      '11/1/2026\tTarget\t-45.67',
      '11/2/2026\tDirect Deposit\t2500.00',
      '11/3/2026\tElectric Co\t-125.00',
    ].join('\n');

    const result = parsePaste(raw);
    expect(result.hasHeader).toBe(false);
    expect(result.rows).toHaveLength(3);
    expect(result.columns[0]!.detectedType).toBe('date');
    expect(result.columns[1]!.detectedType).toBe('payee');
    expect(result.columns[2]!.detectedType).toBe('amount');
  });

  it('surfaces per-row errors for unparseable cells without rejecting the whole paste', () => {
    const raw = [
      'Date\tPayee\tAmount',
      'not-a-date\tTarget\t-45.67',
      '11/2/2026\tDirect Deposit\tnot-a-number',
      '11/3/2026\tValid\t-50.00',
    ].join('\n');

    const result = parsePaste(raw);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]!.dateError).toMatch(/unparseable date/);
    expect(result.rows[0]!.amount!.toString()).toBe('-45.6700');
    expect(result.rows[1]!.amountError).toMatch(/unparseable/);
    expect(result.rows[1]!.date).toBe('2026-11-02');
    expect(result.rows[2]!.date).toBe('2026-11-03');
    expect(result.rows[2]!.amount!.toString()).toBe('-50.0000');
  });

  it('respects user column overrides over detection', () => {
    const raw = [
      'WhenThing\tWho\tHowMuch',
      '2026-11-01\tTarget\t-45.67',
    ].join('\n');

    // Headers don't match known aliases so detection falls through to samples.
    // With overrides, force the mapping.
    const result = parsePaste(raw, {
      columnOverrides: { 0: 'date', 1: 'payee', 2: 'amount' },
    });
    expect(result.rows[0]!.date).toBe('2026-11-01');
    expect(result.rows[0]!.payee).toBe('Target');
    expect(result.rows[0]!.amount!.toString()).toBe('-45.6700');
  });

  it('demotes duplicate singleton columns with a warning', () => {
    const raw = ['Date\tAmount\tAmount\t2026-11-01\t-45.67\t-99.99'].join('\n');
    // Single row — simpler fixture:
    const lines = ['Date\tAmount\tAmount', '2026-11-01\t-45.67\t-99.99'].join('\n');
    const result = parsePaste(lines);
    expect(result.warnings.some((w) => w.includes("'amount'"))).toBe(true);
    const amountCols = result.columns.filter((c) => c.detectedType === 'amount');
    expect(amountCols).toHaveLength(1);
  });

  it('recognizes debit/credit header cells as amount', () => {
    const raw = ['Date\tPayee\tDebit', '11/1/2026\tTarget\t45.67'].join('\n');
    const result = parsePaste(raw);
    expect(result.columns[2]!.detectedType).toBe('amount');
    expect(result.rows[0]!.amount!.toString()).toBe('45.6700');
  });

  it('detects a check-number column', () => {
    const raw = [
      'Date\tCheck\tPayee\tAmount',
      '11/1/2026\t1042\tLandlord\t-1500.00',
    ].join('\n');
    const result = parsePaste(raw);
    expect(result.columns[1]!.detectedType).toBe('check_number');
    expect(result.rows[0]!.checkNumber).toBe('1042');
  });

  it('handles extra noise columns gracefully (ignored type)', () => {
    const raw = [
      'Date\tPayee\tAmount\tCategory\tBalance',
      '11/1/2026\tTarget\t-45.67\tGroceries\t$3,950.00',
    ].join('\n');
    const result = parsePaste(raw);
    // Category mapped; Balance has no known header → amount-detected but
    // demoted due to duplicate, so it becomes ignored.
    expect(result.columns[3]!.detectedType).toBe('category');
    expect(result.rows[0]!.category).toBe('Groceries');
  });

  it('flags an empty input', () => {
    const result = parsePaste('');
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toContain('empty input');
  });

  it('reports missing columns as row-level errors, not a global failure', () => {
    const raw = ['Payee\tAmount', 'Target\t-45.67'].join('\n');
    const result = parsePaste(raw);
    expect(result.rows[0]!.dateError).toBe('no date column mapped');
    expect(result.rows[0]!.amount!.toString()).toBe('-45.6700');
  });

  it('tolerates rows with missing trailing cells', () => {
    const raw = [
      'Date\tPayee\tAmount\tMemo',
      '11/1/2026\tTarget\t-45.67\t',
      '11/2/2026\tBudget Item\t-10.00',
    ].join('\n');
    const result = parsePaste(raw);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.memo).toBe(null);
    expect(result.rows[1]!.memo).toBe(null);
  });
});
