// One-shot importer for the existing Mincey-CheckRegister-2025.xlsx schema:
//
//   Row 10 header: Date | Finance Instituion | Txn Type | Payee | Check Num |
//                  Cleared | Payment | Deposit | Total Balance | Reconciled |
//                  Notes
//   Rows 1-8: starting + running balances per institution (opening balance
//             row 2: Schwab Balance / Fidelity Balance / Combined)
//
// Usage:
//   npm run import-xlsx -- <path.xlsx> --user-email me@x.com [--wipe] [--dry-run]
//
// --wipe deletes the target user's existing accounts, payees, and transactions
// before inserting. Without --wipe, the script refuses if the user already
// owns any accounts.
//
// Account opening_date defaults to 2025-04-01 (sheet name "2025-April").
// CC accounts from the right-side panel are skipped in v1 (no txns in the
// sheet; would create empty ledgers).

import 'dotenv/config';
import { argv, exit } from 'node:process';
import XLSX from 'xlsx';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { accounts, payees, transactions, users } from '../src/db/schema';
import { Cash, parseCashInput } from '../src/money';
import { parseAnyDate } from '../src/domain/bootstrap/paste-parser';

type TxnKind =
  | 'deposit' | 'payment' | 'bill_pay' | 'check' | 'atm' | 'interest'
  | 'dividend' | 'transfer' | 'tax_payment' | 'fee' | 'refund' | 'other';

interface Flags {
  file?: string;
  userEmail?: string;
  sheet?: string;
  wipe?: boolean;
  dryRun?: boolean;
  openingDate?: string;
}

function parseFlags(args: string[]): Flags {
  const out: Flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (!a.startsWith('--')) {
      if (!out.file) out.file = a;
      continue;
    }
    const key = a.slice(2);
    const next = args[i + 1];
    const hasVal = next !== undefined && !next.startsWith('--');
    switch (key) {
      case 'user-email':
        if (hasVal) { out.userEmail = next; i++; }
        break;
      case 'sheet':
        if (hasVal) { out.sheet = next; i++; }
        break;
      case 'opening-date':
        if (hasVal) { out.openingDate = next; i++; }
        break;
      case 'wipe':
        out.wipe = true;
        break;
      case 'dry-run':
        out.dryRun = true;
        break;
    }
  }
  return out;
}

const TXN_TYPE_TO_KIND: Record<string, TxnKind> = {
  atm: 'atm',
  'bill pay': 'bill_pay',
  check: 'check',
  deposit: 'deposit',
  dividend: 'dividend',
  interest: 'interest',
  'tax payment': 'tax_payment',
  transfer: 'transfer',
};

// Schwab Checking, Fidelity CMA — names as they appear in the sheet.
// We derive account_type: Checking accounts are 'checking'; CMA is also
// effectively a brokerage-linked checking — store as 'checking'.
function accountTypeFor(instName: string): 'checking' | 'savings' | 'brokerage' {
  const lower = instName.toLowerCase();
  if (lower.includes('savings')) return 'savings';
  if (lower.includes('brokerage')) return 'brokerage';
  return 'checking';
}

function institutionFor(instName: string): string {
  // Strip trailing "Checking" / "CMA" / etc to get the bank name for logos.
  return instName.replace(/\s+(Checking|Savings|CMA|Brokerage|Retirement)\s*$/i, '').trim();
}

