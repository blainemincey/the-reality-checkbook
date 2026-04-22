import { Cash } from './decimal';

type CurrencyCode = 'USD';

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  USD: '$',
};

export interface FormatCashOptions {
  currency?: CurrencyCode;
  displayScale?: number;
  signDisplay?: 'auto' | 'always' | 'negative-only';
}

export function formatCash(cash: Cash, options: FormatCashOptions = {}): string {
  const currency: CurrencyCode = options.currency ?? 'USD';
  const scale = options.displayScale ?? 2;
  const signDisplay = options.signDisplay ?? 'negative-only';

  const rounded = cash.toFixed(scale);
  const isNegative = rounded.startsWith('-');
  const absStr = isNegative ? rounded.slice(1) : rounded;

  const dotIndex = absStr.indexOf('.');
  const intPart = dotIndex === -1 ? absStr : absStr.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? '' : absStr.slice(dotIndex + 1);

  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numeric = fracPart ? `${withThousands}.${fracPart}` : withThousands;

  const symbol = CURRENCY_SYMBOL[currency];
  const body = `${symbol}${numeric}`;

  if (isNegative) return `-${body}`;
  if (signDisplay === 'always' && !cash.isZero()) return `+${body}`;
  return body;
}

export function formatSigned(cash: Cash, options: FormatCashOptions = {}): string {
  return formatCash(cash, { ...options, signDisplay: 'always' });
}
