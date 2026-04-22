import { describe, it, expect } from 'vitest';
import { Cash } from './decimal';
import { formatCash, formatSigned } from './format';

describe('formatCash', () => {
  it('formats USD with thousands separators and 2 decimals by default', () => {
    expect(formatCash(Cash.of('1234.56'))).toBe('$1,234.56');
    expect(formatCash(Cash.of('0'))).toBe('$0.00');
    expect(formatCash(Cash.of('1000000'))).toBe('$1,000,000.00');
  });

  it('negative values get a leading minus (sign + symbol)', () => {
    expect(formatCash(Cash.of('-1234.56'))).toBe('-$1,234.56');
    expect(formatCash(Cash.of('-0.01'))).toBe('-$0.01');
  });

  it('rounds to 2 display decimals banker-style from the 4-decimal store', () => {
    expect(formatCash(Cash.of('1.005'))).toBe('$1.00');
    expect(formatCash(Cash.of('1.015'))).toBe('$1.02');
    expect(formatCash(Cash.of('1.125'))).toBe('$1.12');
    expect(formatCash(Cash.of('1.135'))).toBe('$1.14');
  });

  it('displayScale lets us render the full 4 decimals if needed', () => {
    expect(formatCash(Cash.of('1234.5678'), { displayScale: 4 })).toBe('$1,234.5678');
  });

  it('formatSigned always shows + for positive', () => {
    expect(formatSigned(Cash.of('100'))).toBe('+$100.00');
    expect(formatSigned(Cash.of('-100'))).toBe('-$100.00');
    expect(formatSigned(Cash.of('0'))).toBe('$0.00');
  });
});
