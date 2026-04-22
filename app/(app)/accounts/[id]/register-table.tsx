'use client';

import { useEffect, useMemo, useOptimistic, useState, useTransition } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';
import { Cash } from '@/money';
import { Amount } from '@/ui/components/amount';
import {
  toggleClearedStateAction,
  deleteTransactionAction,
} from './txn-actions';
import { EditTransactionDialog, type EditableTxn } from './edit-transaction-dialog';

type ClearedState = 'uncleared' | 'cleared';
type TxnKind =
  | 'deposit' | 'payment' | 'bill_pay' | 'check' | 'atm' | 'interest'
  | 'dividend' | 'transfer' | 'tax_payment' | 'fee' | 'refund' | 'other';

export interface RegisterRowData {
  id: string;
  txnDate: string;
  payee: string | null;
  memo: string | null;
  checkNumber: string | null;
  amount: string; // Cash.toString()
  kind: TxnKind | null;
  clearedState: ClearedState;
  payeeId: string | null;
  runningBalance: string; // Cash.toString()
}

interface Props {
  rows: readonly RegisterRowData[];
  payees: readonly { id: string; name: string }[];
  /** The account (or all accounts if txn-moving is allowed). Each entry
   *  carries openingDate for date-validation. */
  accounts: readonly { id: string; name: string; openingDate: string }[];
  /** Default when rows are being seen in a single-account context. */
  currentAccountId: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 75] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const PAGE_SIZE_STORAGE_KEY = 'cr.register.pageSize';

export function RegisterTable({ rows, payees, accounts, currentAccountId }: Props) {
  const [editing, setEditing] = useState<EditableTxn | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);

  // Restore page-size preference.
  useEffect(() => {
    const stored = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = stored ? Number(stored) : NaN;
    if (PAGE_SIZE_OPTIONS.includes(n as PageSize)) setPageSize(n as PageSize);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  // Reverse-chronological ordering, then page.
  const reversed = useMemo(() => [...rows].reverse(), [rows]);
  const totalRows = reversed.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = reversed.slice(start, start + pageSize);
  const windowEnd = Math.min(start + pageSize, totalRows);

  // Clamp on data changes.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold">Register</h2>
          <span className="text-[11px] text-text-tertiary">
            click the status dot to toggle cleared
          </span>
        </div>
        <div className="flex items-center gap-2">
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
              <th className="w-28 px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Payee / Memo</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Payment</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Deposit</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Balance</th>
              <th className="w-16 px-2 py-2" aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <Row key={r.id} row={r} onEdit={() => setEditing(toEditable(r, currentAccountId))} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <span className="text-[11px] text-text-tertiary">
          {totalRows === 0
            ? 'no transactions'
            : `Showing ${start + 1}–${windowEnd} of ${totalRows}`}
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
          txn={editing}
          payees={payees}
          accounts={accounts}
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
  row: RegisterRowData;
  onEdit: () => void;
}) {
  const [optimisticState, setOptimisticState] = useOptimistic<
    ClearedState,
    ClearedState
  >(row.clearedState, (_, next) => next);
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isPayment = Cash.of(row.amount).isNegative();
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
        {isPayment ? Cash.of(row.amount).abs().toFixed(2) : ''}
      </td>
      <td className="amount px-3 py-2 text-credit">
        {!isPayment && !Cash.of(row.amount).isZero() ? Cash.of(row.amount).toFixed(2) : ''}
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

function toEditable(r: RegisterRowData, accountId: string): EditableTxn {
  const amount = Cash.of(r.amount);
  const isPayment = amount.isNegative();
  return {
    id: r.id,
    accountId,
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
