import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { payees, type PayeeRow } from '@/db/schema';

export async function listPayees(userId: string): Promise<PayeeRow[]> {
  return db
    .select()
    .from(payees)
    .where(and(eq(payees.userId, userId), eq(payees.isArchived, false)))
    .orderBy(asc(payees.name));
}

export async function listArchivedPayees(userId: string): Promise<PayeeRow[]> {
  return db
    .select()
    .from(payees)
    .where(and(eq(payees.userId, userId), eq(payees.isArchived, true)))
    .orderBy(asc(payees.name));
}
