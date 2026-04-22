'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Combobox } from '@/ui/components/combobox';
import { updateTransactionAction, type UpdateTxnInput } from './txn-actions';

type ClearedState = 'uncleared' | 'cleared';
type TxnKind =
  | 'deposit' | 'payment' | 'bill_pay' | 'check' | 'atm' | 'interest'
  | 'dividend' | 'transfer' | 'tax_payment' | 'fee' | 'refund' | 'other';

export interface EditableTxn {
  id: string;
  txnDate: string;
  payeeName: string;
  payeeId: string | null;
  kind: TxnKind | null;
  depositAmount: string;
  paymentAmount: string;
  memo: string;
  checkNumber: string;
  clearedState: ClearedState;
}

interface Props {
  txn: EditableTxn;
  payees: readonly { id: string; name: string }[];
  openingDate: string;
  onClose: () => void;
}

const KIND_OPTIONS: Array<{ value: TxnKind; label: string }> = [
  { value: 'bill_pay', label: 'Bill Pay' },
  { value: 'check', label: 'Check' },
  { value: 'atm', label: 'ATM' },
  { value: 'payment', label: 'Payment' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'interest', label: 'Interest' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'tax_payment', label: 'Tax Payment' },
  { value: 'fee', label: 'Fee' },
  { value: 'refund', label: 'Refund' },
  { value: 'other', label: 'Other' },
];

export function EditTransactionDialog({ txn, payees, openingDate, onClose }: Props) {
  const router = useRouter();
  const [state, setState] = useState<EditableTxn>(txn);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const submit = () => {
    setError(null);
    const payload: UpdateTxnInput = {
      txnDate: state.txnDate,
      payeeName: state.payeeName,
      payeeId: state.payeeId,
      kind: state.kind,
      depositAmount: state.depositAmount,
      paymentAmount: state.paymentAmount,
      memo: state.memo,
      checkNumber: state.checkNumber,
      clearedState: state.clearedState,
    };
    startSave(async () => {
      const result = await updateTransactionAction(txn.id, payload);
      if (!result.ok) {
        setError(result.error ?? 'Save failed');
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const options = payees.map((p) => ({ id: p.id, label: p.name }));
  const paymentFocused = state.paymentAmount.length > 0;
  const depositFocused = state.depositAmount.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="card w-full max-w-2xl shadow-card"
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-txn-title"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="edit-txn-title" className="text-sm font-semibold">
            Edit transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-tertiary transition-colors duration-120 ease-swift hover:bg-surface-elevated hover:text-text"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2"
        >
          <Field label="Date">
            <input
              type="date"
              required
              min={openingDate}
              value={state.txnDate}
              onChange={(e) => setState((s) => ({ ...s, txnDate: e.target.value }))}
              className="input"
            />
          </Field>

          <Field label="Cleared">
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={state.clearedState === 'cleared'}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    clearedState: e.target.checked ? 'cleared' : 'uncleared',
                  }))
                }
              />
              <span className="text-text-secondary">
                {state.clearedState === 'cleared'
                  ? 'Cleared by the bank'
                  : 'Outstanding / uncleared'}
              </span>
            </label>
          </Field>

          <Field label="Payee" className="md:col-span-2">
            <Combobox
              options={options}
              value={state.payeeName}
              onChange={(label, opt) =>
                setState((s) => ({
                  ...s,
                  payeeName: label,
                  payeeId: opt?.id ?? null,
                }))
              }
              placeholder="Target, Direct Deposit, …"
              allowCreate
            />
          </Field>

          <Field label="Kind">
            <select
              value={state.kind ?? ''}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  kind: (e.target.value || null) as TxnKind | null,
                }))
              }
              className="input"
            >
              <option value="">Auto</option>
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Check #">
            <input
              type="text"
              inputMode="numeric"
              value={state.checkNumber}
              onChange={(e) => setState((s) => ({ ...s, checkNumber: e.target.value }))}
              className="input"
              placeholder="optional"
            />
          </Field>

          <Field label="Payment">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={state.paymentAmount}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  paymentAmount: e.target.value,
                  depositAmount: e.target.value ? '' : s.depositAmount,
                }))
              }
              disabled={depositFocused}
              className="input amount"
            />
          </Field>

          <Field label="Deposit">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={state.depositAmount}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  depositAmount: e.target.value,
                  paymentAmount: e.target.value ? '' : s.paymentAmount,
                }))
              }
              disabled={paymentFocused}
              className="input amount"
            />
          </Field>

          <Field label="Memo" className="md:col-span-2">
            <input
              type="text"
              value={state.memo}
              onChange={(e) => setState((s) => ({ ...s, memo: e.target.value }))}
              className="input"
              placeholder="optional"
            />
          </Field>

          {error && (
            <p role="alert" className="md:col-span-2 text-xs text-debit">
              {error}
            </p>
          )}

          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      {children}
    </label>
  );
}
