'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cash } from '@/money';
import { formatCash, formatSigned } from '@/money';
import {
  parsePaste,
  type ColumnType,
  type ParsedPaste,
  type ParsedRow,
} from '@/domain/bootstrap/paste-parser';
import { backfillPreview } from '@/domain/accounts';
import type { LedgerTransaction } from '@/domain/accounts';
import { commitBackfillAction, type CommitRow } from './actions';

interface Props {
  accountId: string;
  openingBalance: string; // NUMERIC string from DB
  openingDate: string; // YYYY-MM-DD
}

interface WorkingRow {
  // derived from parse, mutable locally
  rowIndex: number;
  txnDate: string | null;
  dateError: string | null;
  amount: string | null; // fixed-4 Cash string
  amountError: string | null;
  payee: string;
  memo: string | null;
  checkNumber: string | null;
  cleared: boolean;
  include: boolean;
}

const COLUMN_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'payee', label: 'Payee' },
  { value: 'amount', label: 'Amount' },
  { value: 'memo', label: 'Memo' },
  { value: 'check_number', label: 'Check #' },
  { value: 'category', label: 'Category' },
  { value: 'ignored', label: '(ignored)' },
];

export function BackfillWorkspace({ accountId, openingBalance, openingDate }: Props) {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [overrides, setOverrides] = useState<Record<number, ColumnType>>({});
  const [rows, setRows] = useState<WorkingRow[]>([]);
  const [committing, startCommit] = useTransition();
  const [commitError, setCommitError] = useState<string | null>(null);

  const parsed: ParsedPaste = useMemo(
    () => (raw.trim() ? parsePaste(raw, { columnOverrides: overrides }) : emptyParse()),
    [raw, overrides],
  );

  // Re-seed working rows when parse result changes, preserving per-row toggles
  // where rowIndex matches.
  useMemo(() => {
    setRows((prev) => {
      return parsed.rows.map<WorkingRow>((r) => {
        const existing = prev.find((p) => p.rowIndex === r.rowIndex);
        return {
          rowIndex: r.rowIndex,
          txnDate: r.date,
          dateError: r.dateError,
          amount: r.amount?.toString() ?? null,
          amountError: r.amountError,
          payee: r.payee,
          memo: r.memo,
          checkNumber: r.checkNumber,
          cleared: existing?.cleared ?? false,
          include: existing?.include ?? defaultInclude(r),
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed]);

  const preview = useMemo(() => {
    const included = rows.filter((r) => r.include && r.txnDate && r.amount);
    const txns: LedgerTransaction[] = included.map((r) => ({
      id: `row-${r.rowIndex}`,
      txnDate: r.txnDate!,
      amount: Cash.of(r.amount!),
      clearedState: r.cleared ? 'cleared' : 'uncleared',
    }));
    return backfillPreview(
      { openingBalance: Cash.of(openingBalance), openingDate },
      txns,
    );
  }, [rows, openingBalance, openingDate]);

  const validCount = rows.filter((r) => r.include && !r.dateError && !r.amountError).length;
  const errorCount = rows.filter(
    (r) => r.include && (r.dateError || r.amountError),
  ).length;
  const preOpeningCount = rows.filter(
    (r) => r.include && r.txnDate && r.txnDate < openingDate,
  ).length;

  const canCommit = validCount > 0 && errorCount === 0 && preOpeningCount === 0 && !committing;

  const handleCommit = () => {
    setCommitError(null);
    const commitRows: CommitRow[] = rows
      .filter((r) => r.include && r.txnDate && r.amount && !r.dateError && !r.amountError)
      .map((r) => ({
        txnDate: r.txnDate!,
        payee: r.payee || null,
        amount: r.amount!,
        memo: r.memo,
        checkNumber: r.checkNumber,
        cleared: r.cleared,
      }));

    startCommit(async () => {
      const result = await commitBackfillAction(accountId, commitRows);
      if (!result.ok) {
        setCommitError(result.error ?? 'Commit failed');
        return;
      }
      router.push(`/accounts/${accountId}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Paste area */}
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
          Paste from spreadsheet
        </h2>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          placeholder="Date&#9;Payee&#9;Amount&#9;Memo&#10;11/2/2026&#9;Target&#9;-45.67&#9;groceries"
          className="input font-mono !text-xs"
        />
        <p className="mt-2 text-xs text-text-tertiary">
          Tab-separated (Google Sheets default) or CSV. First row is auto-detected
          as a header.
        </p>
      </section>

      {parsed.rows.length > 0 && (
        <>
          {/* Column-type mapper */}
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
              Columns
            </h2>
            <div className="flex flex-wrap gap-3">
              {parsed.columns.map((c) => (
                <label key={c.index} className="flex items-center gap-2 text-xs">
                  <span className="text-text-tertiary">
                    {c.header ? `"${c.header}"` : `col ${c.index + 1}`}
                  </span>
                  <select
                    value={overrides[c.index] ?? c.detectedType}
                    onChange={(e) =>
                      setOverrides((o) => ({ ...o, [c.index]: e.target.value as ColumnType }))
                    }
                    className="input !py-1 !px-2 text-xs"
                  >
                    {COLUMN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {parsed.warnings.length > 0 && (
              <p className="mt-2 text-xs text-debit">
                {parsed.warnings.join('; ')}
              </p>
            )}
          </section>

          {/* Preview table */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-wider text-text-tertiary">Rows</h2>
              <span className="text-xs text-text-tertiary">
                {validCount} valid · {errorCount} error{errorCount === 1 ? '' : 's'}
                {preOpeningCount > 0 && ` · ${preOpeningCount} before opening_date`}
              </span>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-dense">
                <thead className="border-b border-border text-xs text-text-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left font-normal">Incl.</th>
                    <th className="px-3 py-2 text-left font-normal">Cleared</th>
                    <th className="px-3 py-2 text-left font-normal">Date</th>
                    <th className="px-3 py-2 text-left font-normal">Payee</th>
                    <th className="px-3 py-2 text-right font-normal">Amount</th>
                    <th className="px-3 py-2 text-left font-normal">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const preOpening = !!r.txnDate && r.txnDate < openingDate;
                    return (
                      <tr
                        key={r.rowIndex}
                        className={
                          'border-b border-border last:border-b-0 ' +
                          (!r.include ? 'opacity-50 ' : '') +
                          (r.dateError || r.amountError || preOpening ? 'bg-debit/5' : '')
                        }
                      >
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={r.include}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.rowIndex === r.rowIndex
                                    ? { ...x, include: e.target.checked }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={r.cleared}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.rowIndex === r.rowIndex
                                    ? { ...x, cleared: e.target.checked }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5 text-text-secondary">
                          {r.txnDate ?? (
                            <span className="text-debit">{r.dateError ?? '—'}</span>
                          )}
                          {preOpening && (
                            <div className="text-[10px] text-debit">before opening</div>
                          )}
                        </td>
                        <td className="px-3 py-1.5">{r.payee || '—'}</td>
                        <td className="px-3 py-1.5 text-right">
                          {r.amount ? (
                            <span
                              className={
                                'amount ' +
                                (Cash.of(r.amount).isNegative()
                                  ? 'text-debit'
                                  : 'text-credit')
                              }
                            >
                              {formatSigned(Cash.of(r.amount))}
                            </span>
                          ) : (
                            <span className="text-debit">{r.amountError ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-text-secondary">{r.memo ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Math preview */}
          <section className="card px-4 py-4">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-text-tertiary">
              Preview
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
              <Stat
                label={`Opening ${openingDate}`}
                value={formatCash(Cash.of(openingBalance))}
              />
              <Stat
                label={`Backfill ${preview.backfillCount}`}
                value={formatSigned(preview.backfillSum)}
                tone={preview.backfillSum.isNegative() ? 'debit' : 'credit'}
              />
              <Stat
                label={`Uncleared ${preview.unclearedCount}`}
                value={formatSigned(preview.unclearedSum)}
                tone={preview.unclearedSum.isNegative() ? 'debit' : 'credit'}
                muted
              />
              <Stat
                label="Projected"
                value={formatCash(preview.projectedBalance)}
                tone="accent"
              />
            </dl>
          </section>

          {commitError && (
            <p role="alert" className="text-sm text-debit">
              {commitError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCommit}
              disabled={!canCommit}
              className="rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity duration-120 ease-swift hover:opacity-90 disabled:opacity-40"
            >
              {committing ? 'Committing…' : `Commit ${validCount} row${validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'debit' | 'credit' | 'accent';
  muted?: boolean;
}) {
  const toneClass =
    tone === 'debit'
      ? 'text-debit'
      : tone === 'credit'
        ? 'text-credit'
        : tone === 'accent'
          ? 'text-text font-medium'
          : 'text-text';
  return (
    <div className={muted ? 'opacity-80' : ''}>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className={`amount mt-0.5 text-sm ${toneClass}`}>{value}</dd>
    </div>
  );
}

function defaultInclude(r: ParsedRow): boolean {
  return !r.dateError && !r.amountError;
}

function emptyParse(): ParsedPaste {
  return { hasHeader: false, columns: [], rows: [], warnings: [] };
}
