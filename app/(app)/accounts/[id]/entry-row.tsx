'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/ui/components/combobox';
import {
  createTransactionAction,
  type EntryInput,
  type TxnKind,
} from './entry-action';

interface Props {
  accountId: string;
  openingDate: string; // YYYY-MM-DD
  payees: readonly { id: string; name: string }[];
}

type PayeeOption = ComboboxOption;

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

function isoToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

const emptyEntry = (openingDate: string): EntryInput & { [k: string]: unknown } => ({
  txnDate: maxDate(isoToday(), openingDate),
  payeeName: '',
  payeeId: null,
  kind: null,
  depositAmount: '',
  paymentAmount: '',
  memo: '',
  checkNumber: '',
  cleared: false,
});

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function EntryRow({ accountId, openingDate, payees }: Props) {
  const router = useRouter();
  const [state, setState] = useState<EntryInput>(() => emptyEntry(openingDate));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const payeeInputRef = useRef<HTMLInputElement>(null);

  const options: PayeeOption[] = payees.map((p) => ({ id: p.id, label: p.name }));

  const submit = () => {
    setError(null);
    setSuccess(null);

    // Auto-pick kind if the user didn't override it.
    const kind: TxnKind | null =
      state.kind ??
      (state.depositAmount.trim() ? 'deposit' : state.paymentAmount.trim() ? 'payment' : null);

    startSave(async () => {
      const result = await createTransactionAction(accountId, {
        ...state,
        kind,
      });
      if (!result.ok) {
        setError(result.error ?? 'Save failed');
        return;
      }
      setSuccess(
        result.inserted
          ? `Added ${result.inserted.payeeName || 'transaction'} — ${result.inserted.amount}`
          : 'Added',
      );
      setState(emptyEntry(openingDate));
      // Return focus to the payee field for rapid chained entry.
      setTimeout(() => payeeInputRef.current?.focus(), 0);
      router.refresh();
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  const depositFocused = state.depositAmount.length > 0;
  const paymentFocused = state.paymentAmount.length > 0;

  return (
    <section
      className="rounded-lg border border-border bg-surface shadow-surface"
      onKeyDown={onKeyDown}
    >
      <div className="border-b border-border px-4 py-2">
        <h2 className="text-xs uppercase tracking-wider text-text-tertiary">
          New transaction
        </h2>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[7rem_1fr_7rem_6.5rem_6.5rem_auto] md:items-start"
      >
        {/* Date */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Date
          </span>
          <input
            ref={firstFieldRef}
            type="date"
            required
            min={openingDate}
            value={state.txnDate}
            onChange={(e) => setState((s) => ({ ...s, txnDate: e.target.value }))}
            className="input !py-1.5"
          />
        </label>

        {/* Payee (combobox + memo below) */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Payee
          </span>
          <Combobox
            inputRef={payeeInputRef}
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
        </div>

        {/* Kind */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Kind
          </span>
          <select
            value={state.kind ?? ''}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                kind: (e.target.value || null) as TxnKind | null,
              }))
            }
            className="input !py-1.5"
          >
            <option value="">Auto</option>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        {/* Deposit */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-credit">
            Deposit
          </span>
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
            className={`input amount !py-1.5 ${depositFocused ? 'border-credit' : ''}`}
          />
        </label>

        {/* Payment */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-debit">
            Payment
          </span>
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
            className={`input amount !py-1.5 ${paymentFocused ? 'border-debit' : ''}`}
          />
        </label>

        {/* Submit */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-transparent md:block">
            &nbsp;
          </span>
          <button type="submit" disabled={saving} className="btn-primary !py-1.5">
            <Check size={14} strokeWidth={2.5} />
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>

        {/* Secondary row: memo, check #, cleared */}
        <div className="col-span-full grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_7rem_auto]">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Memo
            </span>
            <input
              type="text"
              placeholder="optional"
              value={state.memo}
              onChange={(e) => setState((s) => ({ ...s, memo: e.target.value }))}
              className="input !py-1.5"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Check #
            </span>
            <input
              type="text"
              placeholder="optional"
              inputMode="numeric"
              value={state.checkNumber}
              onChange={(e) => setState((s) => ({ ...s, checkNumber: e.target.value }))}
              className="input !py-1.5"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 self-center pt-5 text-xs text-text-secondary">
            <input
              type="checkbox"
              className="checkbox"
              checked={state.cleared}
              onChange={(e) => setState((s) => ({ ...s, cleared: e.target.checked }))}
            />
            Cleared
          </label>
        </div>

        {/* Feedback */}
        {(error || success) && (
          <div className="col-span-full">
            {error && <p className="text-xs text-debit">{error}</p>}
            {success && <p className="text-xs text-credit">{success}</p>}
          </div>
        )}
      </form>
    </section>
  );
}
