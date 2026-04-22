'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { Cash, formatCash } from '@/money';
import { Amount } from '@/ui/components/amount';
import {
  cycleClearedStateAction,
  deleteTransactionAction,
} from './txn-actions';
import { EditTransactionDialog, type EditableTxn } from './edit-transaction-dialog';

type ClearedState = 'uncleared' | 'cleared' | 'reconciled';
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
  openingDate: string;
}

export function RegisterTable({ rows, payees, openingDate }: Props) {
  // Reverse chronological: latest first.
  const [editing, setEditing] = useState<EditableTxn | null>(null);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Register</h2>
        <span className="text-[11px] text-text-tertiary">
          click the status dot to cycle uncleared · cleared · reconciled
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-dense">
          <thead className="border-b border-border text-[11px] uppercase tracking-wider text-text-tertiary">
            <tr>
              <th className="w-10 px-3 py-2 text-center font-medium">✓</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Date</th>
              <th className="w-28 px-3 py-2 text-left font-medium">Kind</th>
              <th className="px-3 py-2 text-left font-medium">Payee / Memo</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Payment</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Deposit</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Balance</th>
              <th className="w-16 px-2 py-2" aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <Row key={r.id} row={r} onEdit={() => setEditing(toEditable(r))} />
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditTransactionDialog
          txn={editing}
          payees={payees}
          openingDate={openingDate}
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
  const cleared = optimisticState !== 'uncleared';
  const reconciled = optimisticState === 'reconciled';

  const cycle = () => {
    const next: ClearedState =
      optimisticState === 'uncleared'
        ? 'cleared'
        : optimisticState === 'cleared'
          ? 'reconciled'
          : 'uncleared';
    startTransition(async () => {
      setOptimisticState(next);
      await cycleClearedStateAction(row.id);
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
          onClick={cycle}
          disabled={pending}
          title={`click to mark ${
            optimisticState === 'uncleared'
              ? 'cleared'
              : optimisticState === 'cleared'
                ? 'reconciled'
                : 'uncleared'
          }`}
          aria-label={`Cleared state: ${optimisticState}. Click to cycle.`}
          className={
            'inline-flex h-5 w-5 items-center justify-center rounded-full transition-all duration-120 ease-swift ' +
            (reconciled
              ? 'bg-stat-6 text-[#04140A] hover:scale-110'
              : cleared
                ? 'bg-credit text-[#04140A] hover:scale-110'
                : 'border border-border-strong hover:border-accent hover:bg-accent/20')
          }
        >
          {reconciled ? (
            <Check size={10} strokeWidth={3} />
          ) : cleared ? (
            <Check size={10} strokeWidth={3} />
          ) : null}
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

function toEditable(r: RegisterRowData): EditableTxn {
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
