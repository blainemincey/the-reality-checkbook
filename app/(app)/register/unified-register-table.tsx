'use client';

import Link from 'next/link';
import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';
import { Cash } from '@/money';
import { Amount } from '@/ui/components/amount';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import {
  toggleClearedStateAction,
  deleteTransactionAction,
} from '../accounts/[id]/txn-actions';
import {
  EditTransactionDialog,
  type EditableTxn,
} from '../accounts/[id]/edit-transaction-dialog';

type ClearedState = 'uncleared' | 'cleared';
type TxnKind =
  | 'deposit' | 'payment' | 'bill_pay' | 'check' | 'atm' | 'interest'
  | 'dividend' | 'transfer' | 'tax_payment' | 'fee' | 'refund' | 'other';

export interface UnifiedRegisterRow {
  id: string;
  accountId: string;
  accountName: string;
  accountInstitution: string | null;
  accountOpeningDate: string;
  accountLogoFilename: string | undefined;
  txnDate: string;
  payee: string | null;
  payeeId: string | null;
  memo: string | null;
  checkNumber: string | null;
  kind: TxnKind | null;
  amount: string;
  clearedState: ClearedState;
  runningBalance: string;
}

interface Props {
  rows: readonly UnifiedRegisterRow[];
  accounts: readonly { id: string; name: string }[];
  payees: readonly { id: string; name: string }[];
}

