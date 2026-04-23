import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { creditCards, type CreditCardRow } from '@/db/schema';
import { Cash } from '@/money';

export async function listCreditCards(userId: string): Promise<CreditCardRow[]> {
  return db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.userId, userId), eq(creditCards.isArchived, false)))
    .orderBy(asc(creditCards.name));
}

export async function listArchivedCreditCards(userId: string): Promise<CreditCardRow[]> {
  return db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.userId, userId), eq(creditCards.isArchived, true)))
    .orderBy(asc(creditCards.name));
}

/** Sum of amount_owed across non-archived credit cards. */
export async function creditCardTotal(userId: string): Promise<Cash> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${creditCards.amountOwed}), 0)::text`,
    })
    .from(creditCards)
    .where(and(eq(creditCards.userId, userId), eq(creditCards.isArchived, false)));
  return Cash.of(row?.total ?? '0');
}
