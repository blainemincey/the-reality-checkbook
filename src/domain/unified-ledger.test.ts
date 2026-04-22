import { describe, it, expect } from 'vitest';
import { Cash } from '@/money';
import {
  unifiedLedger,
  type UnifiedLedgerAccount,
  type UnifiedLedgerTxn,
} from './unified-ledger';

const a1: UnifiedLedgerAccount = {
  id: 'A',
  openingBalance: Cash.of('1000.00'),
  openingDate: '2026-11-01',
};
const a2: UnifiedLedgerAccount = {
  id: 'B',
  openingBalance: Cash.of('500.00'),
  openingDate: '2026-11-01',
};
const aLate: UnifiedLedgerAccount = {
  id: 'LATE',
  openingBalance: Cash.of('100.00'),
  openingDate: '2026-11-10',
};

const tx = (
  id: string,
  accountId: string,
  date: string,
  amount: string,
): UnifiedLedgerTxn => ({
  id,
  accountId,
  txnDate: date,
  amount: Cash.of(amount),
  clearedState: 'uncleared',
});

describe('unifiedLedger', () => {
  it('returns empty when no transactions', () => {
    expect(unifiedLedger([a1], [])).toEqual([]);
  });

  it('single account: combined balance matches per-account', () => {
    const txns = [
      tx('t1', 'A', '2026-11-02', '-100'),
      tx('t2', 'A', '2026-11-05', '-50'),
    ];
    const rows = unifiedLedger([a1], txns);
    expect(rows.map((r) => r.runningBalance.toString())).toEqual([
      '900.0000',
      '850.0000',
    ]);
  });

  it('two accounts opened same day: interleaves and applies both openings upfront', () => {
    const txns = [
      tx('t1', 'A', '2026-11-02', '-100'), // 1500 - 100 = 1400
      tx('t2', 'B', '2026-11-03', '-50'), // 1400 - 50 = 1350
      tx('t3', 'A', '2026-11-04', '+200'), // 1350 + 200 = 1550
    ];
    const rows = unifiedLedger([a1, a2], txns);
    expect(rows.map((r) => r.runningBalance.toString())).toEqual([
      '1400.0000',
      '1350.0000',
      '1550.0000',
    ]);
  });

  it('same-day transactions on different accounts: stable deterministic order', () => {
    const txns = [
      tx('t1', 'A', '2026-11-02', '-100'),
      tx('t2', 'B', '2026-11-02', '+200'),
      tx('t3', 'A', '2026-11-02', '+50'),
    ];
    const rows = unifiedLedger([a1, a2], txns);
    // Account A rows come before B (account ids sort A < B). Within A, id sort.
    expect(rows.map((r) => r.id)).toEqual(['t1', 't3', 't2']);
    // After all three: 1500 - 100 + 50 + 200 = 1650
    expect(rows[2]!.runningBalance.toString()).toBe('1650.0000');
  });

  it('account opens later: its opening only contributes from its opening_date onward', () => {
    // a1 opens 11/01 with $1000, aLate opens 11/10 with $100.
    const txns = [
      tx('t1', 'A', '2026-11-02', '-100'),        // 1000 - 100 = 900
      tx('t2', 'LATE', '2026-11-11', '+50'),      // LATE opens (+100) at 11/10 → 900+100=1000, +50 = 1050
      tx('t3', 'A', '2026-11-12', '-25'),         // 1050 - 25 = 1025
    ];
    const rows = unifiedLedger([a1, aLate], txns);
    expect(rows.map((r) => r.runningBalance.toString())).toEqual([
      '900.0000',
      '1050.0000',
      '1025.0000',
    ]);
  });

  it("account's opening applies on the same date as its first transaction", () => {
    const txns = [tx('t1', 'LATE', '2026-11-10', '-20')];
    const rows = unifiedLedger([a1, aLate], txns);
    // a1 already open on 11/01 ($1000), LATE opens 11/10 (+$100). Then -20.
    expect(rows[0]!.runningBalance.toString()).toBe('1080.0000');
  });

  it('ignores transactions dated before their account opens', () => {
    const txns = [tx('t1', 'LATE', '2026-11-05', '-999')];
    const rows = unifiedLedger([a1, aLate], txns);
    expect(rows).toEqual([]);
  });

  it('preserves clearedState on output rows', () => {
    const txns = [
      { ...tx('t1', 'A', '2026-11-02', '-100'), clearedState: 'cleared' as const },
    ];
    const rows = unifiedLedger([a1], txns);
    expect(rows[0]!.clearedState).toBe('cleared');
  });
});
