import { Cash } from '@/money';
import type { AccountOpening, IsoDate, LedgerTransaction } from './accounts';

export interface UnifiedLedgerAccount extends AccountOpening {
  readonly id: string;
}

export interface UnifiedLedgerTxn extends LedgerTransaction {
  readonly accountId: string;
}

export interface UnifiedLedgerRow {
  readonly id: string;
  readonly accountId: string;
  readonly txnDate: IsoDate;
  readonly amount: Cash;
  readonly clearedState: LedgerTransaction['clearedState'];
  /** Combined running balance across all accounts, cumulative through this row. */
  readonly runningBalance: Cash;
}

function compareTxns(a: UnifiedLedgerTxn, b: UnifiedLedgerTxn): number {
  if (a.txnDate !== b.txnDate) return a.txnDate < b.txnDate ? -1 : 1;
  if (a.accountId !== b.accountId) return a.accountId < b.accountId ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Interleave every account's transactions into one chronological stream and
 * compute a combined running balance per row. Each account's opening_balance
 * is injected as a pseudo-event at its opening_date so accounts that come
 * online later don't retroactively inflate earlier rows.
 *
 * Transactions dated before their account's opening_date are filtered out.
 *
 * Returns rows in ASCENDING date order. Callers that want newest-first can
 * `.reverse()` at the display layer.
 */
export function unifiedLedger(
  accounts: readonly UnifiedLedgerAccount[],
  transactions: readonly UnifiedLedgerTxn[],
): UnifiedLedgerRow[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const valid = transactions.filter((t) => {
    const a = accountById.get(t.accountId);
    return a !== undefined && t.txnDate >= a.openingDate;
  });
  const sortedTxns = [...valid].sort(compareTxns);

  // Openings sorted by date (then by id for a stable tiebreak).
  const sortedOpenings = [...accounts].sort((a, b) => {
    if (a.openingDate !== b.openingDate) return a.openingDate < b.openingDate ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  let running = Cash.zero();
  let openingIdx = 0;

  const rows: UnifiedLedgerRow[] = [];
  for (const t of sortedTxns) {
    // Apply any openings whose date is on-or-before this txn's date.
    while (
      openingIdx < sortedOpenings.length &&
      sortedOpenings[openingIdx]!.openingDate <= t.txnDate
    ) {
      running = running.add(sortedOpenings[openingIdx]!.openingBalance);
      openingIdx++;
    }
    running = running.add(t.amount);
    rows.push({
      id: t.id,
      accountId: t.accountId,
      txnDate: t.txnDate,
      amount: t.amount,
      clearedState: t.clearedState,
      runningBalance: running,
    });
  }

  return rows;
}
