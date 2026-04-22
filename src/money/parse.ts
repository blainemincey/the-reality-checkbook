import { Cash, Quantity, Price } from './decimal';

export interface ParseResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const CASH_INPUT = /^[\s]*(?<sign>[-+(])?[\s]*\$?[\s]*(?<digits>[\d,]+(?:\.\d+)?)[\s]*\)?[\s]*$/;

export function parseCashInput(input: string): ParseResult<Cash> {
  if (typeof input !== 'string') {
    return { ok: false, error: 'parseCashInput: expected string' };
  }
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };

  const match = trimmed.match(CASH_INPUT);
  if (!match?.groups) return { ok: false, error: `unparseable: "${input}"` };

  const parenNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const signChar = match.groups['sign'] ?? (parenNegative ? '-' : '');
  const digits = (match.groups['digits'] ?? '').replace(/,/g, '');

  if (!digits || digits === '.') return { ok: false, error: `no digits in "${input}"` };

  const sign = signChar === '-' || signChar === '(' ? '-' : '';
  try {
    return { ok: true, value: Cash.of(`${sign}${digits}`) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function parseQuantityInput(input: string): ParseResult<Quantity> {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };
  const cleaned = trimmed.replace(/,/g, '');
  try {
    return { ok: true, value: Quantity.of(cleaned) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function parsePriceInput(input: string): ParseResult<Price> {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };
  const cleaned = trimmed.replace(/[,$\s]/g, '');
  try {
    return { ok: true, value: Price.of(cleaned) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
