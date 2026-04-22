import { describe, it, expect } from 'vitest';
import { Cash } from '@/money';
import { balanceTimeSeries } from './charts';
import type { AccountOpening, LedgerTransaction } from './accounts';

const account: AccountOpening = {
  openingBalance: Cash.of('1000.00'),
  openingDate: '2026-11-01',
};

const tx = (id: string, date: string, amount: string): LedgerTransaction => ({
  id,
  txnDate: date,
  amount: Cash.of(amount),
  clearedState: 'uncleared',
});

describe('balanceTimeSeries', () => {
  it('starts at opening_date with opening_balance and no other points when there are no txns', () => {
    const out = balanceTimeSeries(account, []);
    expect(out).toEqual([{ date: '2026-11-01', balance: 1000 }]);
  });

  it('emits end-of-day balance per distinct txn date', () => {
    const txns = [
      tx('a', '2026-11-02', '-100.00'),
      tx('b', '2026-11-04', '-50.00'),
    ];
    expect(balanceTimeSeries(account, txns)).toEqual([
      { date: '2026-11-01', balance: 1000 },
      { date: '2026-11-02', balance: 900 },
      { date: '2026-11-04', balance: 850 },
    ]);
  });

  it('collapses same-day transactions into a single end-of-day point', () => {
    const txns = [
      tx('a', '2026-11-02', '-100.00'),
      tx('b', '2026-11-02', '+250.00'),
      tx('c', '2026-11-02', '-10.00'),
    ];
    expect(balanceTimeSeries(account, txns)).toEqual([
      { date: '2026-11-01', balance: 1000 },
      { date: '2026-11-02', balance: 1140 },
    ]);
  });

  it('ignores transactions dated before opening_date', () => {
    const txns = [
      tx('stale', '2026-10-25', '-999.99'),
      tx('ok', '2026-11-02', '-50.00'),
    ];
    expect(balanceTimeSeries(account, txns)).toEqual([
      { date: '2026-11-01', balance: 1000 },
      { date: '2026-11-02', balance: 950 },
    ]);
  });

  it('extends the line to throughDate when it is beyond the last txn', () => {
    const txns = [tx('a', '2026-11-05', '-200.00')];
    const out = balanceTimeSeries(account, txns, '2026-11-20');
    expect(out).toEqual([
      { date: '2026-11-01', balance: 1000 },
      { date: '2026-11-05', balance: 800 },
      { date: '2026-11-20', balance: 800 },
    ]);
  });

  it('does not duplicate the tail point when throughDate equals the last txn date', () => {
    const txns = [tx('a', '2026-11-05', '-200.00')];
    const out = balanceTimeSeries(account, txns, '2026-11-05');
    expect(out).toEqual([
      { date: '2026-11-01', balance: 1000 },
      { date: '2026-11-05', balance: 800 },
    ]);
  });
});
