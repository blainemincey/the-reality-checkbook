import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, payees, transactions } from '@/db/schema';
import { Cash } from '@/money';

export interface DashboardStats {
  totalBalance: Cash;
  checkingBalance: Cash;
  savingsBalance: Cash;
  creditBalance: Cash;

  accountCount: number;
  txnCount: number;

  depositsMtd: Cash;
  paymentsMtd: Cash;
  cashflowMtd: Cash;

  unclearedCount: number;
  clearedCount: number;
  clearedPct: number;

  activePayeesMtd: number;
  totalPayees: number;

  /** Top single payee MTD by total |amount|, or null if none. */
  topPayeeMtd: { name: string; total: Cash } | null;

  /** Oldest uncleared transaction across all accounts, or null. */
  oldestUncleared: { txnDate: string; payee: string | null; amount: Cash } | null;
}

function firstOfMonthIso(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export async function computeDashboardStats(userId: string): Promise<DashboardStats> {
  const monthStart = firstOfMonthIso();

  // Accounts + their opening balance, joined with total net of active transactions.
  const accountAgg = await db
    .select({
      id: accounts.id,
      accountType: accounts.accountType,
      opening: accounts.openingBalance,
      txnSum: sql<string>`coalesce(sum(case when ${transactions.isDeleted} = false then ${transactions.amount} end), 0)::text`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, false)))
    .groupBy(accounts.id);

  let total = Cash.zero();
  let checking = Cash.zero();
  let savings = Cash.zero();
  let credit = Cash.zero();

  for (const a of accountAgg) {
    const bal = Cash.of(a.opening).add(Cash.of(a.txnSum));
    total = total.add(bal);
    switch (a.accountType) {
      case 'checking':
      case 'cash':
        checking = checking.add(bal);
        break;
      case 'savings':
        savings = savings.add(bal);
        break;
      case 'credit_card':
        credit = credit.add(bal);
        break;
      default:
        break;
    }
  }

  // Txn-level aggregates (all active, any account for this user).
  const [rollup] = await db
    .select({
      txnCount: sql<number>`count(*)::int`,
      uncleared: sql<number>`count(*) filter (where ${transactions.clearedState} = 'uncleared')::int`,
      cleared: sql<number>`count(*) filter (where ${transactions.clearedState} <> 'uncleared')::int`,
      depositsMtd: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0 and ${transactions.txnDate} >= ${monthStart}), 0)::text`,
      paymentsMtd: sql<string>`coalesce(-sum(${transactions.amount}) filter (where ${transactions.amount} < 0 and ${transactions.txnDate} >= ${monthStart}), 0)::text`,
      activePayeesMtd: sql<number>`count(distinct ${transactions.payeeId}) filter (where ${transactions.txnDate} >= ${monthStart} and ${transactions.payeeId} is not null)::int`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isArchived, false),
        eq(transactions.isDeleted, false),
      ),
    );

  const txnCount = rollup?.txnCount ?? 0;
  const unclearedCount = rollup?.uncleared ?? 0;
  const clearedCount = rollup?.cleared ?? 0;
  const clearedPct = txnCount > 0 ? Math.round((clearedCount / txnCount) * 100) : 0;

  const depositsMtd = Cash.of(rollup?.depositsMtd ?? '0');
  const paymentsMtd = Cash.of(rollup?.paymentsMtd ?? '0');

  // Payee table size for the user.
  const [payeeCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payees)
    .where(and(eq(payees.userId, userId), eq(payees.isArchived, false)));

  // Top payee MTD by total |amount|.
  const topRows = await db
    .select({
      payee: transactions.payee,
      total: sql<string>`sum(abs(${transactions.amount}))::text`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isArchived, false),
        eq(transactions.isDeleted, false),
        sql`${transactions.txnDate} >= ${monthStart}`,
        sql`${transactions.payee} is not null`,
      ),
    )
    .groupBy(transactions.payee)
    .orderBy(sql`sum(abs(${transactions.amount})) desc`)
    .limit(1);

  const topPayeeMtd = topRows[0]?.payee
    ? { name: topRows[0].payee, total: Cash.of(topRows[0].total) }
    : null;

  // Oldest uncleared txn.
  const oldestRows = await db
    .select({
      txnDate: transactions.txnDate,
      payee: transactions.payee,
      amount: transactions.amount,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isArchived, false),
        eq(transactions.isDeleted, false),
        eq(transactions.clearedState, 'uncleared'),
      ),
    )
    .orderBy(transactions.txnDate)
    .limit(1);

  const oldestUncleared = oldestRows[0]
    ? {
        txnDate: oldestRows[0].txnDate,
        payee: oldestRows[0].payee,
        amount: Cash.of(oldestRows[0].amount),
      }
    : null;

  return {
    totalBalance: total,
    checkingBalance: checking,
    savingsBalance: savings,
    creditBalance: credit,
    accountCount: accountAgg.length,
    txnCount,
    depositsMtd,
    paymentsMtd,
    cashflowMtd: depositsMtd.sub(paymentsMtd),
    unclearedCount,
    clearedCount,
    clearedPct,
    activePayeesMtd: rollup?.activePayeesMtd ?? 0,
    totalPayees: payeeCount?.n ?? 0,
    topPayeeMtd,
    oldestUncleared,
  };
}