async function main(): Promise<void> {
  const flags = parseFlags(argv.slice(2));
  if (!flags.file) { console.error('Pass an xlsx path as the first argument.'); exit(2); }
  if (!flags.userEmail) { console.error('--user-email is required.'); exit(2); }

  const email = flags.userEmail.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) { console.error(`No user: ${email}`); exit(1); }

  // Existing data guard
  const existing = await db.select().from(accounts).where(eq(accounts.userId, user.id));
  if (existing.length > 0 && !flags.wipe) {
    console.error(
      `User ${email} already has ${existing.length} account(s). Re-run with --wipe to replace them.`,
    );
    exit(1);
  }

  console.log(`Reading ${flags.file}…`);
  const wb = XLSX.readFile(flags.file);
  const sheetName = flags.sheet ?? wb.SheetNames[0]!;
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.error(`Sheet "${sheetName}" not found`); exit(2); }
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });

  // Discover the header row.
  const headerIdx = rows.findIndex((r) =>
    r.includes(' Date') || (r[0]?.trim?.() === 'Date' && r[1]?.includes?.('Instituion'))
  );
  if (headerIdx < 0) { console.error('Could not locate header row'); exit(2); }
  const header = rows[headerIdx]!.map((h) => (h ?? '').toString().trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const DATE = idx('Date');
  const INSTN = idx('Finance Instituion');
  const TYPE = idx('Txn Type');
  const PAYEE = idx('Payee');
  const CHECK = idx('Check Num');
  const CLEARED = idx('Cleared');
  const PAYMENT = idx('Payment');
  const DEPOSIT = idx('Deposit');
  const RECONCILED = idx('Reconciled');
  const NOTES = idx('Notes');

  if ([DATE, INSTN, TYPE, PAYEE, PAYMENT, DEPOSIT].some((i) => i < 0)) {
    console.error('Header missing required columns:', { DATE, INSTN, TYPE, PAYEE, PAYMENT, DEPOSIT });
    exit(2);
  }

  // Harvest opening balances from the top rows. They look like:
  //   ["Schwab Balance","$4,780.10","Fidelity Balance","$44,030.36", ...]
  // Pair label-cell with value-cell whenever the label matches /<name> Balance/i.
  const openings = new Map<string, Cash>();
  for (let r = 0; r < headerIdx; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length - 1; c++) {
      const label = String(row[c] ?? '').trim();
      const match = /^([A-Za-z].+?)\s+Balance$/i.exec(label);
      if (!match) continue;
      const bankName = match[1]!.trim();
      // Skip meta-labels that aren't actual accounts.
      if (/^(running|cc|combined|total|starting)$/i.test(bankName)) continue;
      const amt = parseCashInput(String(row[c + 1] ?? ''));
      if (amt.ok && amt.value) {
        // Translate to full account name
        const instName =
          bankName.toLowerCase() === 'schwab'
            ? 'Schwab Checking'
            : bankName.toLowerCase() === 'fidelity'
              ? 'Fidelity CMA'
              : bankName; // other names kept verbatim
        if (!openings.has(instName)) openings.set(instName, amt.value);
      }
    }
  }

  console.log('Detected opening balances:');
  for (const [n, b] of openings) console.log(`  ${n}  ${b.toString()}`);

  // Discover institutions actually used in data rows.
  const dataRows = rows.slice(headerIdx + 1).filter((r) => {
    const d = String(r[DATE] ?? '').trim();
    return d && parseAnyDate(d) !== null;
  });
  const usedInstitutions = new Set<string>();
  for (const r of dataRows) {
    const name = String(r[INSTN] ?? '').trim();
    if (name) usedInstitutions.add(name);
  }
  console.log(`Data rows: ${dataRows.length}, institutions: ${[...usedInstitutions].join(', ')}`);

  const openingDate = flags.openingDate ?? '2025-04-01';

  if (flags.dryRun) {
    console.log('(dry-run — no database changes)');
    return;
  }

  // Destructive: wipe existing
  if (existing.length > 0) {
    console.log(`Wiping existing accounts + transactions + payees for ${email}…`);
    await db.delete(transactions).where(
      eq(transactions.accountId, existing[0]!.id),
    ); // accounts CASCADE via FK, but transactions ON DELETE RESTRICT
    // Safer: delete all user txns by walking accounts
    for (const a of existing) {
      await db.delete(transactions).where(eq(transactions.accountId, a.id));
    }
    await db.delete(payees).where(eq(payees.userId, user.id));
    await db.delete(accounts).where(eq(accounts.userId, user.id));
  }

  // Create accounts
  const accountIdByName = new Map<string, string>();
  for (const name of usedInstitutions) {
    const opening = openings.get(name) ?? Cash.zero();
    const [ins] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name,
        accountType: accountTypeFor(name),
        currency: 'USD',
        openingBalance: opening.toString(),
        openingDate,
        institution: institutionFor(name),
      })
      .returning({ id: accounts.id });
    accountIdByName.set(name, ins!.id);
    console.log(`  + ${name}  opening ${opening.toString()} @ ${openingDate}`);
  }

  // Create payees from distinct names
  const distinctPayees = new Set<string>();
  for (const r of dataRows) {
    const p = String(r[PAYEE] ?? '').trim();
    if (p) distinctPayees.add(p);
  }
  const payeeIdByName = new Map<string, string>();
  for (const name of distinctPayees) {
    const [ins] = await db
      .insert(payees)
      .values({ userId: user.id, name })
      .returning({ id: payees.id });
    payeeIdByName.set(name.toLowerCase(), ins!.id);
  }
  console.log(`  + ${distinctPayees.size} payees`);

  // Insert transactions
  let count = 0;
  let skipped = 0;
  const batch: (typeof transactions.$inferInsert)[] = [];
  for (const r of dataRows) {
    const dateStr = String(r[DATE] ?? '').trim();
    const date = parseAnyDate(dateStr);
    if (!date) { skipped++; continue; }
    if (date < openingDate) { skipped++; continue; }

    const instName = String(r[INSTN] ?? '').trim();
    const accountId = accountIdByName.get(instName);
    if (!accountId) { skipped++; continue; }

    const payStr = String(r[PAYMENT] ?? '').trim();
    const depStr = String(r[DEPOSIT] ?? '').trim();
    const payment = payStr ? parseCashInput(payStr) : { ok: false } as const;
    const deposit = depStr ? parseCashInput(depStr) : { ok: false } as const;
    let amount: Cash | null = null;
    if (payment.ok && payment.value) amount = payment.value.abs().neg();
    else if (deposit.ok && deposit.value) amount = deposit.value.abs();
    if (!amount || amount.isZero()) { skipped++; continue; }

    const typeStr = String(r[TYPE] ?? '').trim().toLowerCase();
    const kind: TxnKind = TXN_TYPE_TO_KIND[typeStr] ?? 'other';

    const cleared = String(r[CLEARED] ?? '').trim().toLowerCase() === 'yes';
    const reconciled =
      RECONCILED >= 0 && String(r[RECONCILED] ?? '').trim().toLowerCase() === 'yes';
    const payeeName = String(r[PAYEE] ?? '').trim();
    const checkNum = CHECK >= 0 ? String(r[CHECK] ?? '').trim() : '';
    const memo = NOTES >= 0 ? String(r[NOTES] ?? '').trim() : '';

    batch.push({
      accountId,
      txnDate: date,
      amount: amount.toString(),
      kind,
      payee: payeeName || null,
      payeeId: payeeName ? payeeIdByName.get(payeeName.toLowerCase()) ?? null : null,
      checkNumber: checkNum || null,
      memo: memo || null,
      clearedState: reconciled ? 'reconciled' : cleared ? 'cleared' : 'uncleared',
      isBackfill: true,
    });
    count++;
  }

  // Bulk insert in chunks (Postgres parameter limit is ~65K; 1000-row chunks
  // well under that for our ~15 columns)
  const CHUNK = 500;
  for (let i = 0; i < batch.length; i += CHUNK) {
    await db.insert(transactions).values(batch.slice(i, i + CHUNK));
  }

  console.log(`  + ${count} transactions (skipped ${skipped})`);
  console.log('Done.');
  exit(0);
}

main().catch((err) => {
  console.error(err);
  exit(1);
});
