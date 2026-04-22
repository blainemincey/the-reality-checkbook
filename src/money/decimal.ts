import Decimal from 'decimal.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -40,
  toExpPos: 40,
});

const CASH_SCALE = 4;
const QUANTITY_SCALE = 10;
const PRICE_SCALE = 6;

type DecimalInput = string | Decimal;

function toDecimal(input: DecimalInput, context: string): Decimal {
  if (typeof input === 'number') {
    throw new TypeError(`${context}: refusing number input. Pass a string or Decimal.`);
  }
  if (input instanceof Decimal) return input;
  if (typeof input !== 'string' || input.trim() === '') {
    throw new TypeError(`${context}: expected non-empty string, got ${typeof input}`);
  }
  const d = new Decimal(input);
  if (!d.isFinite()) throw new RangeError(`${context}: non-finite value "${input}"`);
  return d;
}

export class Cash {
  private readonly d: Decimal;

  private constructor(d: Decimal) {
    this.d = d;
  }

  static of(input: DecimalInput): Cash {
    return new Cash(toDecimal(input, 'Cash.of'));
  }

  static zero(): Cash {
    return new Cash(new Decimal(0));
  }

  static sum(items: readonly Cash[]): Cash {
    return items.reduce((acc, c) => acc.add(c), Cash.zero());
  }

  add(other: Cash): Cash {
    return new Cash(this.d.add(other.d));
  }

  sub(other: Cash): Cash {
    return new Cash(this.d.sub(other.d));
  }

  neg(): Cash {
    return new Cash(this.d.neg());
  }

  abs(): Cash {
    return new Cash(this.d.abs());
  }

  eq(other: Cash): boolean {
    return this.d.eq(other.d);
  }
  lt(other: Cash): boolean {
    return this.d.lt(other.d);
  }
  lte(other: Cash): boolean {
    return this.d.lte(other.d);
  }
  gt(other: Cash): boolean {
    return this.d.gt(other.d);
  }
  gte(other: Cash): boolean {
    return this.d.gte(other.d);
  }

  isZero(): boolean {
    return this.d.isZero();
  }
  isNegative(): boolean {
    return this.d.isNegative() && !this.d.isZero();
  }
  isPositive(): boolean {
    return this.d.isPositive() && !this.d.isZero();
  }

  toString(): string {
    return this.d.toFixed(CASH_SCALE);
  }

  toJSON(): string {
    return this.toString();
  }

  toFixed(scale: number): string {
    return this.d.toFixed(scale);
  }

  rawDecimal(): Decimal {
    return this.d;
  }
}

export class Quantity {
  private readonly d: Decimal;

  private constructor(d: Decimal) {
    this.d = d;
  }

  static of(input: DecimalInput): Quantity {
    return new Quantity(toDecimal(input, 'Quantity.of'));
  }

  static zero(): Quantity {
    return new Quantity(new Decimal(0));
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.d.add(other.d));
  }

  sub(other: Quantity): Quantity {
    return new Quantity(this.d.sub(other.d));
  }

  neg(): Quantity {
    return new Quantity(this.d.neg());
  }

  mul(price: Price): Cash {
    return Cash.of(this.d.mul(price.rawDecimal()));
  }

  eq(other: Quantity): boolean {
    return this.d.eq(other.d);
  }
  isZero(): boolean {
    return this.d.isZero();
  }
  isNegative(): boolean {
    return this.d.isNegative() && !this.d.isZero();
  }

  toString(): string {
    return this.d.toFixed(QUANTITY_SCALE);
  }

  toJSON(): string {
    return this.toString();
  }

  rawDecimal(): Decimal {
    return this.d;
  }
}

export class Price {
  private readonly d: Decimal;

  private constructor(d: Decimal) {
    this.d = d;
  }

  static of(input: DecimalInput): Price {
    return new Price(toDecimal(input, 'Price.of'));
  }

  static zero(): Price {
    return new Price(new Decimal(0));
  }

  mul(quantity: Quantity): Cash {
    return Cash.of(this.d.mul(quantity.rawDecimal()));
  }

  eq(other: Price): boolean {
    return this.d.eq(other.d);
  }

  toString(): string {
    return this.d.toFixed(PRICE_SCALE);
  }

  toJSON(): string {
    return this.toString();
  }

  rawDecimal(): Decimal {
    return this.d;
  }
}

export const MoneyScale = {
  cash: CASH_SCALE,
  quantity: QUANTITY_SCALE,
  price: PRICE_SCALE,
} as const;
