import { Cash } from '@/money';
import type { AccountOpening, IsoDate, LedgerTransaction } from './accounts';

export interface BalancePoint {
  readonly date: IsoDate;
  /** Displayable balance at end of `date`. Number is safe here — this is the
   *  visualization boundary; the underlying money math stayed exact in Cash. */
  readonly balance: number;
}

function compareTxns(a: LedgerTransaction, b: LedgerTransaction): number {
  if (a.txnDate !== b.txnDate) return a.txnDate < b.txnDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function cashToNumber(c: Cash): number {
  return Number(c.toString());
}

/**
 * End-of-day balance points suitable for a chart.
 *   - Starts at (opening_date, opening_balance)
 *   - Emits one point per distinct txn_date (end-of-day balance)
 *   - If `throughDate` > last txn date, emits a final point there so the line
 *     continues to "today" instead of stopping at the last txn
 *   - Transactions before opening_date are ignored (they don't belong to the
 *     account's ledger)
 *   - Multi-transaction days collapse to a single end-of-day point
 */
export function balanceTimeSeries(
  account: AccountOpening,
  transactions: readonly LedgerTransaction[],
  throughDate?: IsoDate,
): BalancePoint[] {
  const sorted = [...transactions]
    .filter((t) => t.txnDate >= account.openingDate)
    .sort(compareTxns);

  const points: BalancePoint[] = [
    { date: account.openingDate, balance: cashToNumber(account.openingBalance) },
  ];

  let running = account.openingBalance;
  for (const t of sorted) {
    running = running.add(t.amount);
    const last = points[points.length - 1]!;
    if (last.date === t.txnDate) {
      // collapse same-day entries to a single end-of-day point
      points[points.length - 1] = { date: t.txnDate, balance: cashToNumber(running) };
    } else {
      points.push({ date: t.txnDate, balance: cashToNumber(running) });
    }
  }

  if (throughDate && points.length > 0) {
    const last = points[points.length - 1]!;
    if (throughDate > last.date) {
      points.push({ date: throughDate, balance: last.balance });
    }
  }

  return points;
}
