import { Cash } from '@/money';

export type IsoDate = string;

export interface LedgerTransaction {
  readonly id: string;
  readonly txnDate: IsoDate;
  readonly amount: Cash;
  readonly clearedState: 'uncleared' | 'cleared' | 'reconciled';
}

export interface AccountOpening {
  readonly openingBalance: Cash;
  readonly openingDate: IsoDate;
}

export interface RegisterRow<T extends LedgerTransaction> {
  readonly transaction: T;
  readonly runningBalance: Cash;
}

function compareTxns(a: LedgerTransaction, b: LedgerTransaction): number {
  if (a.txnDate !== b.txnDate) return a.txnDate < b.txnDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Balance at a given date = opening_balance + SUM(amount) for txns on or before that date.
 * Transactions dated before opening_date are ignored (they predate the account).
 */
export function balanceAsOf(
  account: AccountOpening,
  transactions: readonly LedgerTransaction[],
  asOf: IsoDate,
): Cash {
  if (asOf < account.openingDate) {
    throw new RangeError(
      `balanceAsOf: asOf ${asOf} precedes opening_date ${account.openingDate}`,
    );
  }
  const applicable = transactions.filter(
    (t) => t.txnDate >= account.openingDate && t.txnDate <= asOf,
  );
  return applicable.reduce((acc, t) => acc.add(t.amount), account.openingBalance);
}

/**
 * Register view: each row carries a running balance. Transactions are sorted by
 * (txn_date ASC, id ASC) so two transactions on the same day have a stable order.
 */
export function registerRows<T extends LedgerTransaction>(
  account: AccountOpening,
  transactions: readonly T[],
): ReadonlyArray<RegisterRow<T>> {
  const sorted = [...transactions]
    .filter((t) => t.txnDate >= account.openingDate)
    .sort(compareTxns);

  const rows: RegisterRow<T>[] = [];
  let running = account.openingBalance;
  for (const transaction of sorted) {
    running = running.add(transaction.amount);
    rows.push({ transaction, runningBalance: running });
  }
  return rows;
}

export interface BackfillPreview {
  readonly openingBalance: Cash;
  readonly backfillCount: number;
  readonly backfillSum: Cash;
  readonly projectedBalance: Cash;
  readonly unclearedCount: number;
  readonly unclearedSum: Cash;
  readonly clearedCount: number;
  readonly clearedSum: Cash;
  readonly invalidDateCount: number;
}

/**
 * Backfill preview: the math summary the bootstrap UI shows before commit.
 * Transactions dated before opening_date are excluded from sums and counted
 * separately so the UI can flag them for correction (either edit the date or
 * move opening_date earlier).
 */
export function backfillPreview(
  account: AccountOpening,
  backfill: readonly LedgerTransaction[],
): BackfillPreview {
  const valid = backfill.filter((t) => t.txnDate >= account.openingDate);
  const invalidDateCount = backfill.length - valid.length;

  const uncleared = valid.filter((t) => t.clearedState === 'uncleared');
  const cleared = valid.filter((t) => t.clearedState !== 'uncleared');

  const backfillSum = Cash.sum(valid.map((t) => t.amount));
  const unclearedSum = Cash.sum(uncleared.map((t) => t.amount));
  const clearedSum = Cash.sum(cleared.map((t) => t.amount));
  const projectedBalance = account.openingBalance.add(backfillSum);

  return {
    openingBalance: account.openingBalance,
    backfillCount: valid.length,
    backfillSum,
    projectedBalance,
    unclearedCount: uncleared.length,
    unclearedSum,
    clearedCount: cleared.length,
    clearedSum,
    invalidDateCount,
  };
}

export interface ReconciliationDelta {
  readonly expectedBalance: Cash;
  readonly statementBalance: Cash;
  readonly delta: Cash;
  readonly isBalanced: boolean;
}

/**
 * Compare the sum of cleared+reconciled transactions through statement_date (plus opening)
 * against the statement's ending balance. Delta is expected - statement; zero means balanced.
 */
export function reconciliationDelta(
  account: AccountOpening,
  transactions: readonly LedgerTransaction[],
  statementDate: IsoDate,
  statementBalance: Cash,
): ReconciliationDelta {
  const clearedThrough = transactions.filter(
    (t) =>
      t.txnDate >= account.openingDate &&
      t.txnDate <= statementDate &&
      (t.clearedState === 'cleared' || t.clearedState === 'reconciled'),
  );
  const expectedBalance = clearedThrough.reduce(
    (acc, t) => acc.add(t.amount),
    account.openingBalance,
  );
  const delta = expectedBalance.sub(statementBalance);
  return {
    expectedBalance,
    statementBalance,
    delta,
    isBalanced: delta.isZero(),
  };
}
