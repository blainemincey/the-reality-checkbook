import {
  pgTable,
  pgEnum,
  char,
  text,
  boolean,
  date,
  timestamp,
  numeric,
  integer,
  uuid,
  index,
  unique,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'brokerage',
  'retirement',
]);

export const clearedStateEnum = pgEnum('cleared_state', [
  'uncleared',
  'cleared',
  'reconciled',
]);

export const categoryKindEnum = pgEnum('category_kind', ['expense', 'income', 'transfer']);

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const transactionKindEnum = pgEnum('transaction_kind', [
  'deposit',
  'payment',
  'bill_pay',
  'check',
  'atm',
  'interest',
  'dividend',
  'transfer',
  'tax_payment',
  'fee',
  'refund',
  'other',
]);

// ---------------------------------------------------------------------------
// Currencies — tiny reference table so accounts.currency is a real FK
// ---------------------------------------------------------------------------

export const currencies = pgTable('currencies', {
  code: char('code', { length: 3 }).primaryKey(),
  minorUnitScale: integer('minor_unit_scale').notNull(),
  name: text('name').notNull(),
});

// ---------------------------------------------------------------------------
// Users (single-user in v1, extensible to household)
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Accounts — opening_balance and opening_date live here, NOT as synthetic rows
// ---------------------------------------------------------------------------

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    accountType: accountTypeEnum('account_type').notNull(),
    currency: char('currency', { length: 3 })
      .notNull()
      .references(() => currencies.code)
      .default('USD'),

    openingBalance: numeric('opening_balance', { precision: 19, scale: 4 }).notNull(),
    openingDate: date('opening_date').notNull(),

    institution: text('institution'),
    last4: char('last4', { length: 4 }),
    notes: text('notes'),
    isArchived: boolean('is_archived').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Categories (FK exists in v1, UI ships in v1.1)
// ---------------------------------------------------------------------------

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: categoryKindEnum('kind').notNull().default('expense'),
    parentId: uuid('parent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('categories_user_name_unique').on(t.userId, t.name)],
);

// ---------------------------------------------------------------------------
// Reconciliations — one row per statement close
// ---------------------------------------------------------------------------

export const reconciliations = pgTable('reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  statementDate: date('statement_date').notNull(),
  statementEndingBalance: numeric('statement_ending_balance', {
    precision: 19,
    scale: 4,
  }).notNull(),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
});

// ---------------------------------------------------------------------------
// Transactions — the ledger. Amount is signed: negative = debit, positive = credit.
// ---------------------------------------------------------------------------

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),

    txnDate: date('txn_date').notNull(),
    postedDate: date('posted_date'),

    payee: text('payee'),
    memo: text('memo'),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),

    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    // Forward-referenced — payees table is declared below.
    payeeId: uuid('payee_id').references((): AnyPgColumn => payees.id, {
      onDelete: 'set null',
    }),
    kind: transactionKindEnum('kind'),
    clearedState: clearedStateEnum('cleared_state').notNull().default('uncleared'),
    reconciliationId: uuid('reconciliation_id').references(() => reconciliations.id, {
      onDelete: 'set null',
    }),

    isBackfill: boolean('is_backfill').notNull().default(false),
    checkNumber: text('check_number'),
    isDeleted: boolean('is_deleted').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('transactions_account_date_idx').on(t.accountId, t.txnDate, t.id),
    index('transactions_cleared_idx').on(t.accountId, t.clearedState),
    // Enforce that txn_date is on or after the account's opening_date.
    // (We also enforce this in application code; the DB check is defense-in-depth.)
  ],
);

// ---------------------------------------------------------------------------
// Transfers — link two opposite-signed transactions as a transfer pair
// ---------------------------------------------------------------------------

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromTxnId: uuid('from_txn_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    toTxnId: uuid('to_txn_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('transfers_from_txn_unique').on(t.fromTxnId),
    unique('transfers_to_txn_unique').on(t.toTxnId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  currency: one(currencies, { fields: [accounts.currency], references: [currencies.code] }),
  transactions: many(transactions),
  reconciliations: many(reconciliations),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  reconciliation: one(reconciliations, {
    fields: [transactions.reconciliationId],
    references: [reconciliations.id],
  }),
  payee: one(payees, { fields: [transactions.payeeId], references: [payees.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  transactions: many(transactions),
}));

// ---------------------------------------------------------------------------
// Payees (vendors) — configured in settings, surfaced as a dropdown / autocomplete
// during transaction entry and reconciliation.
// ---------------------------------------------------------------------------

export const payees = pgTable(
  'payees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    defaultCategoryId: uuid('default_category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    memoTemplate: text('memo_template'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique('payees_user_name_unique').on(t.userId, t.name)],
);

export const payeesRelations = relations(payees, ({ one }) => ({
  user: one(users, { fields: [payees.userId], references: [users.id] }),
  defaultCategory: one(categories, {
    fields: [payees.defaultCategoryId],
    references: [categories.id],
  }),
}));

export type PayeeRow = typeof payees.$inferSelect;

export const reconciliationsRelations = relations(reconciliations, ({ one, many }) => ({
  account: one(accounts, { fields: [reconciliations.accountId], references: [accounts.id] }),
  transactions: many(transactions),
}));

// ---------------------------------------------------------------------------
// Inferred types — used throughout the app (domain + server)
// ---------------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type ReconciliationRow = typeof reconciliations.$inferSelect;
