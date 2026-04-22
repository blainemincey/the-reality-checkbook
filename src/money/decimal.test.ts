import { describe, it, expect } from 'vitest';
import { Cash, Quantity, Price } from './decimal';

describe('Cash', () => {
  it('constructs from string and renders 4 decimals', () => {
    expect(Cash.of('1234.56').toString()).toBe('1234.5600');
    expect(Cash.of('0').toString()).toBe('0.0000');
    expect(Cash.of('-1.005').toString()).toBe('-1.0050');
  });

  it('refuses number input', () => {
    // @ts-expect-error refusing number input at compile time too
    expect(() => Cash.of(1234.56)).toThrow(TypeError);
  });

  it('refuses empty string', () => {
    expect(() => Cash.of('')).toThrow(TypeError);
  });

  it('is exact across sum and difference (no float drift)', () => {
    const dime = Cash.of('0.10');
    let acc = Cash.zero();
    for (let i = 0; i < 10; i++) acc = acc.add(dime);
    expect(acc.toString()).toBe('1.0000');
    expect(acc.eq(Cash.of('1'))).toBe(true);
  });

  it('sum() aggregates correctly', () => {
    const items = ['0.1', '0.2', '0.3', '0.4', '-1.00'].map(Cash.of);
    expect(Cash.sum(items).toString()).toBe('0.0000');
    expect(Cash.sum(items).isZero()).toBe(true);
  });

  it('isNegative/isPositive/isZero honor signed zero', () => {
    expect(Cash.of('0').isZero()).toBe(true);
    expect(Cash.of('0').isNegative()).toBe(false);
    expect(Cash.of('0').isPositive()).toBe(false);
    expect(Cash.of('-0').isZero()).toBe(true);
    expect(Cash.of('-0').isNegative()).toBe(false);
  });

  it('comparisons', () => {
    const a = Cash.of('100.00');
    const b = Cash.of('100.0000');
    const c = Cash.of('99.9999');
    expect(a.eq(b)).toBe(true);
    expect(c.lt(a)).toBe(true);
    expect(a.gt(c)).toBe(true);
    expect(a.gte(b)).toBe(true);
    expect(c.lte(a)).toBe(true);
  });

  it('JSON serializes to fixed-scale string', () => {
    expect(JSON.stringify({ v: Cash.of('42.1') })).toBe('{"v":"42.1000"}');
  });

  it('handles scale-4 precision without leaking into scale-5', () => {
    // 4-decimal interest calc: $10,000 @ 0.0001 periodic = $1.0000 exact
    const principal = Cash.of('10000.0000');
    const interest = Cash.of('1.0001');
    const total = principal.add(interest);
    expect(total.toString()).toBe('10001.0001');
  });
});

describe('Quantity', () => {
  it('renders 10 decimals', () => {
    expect(Quantity.of('47.3218').toString()).toBe('47.3218000000');
    expect(Quantity.of('0.00012345').toString()).toBe('0.0001234500');
  });

  it('handles fractional share dividend reinvest precision', () => {
    const existing = Quantity.of('47.3218000000');
    const reinvested = Quantity.of('0.0471829300');
    const result = existing.add(reinvested);
    expect(result.toString()).toBe('47.3689829300');
  });
});

describe('Price', () => {
  it('renders 6 decimals', () => {
    expect(Price.of('123.45').toString()).toBe('123.450000');
  });
});

describe('Quantity x Price → Cash', () => {
  it('multiplies round numbers exactly', () => {
    expect(Quantity.of('10').mul(Price.of('20')).toString()).toBe('200.0000');
    expect(Quantity.of('1.5').mul(Price.of('10')).toString()).toBe('15.0000');
    expect(Quantity.of('100').mul(Price.of('1.2345')).toString()).toBe('123.4500');
  });

  it('carries full intermediate precision before rounding to Cash(4)', () => {
    // 47.3218 * 123.456789 = 5842.1974777002 (exact)
    const cash = Quantity.of('47.3218').mul(Price.of('123.456789'));
    expect(cash.toString()).toBe('5842.1975');
  });

  it('Price.mul(Quantity) equals Quantity.mul(Price)', () => {
    const qty = Quantity.of('10.5');
    const price = Price.of('20.20');
    expect(qty.mul(price).eq(price.mul(qty))).toBe(true);
  });
});
