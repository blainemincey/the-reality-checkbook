import { describe, it, expect } from 'vitest';
import { Cash } from '@/money';
import {
  balanceAsOf,
  registerRows,
  backfillPreview,
  reconciliationDelta,
  type AccountOpening,
  type LedgerTransaction,
} from './accounts';

const account: AccountOpening = {
  openingBalance: Cash.of('4231.07'),
  openingDate: '2026-11-01',
};

const tx = (
  id: string,
  date: string,
  amount: string,
  clearedState: LedgerTransaction['clearedState'] = 'uncleared',
): LedgerTransaction => ({
  id,
  txnDate: date,
  amount: Cash.of(amount),
  clearedState,
});

describe('balanceAsOf', () => {
  it('returns opening balance on opening date with no transactions', () => {
    expect(balanceAsOf(account, [], '2026-11-01').toString()).toBe('4231.0700');
  });

  it('applies transactions on or before asOf', () => {
    const txs = [
      tx('a', '2026-11-02', '-100.00'),
      tx('b', '2026-11-03', '-50.00'),
      tx('c', '2026-11-04', '200.00'), // after asOf
    ];
    // 4231.07 - 100 - 50 = 4081.07
    expect(balanceAsOf(account, txs, '2026-11-03').toString()).toBe('4081.0700');
  });

  it('ignores transactions dated before opening_date', () => {
    const txs = [tx('stale', '2026-10-01', '-999.99')];
    expect(balanceAsOf(account, txs, '2026-11-05').toString()).toBe('4231.0700');
  });

  it('throws when asOf predates opening_date', () => {
    expect(() => balanceAsOf(account, [], '2026-10-31')).toThrow(RangeError);
  });

  it('is exact across many small transactions (no float drift)', () => {
    const txs = Array.from({ length: 100 }, (_, i) => tx(`t${i}`, '2026-11-02', '-0.01'));
    // 4231.07 - 100 * 0.01 = 4230.07
    expect(balanceAsOf(account, txs, '2026-11-02').toString()).toBe('4230.0700');
  });
});

describe('registerRows', () => {
  it('produces a stable, dated register with per-row running balance', () => {
    const txs = [
      tx('c', '2026-11-04', '200.00'),
      tx('a', '2026-11-02', '-100.00'),
      tx('b', '2026-11-03', '-50.00'),
    ];
    const rows = registerRows(account, txs);

    expect(rows.map((r) => r.transaction.id)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.runningBalance.toString())).toEqual([
      '4131.0700',
      '4081.0700',
      '4281.0700',
    ]);
  });

  it('uses id as deterministic tiebreaker for same-day transactions', () => {
    const txs = [tx('z', '2026-11-02', '10.00'), tx('a', '2026-11-02', '20.00')];
    const rows = registerRows(account, txs);
    expect(rows.map((r) => r.transaction.id)).toEqual(['a', 'z']);
  });

  it('filters out transactions before opening_date', () => {
    const txs = [tx('stale', '2026-10-31', '-100.00'), tx('ok', '2026-11-02', '-100.00')];
    const rows = registerRows(account, txs);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.transaction.id).toBe('ok');
  });
});

describe('backfillPreview', () => {
  it('computes the bootstrap math summary the UI displays before commit', () => {
    // From the spec: opening $4,231.07 on Nov 1, 12 backfilled transactions
    // dated on/after opening_date, 6 uncleared totaling -$847.22.
    const backfill = [
      tx('u1', '2026-11-01', '-100.00', 'uncleared'),
      tx('u2', '2026-11-02', '-247.22', 'uncleared'),
      tx('u3', '2026-11-03', '-200.00', 'uncleared'),
      tx('u4', '2026-11-03', '-100.00', 'uncleared'),
      tx('u5', '2026-11-04', '-100.00', 'uncleared'),
      tx('u6', '2026-11-04', '-100.00', 'uncleared'),
      tx('c1', '2026-11-01', '-50.00', 'cleared'),
      tx('c2', '2026-11-01', '-60.00', 'cleared'),
      tx('c3', '2026-11-02', '-70.00', 'cleared'),
      tx('c4', '2026-11-02', '-80.00', 'cleared'),
      tx('c5', '2026-11-03', '-90.00', 'cleared'),
      tx('c6', '2026-11-03', '-100.00', 'cleared'),
    ];

    const preview = backfillPreview(account, backfill);

    expect(preview.backfillCount).toBe(12);
    expect(preview.unclearedCount).toBe(6);
    expect(preview.clearedCount).toBe(6);
    expect(preview.unclearedSum.toString()).toBe('-847.2200');
    expect(preview.clearedSum.toString()).toBe('-450.0000');
    expect(preview.backfillSum.toString()).toBe('-1297.2200');
    // 4231.07 + (-1297.22) = 2933.85
    expect(preview.projectedBalance.toString()).toBe('2933.8500');
    expect(preview.invalidDateCount).toBe(0);
  });

  it('counts pre-opening transactions separately without including them in sums', () => {
    const backfill = [
      tx('ok', '2026-11-05', '-10.00', 'uncleared'),
      tx('bad1', '2026-10-30', '-9999.99', 'uncleared'),
      tx('bad2', '2026-10-15', '-500.00', 'cleared'),
    ];
    const preview = backfillPreview(account, backfill);
    expect(preview.backfillCount).toBe(1);
    expect(preview.invalidDateCount).toBe(2);
    expect(preview.backfillSum.toString()).toBe('-10.0000');
    expect(preview.projectedBalance.toString()).toBe('4221.0700');
  });

  it('handles the empty backfill case', () => {
    const preview = backfillPreview(account, []);
    expect(preview.backfillCount).toBe(0);
    expect(preview.backfillSum.isZero()).toBe(true);
    expect(preview.projectedBalance.eq(account.openingBalance)).toBe(true);
    expect(preview.invalidDateCount).toBe(0);
  });
});

describe('reconciliationDelta', () => {
  it('reports balanced when cleared sum + opening equals statement balance', () => {
    const txs = [
      tx('a', '2026-11-02', '-100.00', 'cleared'),
      tx('b', '2026-11-05', '-50.00', 'cleared'),
      tx('c', '2026-11-10', '-25.00', 'uncleared'), // outstanding, doesn't count
    ];
    // opening 4231.07 + cleared (-150) = 4081.07
    const result = reconciliationDelta(account, txs, '2026-11-15', Cash.of('4081.07'));
    expect(result.isBalanced).toBe(true);
    expect(result.delta.toString()).toBe('0.0000');
  });

  it('reports signed delta when out of balance', () => {
    const txs = [tx('a', '2026-11-02', '-100.00', 'cleared')];
    // expected: 4131.07, statement says 4000 → delta 131.07
    const result = reconciliationDelta(account, txs, '2026-11-15', Cash.of('4000.00'));
    expect(result.isBalanced).toBe(false);
    expect(result.delta.toString()).toBe('131.0700');
  });

  it('excludes transactions dated after the statement date', () => {
    const txs = [
      tx('a', '2026-11-02', '-100.00', 'cleared'),
      tx('b', '2026-11-20', '-9999.00', 'cleared'), // after statement
    ];
    const result = reconciliationDelta(account, txs, '2026-11-15', Cash.of('4131.07'));
    expect(result.isBalanced).toBe(true);
  });

});
