import { describe, it, expect } from 'vitest';
import { Cash } from '@/money';
import {
  monthlyCashflow,
  topPayees,
  spendingByKind,
  type ReportTxn,
} from './reports';

const tx = (
  id: string,
  date: string,
  amount: string,
  payee: string | null,
  kind: ReportTxn['kind'] = null,
): ReportTxn => ({
  id,
  txnDate: date,
  amount: Cash.of(amount),
  clearedState: 'uncleared',
  payee,
  kind,
});

describe('monthlyCashflow', () => {
  it('groups signed amounts into deposits + payments by month', () => {
    const rows = monthlyCashflow([
      tx('a', '2026-11-02', '-100', 'Target'),
      tx('b', '2026-11-15', '-50', 'Amex'),
      tx('c', '2026-11-28', '+2500', 'Salary'),
      tx('d', '2026-12-01', '-1500', 'Sofi Mortgage'),
      tx('e', '2026-12-15', '+100', 'Refund'),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      month: '2026-11',
      deposits: Cash.of('2500'),
      payments: Cash.of('150'),
      net: Cash.of('2350'),
      txnCount: 3,
    });
    expect(rows[1]).toEqual({
      month: '2026-12',
      deposits: Cash.of('100'),
      payments: Cash.of('1500'),
      net: Cash.of('-1400'),
      txnCount: 2,
    });
  });

  it('returns sorted by month ascending', () => {
    const rows = monthlyCashflow([
      tx('a', '2026-12-01', '-10', 'x'),
      tx('b', '2026-10-01', '-10', 'x'),
      tx('c', '2026-11-01', '-10', 'x'),
    ]);
    expect(rows.map((r) => r.month)).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('omits months with no activity', () => {
    const rows = monthlyCashflow([
      tx('a', '2026-01-01', '-10', 'x'),
      tx('b', '2026-06-01', '-10', 'x'),
    ]);
    expect(rows.map((r) => r.month)).toEqual(['2026-01', '2026-06']);
  });
});

describe('topPayees', () => {
  const ledger: ReportTxn[] = [
    tx('1', '2026-11-01', '-100', 'Target'),
    tx('2', '2026-11-02', '-250', 'Target'),
    tx('3', '2026-11-03', '-80', 'Amex'),
    tx('4', '2026-11-04', '-40', 'Amex'),
    tx('5', '2026-11-05', '+2500', 'Salary'),
    tx('6', '2026-11-06', '+500', 'Interest'),
  ];

  it('ranks payments descending', () => {
    expect(topPayees(ledger, 'payments', 10)).toEqual([
      { payee: 'Target', total: Cash.of('350'), count: 2 },
      { payee: 'Amex', total: Cash.of('120'), count: 2 },
    ]);
  });

  it('ranks deposits descending', () => {
    expect(topPayees(ledger, 'deposits', 10)).toEqual([
      { payee: 'Salary', total: Cash.of('2500'), count: 1 },
      { payee: 'Interest', total: Cash.of('500'), count: 1 },
    ]);
  });

  it('respects the limit', () => {
    const rows = topPayees(ledger, 'payments', 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payee).toBe('Target');
  });

  it('skips empty-payee transactions', () => {
    expect(
      topPayees(
        [tx('a', '2026-11-01', '-100', null), tx('b', '2026-11-02', '-50', '')],
        'payments',
        10,
      ),
    ).toEqual([]);
  });
});

describe('spendingByKind', () => {
  it('sums payments (magnitudes) by kind and excludes deposits', () => {
    const rows = spendingByKind([
      tx('1', '2026-11-01', '-100', 'x', 'bill_pay'),
      tx('2', '2026-11-02', '-50', 'x', 'bill_pay'),
      tx('3', '2026-11-03', '-20', 'x', 'atm'),
      tx('4', '2026-11-04', '+500', 'x', 'deposit'),
    ]);
    expect(rows).toEqual([
      { kind: 'bill_pay', total: Cash.of('150'), count: 2 },
      { kind: 'atm', total: Cash.of('20'), count: 1 },
    ]);
  });

  it('buckets untyped payments under "unset"', () => {
    const rows = spendingByKind([tx('1', '2026-11-01', '-100', 'x', null)]);
    expect(rows).toEqual([{ kind: 'unset', total: Cash.of('100'), count: 1 }]);
  });

  it('returns an empty list when there are no payments', () => {
    expect(
      spendingByKind([tx('1', '2026-11-01', '+500', 'x', 'deposit')]),
    ).toEqual([]);
  });
});
