import { Cash } from '@/money';
import type { IsoDate, LedgerTransaction } from './accounts';

type TxnKind =
  | 'deposit' | 'payment' | 'bill_pay' | 'check' | 'atm' | 'interest'
  | 'dividend' | 'transfer' | 'tax_payment' | 'fee' | 'refund' | 'other';

export interface ReportTxn extends LedgerTransaction {
  readonly payee: string | null;
  readonly kind: TxnKind | null;
}

// ---------------------------------------------------------------------------
// Monthly cashflow
// ---------------------------------------------------------------------------

export interface MonthCashflowRow {
  /** YYYY-MM */
  readonly month: string;
  readonly deposits: Cash;
  readonly payments: Cash; // magnitude (positive)
  readonly net: Cash;
  readonly txnCount: number;
}

function monthOf(iso: IsoDate): string {
  return iso.slice(0, 7);
}

/**
 * Group transactions by month; return deposits (positive), payments
 * (positive magnitude of negative txns), net (deposits − payments), and txn
 * count. Months with no activity are not emitted.
 */
export function monthlyCashflow(transactions: readonly ReportTxn[]): MonthCashflowRow[] {
  const byMonth = new Map<
    string,
    { deposits: Cash; payments: Cash; count: number }
  >();

  for (const t of transactions) {
    const key = monthOf(t.txnDate);
    const row = byMonth.get(key) ?? {
      deposits: Cash.zero(),
      payments: Cash.zero(),
      count: 0,
    };
    if (t.amount.isPositive()) {
      row.deposits = row.deposits.add(t.amount);
    } else if (t.amount.isNegative()) {
      row.payments = row.payments.add(t.amount.abs());
    }
    row.count++;
    byMonth.set(key, row);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, r]) => ({
      month,
      deposits: r.deposits,
      payments: r.payments,
      net: r.deposits.sub(r.payments),
      txnCount: r.count,
    }));
}

// ---------------------------------------------------------------------------
// Top payees
// ---------------------------------------------------------------------------

export interface PayeeRollup {
  readonly payee: string;
  readonly total: Cash;
  readonly count: number;
}

/**
 * Aggregate by payee within a sign filter. `'payments'` counts only negative-
 * amount transactions and returns positive magnitudes; `'deposits'` counts
 * only positive amounts. Transactions with empty payee are ignored.
 */
export function topPayees(
  transactions: readonly ReportTxn[],
  direction: 'payments' | 'deposits',
  limit: number,
): PayeeRollup[] {
  const byPayee = new Map<string, { total: Cash; count: number }>();
  for (const t of transactions) {
    if (!t.payee) continue;
    const matches =
      direction === 'payments' ? t.amount.isNegative() : t.amount.isPositive();
    if (!matches) continue;

    const row = byPayee.get(t.payee) ?? { total: Cash.zero(), count: 0 };
    row.total = row.total.add(t.amount.abs());
    row.count++;
    byPayee.set(t.payee, row);
  }

  return [...byPayee.entries()]
    .map(([payee, r]) => ({ payee, total: r.total, count: r.count }))
    .sort((a, b) => (a.total.lt(b.total) ? 1 : a.total.gt(b.total) ? -1 : 0))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Spending by transaction type
// ---------------------------------------------------------------------------

export interface KindRollup {
  readonly kind: TxnKind | 'unset';
  readonly total: Cash; // positive magnitude
  readonly count: number;
}

/**
 * Group negative-amount transactions (money out) by kind. Returns positive
 * magnitudes. Deposits are excluded — 'deposit' or 'interest' income is not
 * spending.
 */
export function spendingByKind(transactions: readonly ReportTxn[]): KindRollup[] {
  const byKind = new Map<TxnKind | 'unset', { total: Cash; count: number }>();
  for (const t of transactions) {
    if (!t.amount.isNegative()) continue;
    const key: TxnKind | 'unset' = t.kind ?? 'unset';
    const row = byKind.get(key) ?? { total: Cash.zero(), count: 0 };
    row.total = row.total.add(t.amount.abs());
    row.count++;
    byKind.set(key, row);
  }
  return [...byKind.entries()]
    .map(([kind, r]) => ({ kind, total: r.total, count: r.count }))
    .sort((a, b) => (a.total.lt(b.total) ? 1 : a.total.gt(b.total) ? -1 : 0));
}
