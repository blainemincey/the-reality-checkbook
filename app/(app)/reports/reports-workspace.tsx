'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Cash, formatCash, formatSigned } from '@/money';
import {
  monthlyCashflow,
  spendingByKind,
  topPayees,
  type ReportTxn,
} from '@/domain/reports';
import { CashflowChart, type CashflowPoint } from '@/ui/components/charts/cashflow-chart';
import { PeriodSelector, usePersistedPeriod, type Period } from './period-selector';

interface RowInput {
  id: string;
  txnDate: string;
  amount: string; // Cash.toString()
  clearedState: 'uncleared' | 'cleared';
  payee: string | null;
  kind:
    | 'deposit' | 'payment' | 'bill_pay' | 'check' | 'atm' | 'interest'
    | 'dividend' | 'transfer' | 'tax_payment' | 'fee' | 'refund' | 'other' | null;
}

interface Props {
  transactions: readonly RowInput[];
  todayIso: string; // YYYY-MM-DD
}

const STAT_TEXT = [
  'text-stat-1',
  'text-stat-2',
  'text-stat-3',
  'text-stat-4',
  'text-stat-5',
  'text-stat-6',
  'text-stat-7',
  'text-stat-8',
] as const;
const STAT_BG = [
  'bg-stat-1',
  'bg-stat-2',
  'bg-stat-3',
  'bg-stat-4',
  'bg-stat-5',
  'bg-stat-6',
  'bg-stat-7',
  'bg-stat-8',
] as const;

const KIND_LABEL: Record<string, string> = {
  bill_pay: 'Bill Pay',
  check: 'Check',
  atm: 'ATM',
  payment: 'Payment',
  deposit: 'Deposit',
  interest: 'Interest',
  dividend: 'Dividend',
  transfer: 'Transfer',
  tax_payment: 'Tax Payment',
  fee: 'Fee',
  refund: 'Refund',
  other: 'Other',
  unset: '(none)',
};

function cutoffForPeriod(todayIso: string, period: Period): string | null {
  if (period === 'all') return null;
  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const [y, m, d] = todayIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  dt.setUTCMonth(dt.getUTCMonth() - months);
  return dt.toISOString().slice(0, 10);
}

export function ReportsWorkspace({ transactions, todayIso }: Props) {
  const [period, setPeriod] = usePersistedPeriod('12m');

  const filtered: ReportTxn[] = useMemo(() => {
    const cutoff = cutoffForPeriod(todayIso, period);
    const pool = cutoff
      ? transactions.filter((t) => t.txnDate >= cutoff)
      : transactions;
    return pool.map((t) => ({
      id: t.id,
      txnDate: t.txnDate,
      amount: Cash.of(t.amount),
      clearedState: t.clearedState,
      payee: t.payee,
      kind: t.kind,
    }));
  }, [transactions, period, todayIso]);

  const cashflow = useMemo(() => monthlyCashflow(filtered), [filtered]);
  const cashflowPoints: CashflowPoint[] = cashflow.map((r) => ({
    month: r.month,
    deposits: Number(r.deposits.toString()),
    payments: Number(r.payments.toString()),
    net: Number(r.net.toString()),
  }));

  const totalDeposits = cashflow.reduce(
    (acc, r) => acc.add(r.deposits),
    Cash.zero(),
  );
  const totalPayments = cashflow.reduce(
    (acc, r) => acc.add(r.payments),
    Cash.zero(),
  );
  const totalNet = totalDeposits.sub(totalPayments);

  const topSpending = useMemo(() => topPayees(filtered, 'payments', 10), [filtered]);
  const topIncome = useMemo(() => topPayees(filtered, 'deposits', 10), [filtered]);
  const kindRollup = useMemo(() => spendingByKind(filtered), [filtered]);
  const totalSpent = kindRollup.reduce((acc, r) => acc.add(r.total), Cash.zero());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <SummaryNumber label="Money in" value={formatCash(totalDeposits)} tone="credit" />
          <SummaryNumber label="Money out" value={formatCash(totalPayments)} tone="debit" />
          <SummaryNumber
            label="Net"
            value={formatSigned(totalNet)}
            tone={totalNet.isNegative() ? 'debit' : 'credit'}
          />
          <span className="text-xs text-text-tertiary">
            · {filtered.length} transactions
          </span>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Monthly cashflow */}
      <section className="card p-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Monthly cashflow</h2>
          <span className="text-[11px] text-text-tertiary">
            deposits vs payments vs net per month
          </span>
        </header>
        <CashflowChart data={cashflowPoints} height={280} />
      </section>

      {/* Top payees: income + spending side by side */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PayeeTable
          title="Top income sources"
          subtitle="largest deposits by payee"
          tone="credit"
          rows={topIncome}
        />
        <PayeeTable
          title="Top spending"
          subtitle="largest payments by payee"
          tone="debit"
          rows={topSpending}
        />
      </section>

      {/* Spending by type */}
      <section className="card p-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Spending by type</h2>
          <span className="text-[11px] text-text-tertiary">
            share of {formatCash(totalSpent)} outbound
          </span>
        </header>
        {kindRollup.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-tertiary">
            No payments in this period.
          </p>
        ) : (
          <ul className="space-y-2">
            {kindRollup.map((r, i) => {
              const pct = totalSpent.isZero()
                ? 0
                : (Number(r.total.toString()) / Number(totalSpent.toString())) * 100;
              const toneIdx = i % 8;
              return (
                <li key={r.kind}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium text-text">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                    <span className="text-text-tertiary">
                      <span className={`amount ${STAT_TEXT[toneIdx]} font-medium`}>
                        {formatCash(r.total)}
                      </span>
                      <span className="ml-2">
                        {pct.toFixed(1)}% · {r.count} txn{r.count === 1 ? '' : 's'}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-border">
                    <div
                      className={`h-full ${STAT_BG[toneIdx]}`}
                      style={{ width: `${Math.max(pct, 0.5)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryNumber({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'credit' | 'debit' | 'neutral';
}) {
  const toneClass =
    tone === 'credit' ? 'text-credit' : tone === 'debit' ? 'text-debit' : 'text-text';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      <div className={`amount-display mt-0.5 text-2xl ${toneClass}`}>{value}</div>
    </div>
  );
}

function PayeeTable({
  title,
  subtitle,
  tone,
  rows,
}: {
  title: string;
  subtitle: string;
  tone: 'credit' | 'debit';
  rows: ReadonlyArray<{ payee: string; total: Cash; count: number }>;
}) {
  const toneClass = tone === 'credit' ? 'text-credit' : 'text-debit';
  return (
    <div className="card overflow-hidden">
      <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[11px] text-text-tertiary">{subtitle}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-text-tertiary">
          No {tone === 'credit' ? 'deposits' : 'payments'} in this period.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.payee}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate">{r.payee}</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">
                  {r.count} transaction{r.count === 1 ? '' : 's'}
                </div>
              </div>
              <span className={`amount font-medium ${toneClass}`}>
                {formatCash(r.total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