const PAGE_SIZE_OPTIONS = [25, 50, 75, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const PAGE_SIZE_STORAGE_KEY = 'cr.unified-register.pageSize';
const ACCOUNT_FILTER_STORAGE_KEY = 'cr.unified-register.accountFilter';

export function UnifiedRegisterTable({ rows, accounts, payees }: Props) {
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all');
  const [editing, setEditing] = useState<{
    txn: EditableTxn;
    openingDate: string;
  } | null>(null);

  useEffect(() => {
    const storedSize = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = storedSize ? Number(storedSize) : NaN;
    if (PAGE_SIZE_OPTIONS.includes(n as PageSize)) setPageSize(n as PageSize);
    const storedFilter = window.localStorage.getItem(ACCOUNT_FILTER_STORAGE_KEY);
    if (storedFilter && (storedFilter === 'all' || accounts.some((a) => a.id === storedFilter))) {
      setAccountFilter(storedFilter);
    }
  }, [accounts]);

  useEffect(() => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);
  useEffect(() => {
    window.localStorage.setItem(ACCOUNT_FILTER_STORAGE_KEY, accountFilter);
  }, [accountFilter]);

  const filtered = useMemo(() => {
    if (accountFilter === 'all') return rows;
    return rows.filter((r) => r.accountId === accountFilter);
  }, [rows, accountFilter]);

  const reversed = useMemo(() => [...filtered].reverse(), [filtered]);
  const totalRows = reversed.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = reversed.slice(start, start + pageSize);
  const windowEnd = Math.min(start + pageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openEdit = (r: UnifiedRegisterRow) => {
    setEditing({ txn: toEditable(r), openingDate: r.accountOpeningDate });
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold">Unified ledger</h2>
          <span className="text-[11px] text-text-tertiary">
            newest first · click the status dot to toggle cleared
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
            Account
            <select
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value);
                setPage(1);
              }}
              className="input !py-1 !px-2 text-xs"
            >
              <option value="all">All</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
            Show
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSize);
                setPage(1);
              }}
              className="input !py-1 !px-2 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            per page
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-dense">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="w-10 px-3 py-2 text-center font-medium">✓</th>
              <th className="w-28 px-3 py-2 text-left font-medium">Date</th>
              <th className="w-48 px-3 py-2 text-left font-medium">Account</th>
              <th className="w-28 px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Payee / Memo</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Payment</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Deposit</th>
              <th className="w-32 px-3 py-2 text-right font-medium">
                Combined balance
              </th>
              <th className="w-16 px-2 py-2" aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <Row key={r.id} row={r} onEdit={() => openEdit(r)} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <span className="text-[11px] text-text-tertiary">
          {totalRows === 0
            ? 'no transactions match the current filter'
            : `Showing ${start + 1}–${windowEnd} of ${totalRows}`}
          {accountFilter !== 'all' && ` · filtered to one account`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-ghost !py-1 !px-2 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft size={12} strokeWidth={2} />
            </button>
            <span className="px-2 text-[11px] text-text-secondary">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="btn-ghost !py-1 !px-2 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight size={12} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditTransactionDialog
          txn={editing.txn}
          payees={payees}
          openingDate={editing.openingDate}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function Row({
  row,
  onEdit,
}: {
  row: UnifiedRegisterRow;
  onEdit: () => void;
}) {
  const [optimisticState, setOptimisticState] = useOptimistic<
    ClearedState,
    ClearedState
  >(row.clearedState, (_, next) => next);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const amount = Cash.of(row.amount);
  const isPayment = amount.isNegative();
  const cleared = optimisticState === 'cleared';

  const toggle = () => {
    const next: ClearedState = cleared ? 'uncleared' : 'cleared';
    startTransition(async () => {
      setOptimisticState(next);
      await toggleClearedStateAction(row.id);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTransactionAction(row.id);
    });
  };

  return (
    <tr className="group border-b border-border last:border-b-0 transition-colors hover:bg-surface-elevated">
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          title={cleared ? 'click to mark uncleared' : 'click to mark cleared'}
          aria-label={`Cleared state: ${optimisticState}. Click to toggle.`}
          className={
            'inline-flex h-5 w-5 items-center justify-center rounded-full transition-all duration-120 ease-swift ' +
            (cleared
              ? 'bg-credit text-[#04140A] hover:scale-110'
              : 'border border-border-strong hover:border-accent hover:bg-accent/20')
          }
        >
          {cleared && <Check size={10} strokeWidth={3} />}
        </button>
      </td>
      <td className="px-3 py-2 text-text-secondary">{row.txnDate}</td>
      <td className="px-3 py-2">
        <Link
          href={`/accounts/${row.accountId}`}
          className="inline-flex min-w-0 items-center gap-2 no-underline hover:underline"
        >
          <InstitutionBadge
            institution={row.accountInstitution}
            fallback={row.accountName}
            size="sm"
            logoFilename={row.accountLogoFilename}
          />
          <span className="truncate text-xs text-text-secondary">
            {row.accountName}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-xs capitalize text-text-tertiary">
        {row.kind ? row.kind.replace('_', ' ') : '—'}
      </td>
      <td className="px-3 py-2">
        <div className="truncate">{row.payee || '—'}</div>
        {(row.memo || row.checkNumber) && (
          <div className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {row.checkNumber && <span className="mr-2">#{row.checkNumber}</span>}
            {row.memo}
          </div>
        )}
      </td>
      <td className="amount px-3 py-2 text-debit">
        {isPayment ? amount.abs().toFixed(2) : ''}
      </td>
      <td className="amount px-3 py-2 text-credit">
        {!isPayment && !amount.isZero() ? amount.toFixed(2) : ''}
      </td>
      <td className="px-3 py-2 text-right">
        <Amount value={Cash.of(row.runningBalance)} />
      </td>
      <td className="relative px-2 py-2 text-right">
        {confirmingDelete ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="btn-ghost !py-1 !px-1.5 text-debit"
              title="Confirm delete"
            >
              <Check size={12} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="btn-ghost !py-1 !px-1.5"
              title="Cancel"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-120 ease-swift group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="btn-ghost !py-1 !px-1.5"
              title="Edit"
              aria-label="Edit"
            >
              <Pencil size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="btn-ghost !py-1 !px-1.5 text-debit"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function toEditable(r: UnifiedRegisterRow): EditableTxn {
  const amount = Cash.of(r.amount);
  const isPayment = amount.isNegative();
  return {
    id: r.id,
    txnDate: r.txnDate,
    payeeName: r.payee ?? '',
    payeeId: r.payeeId,
    kind: r.kind,
    depositAmount: isPayment || amount.isZero() ? '' : amount.toFixed(2),
    paymentAmount: isPayment ? amount.abs().toFixed(2) : '',
    memo: r.memo ?? '',
    checkNumber: r.checkNumber ?? '',
    clearedState: r.clearedState,
  };
}
