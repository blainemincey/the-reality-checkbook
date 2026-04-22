'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Combobox } from '@/ui/components/combobox';
import {
  createTransactionAction,
  type EntryInput,
  type TxnKind,
} from './entry-action';

interface EntryAccount {
  readonly id: string;
  readonly name: string;
  readonly openingDate: string;
}

interface Props {
  /**
   * One entry: hides the Account select (single-account mode).
   * Two or more: shows an Account select as the first field.
   */
  accounts: readonly EntryAccount[];
  payees: readonly { id: string; name: string }[];
  /** Initial account id (multi-mode only). Defaults to the first. */
  defaultAccountId?: string;
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

function isoToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

const emptyEntry = (openingDate: string): EntryInput => ({
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

export function EntryRow({ accounts, payees, defaultAccountId }: Props) {
  const router = useRouter();
  const isMulti = accounts.length > 1;

  const initialAccountId =
    (defaultAccountId && accounts.find((a) => a.id === defaultAccountId)?.id) ??
    accounts[0]!.id;
  const [accountId, setAccountId] = useState<string>(initialAccountId);

  const currentAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? accounts[0]!,
    [accounts, accountId],
  );

  const [state, setState] = useState<EntryInput>(() =>
    emptyEntry(currentAccount.openingDate),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const payeeInputRef = useRef<HTMLInputElement>(null);

  // When switching accounts, bump the date forward if it predates the new
  // opening_date so the input's min doesn't block submit.
  useEffect(() => {
    setState((s) =>
      s.txnDate < currentAccount.openingDate
        ? { ...s, txnDate: currentAccount.openingDate }
        : s,
    );
  }, [currentAccount.openingDate]);

  const options = payees.map((p) => ({ id: p.id, label: p.name }));

  const submit = () => {
    setError(null);
    setSuccess(null);

    const kind: TxnKind | null =
      state.kind ??
      (state.depositAmount.trim()
        ? 'deposit'
        : state.paymentAmount.trim()
          ? 'payment'
          : null);

    const target = currentAccount;
    startSave(async () => {
      const result = await createTransactionAction(target.id, { ...state, kind });
      if (!result.ok) {
        setError(result.error ?? 'Save failed');
        return;
      }
      setSuccess(
        result.inserted
          ? `Added to ${target.name}: ${result.inserted.payeeName || 'transaction'} — ${result.inserted.amount}`
          : 'Added',
      );
      setState(emptyEntry(target.openingDate));
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

  // Grid template expands when the Account select is present.
  const gridCols = isMulti
    ? 'md:grid-cols-[10rem_9rem_1fr_7rem_6.75rem_6.75rem_auto]'
    : 'md:grid-cols-[9rem_1fr_7rem_6.75rem_6.75rem_auto]';

  return (
    <section className="card" onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          New transaction
        </h2>
        <span className="text-[10px] text-text-tertiary">⌘⏎ to save</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`grid grid-cols-1 gap-3 px-4 py-3 md:items-start ${gridCols}`}
      >
        {isMulti && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Account
            </span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Date
          </span>
          <input
            type="date"
            required
            min={currentAccount.openingDate}
            value={state.txnDate}
            onChange={(e) => setState((s) => ({ ...s, txnDate: e.target.value }))}
            className="input"
          />
        </label>

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

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Type
          </span>
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
        </label>

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
            className={`input amount ${depositFocused ? 'border-credit' : ''}`}
          />
        </label>

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
            className={`input amount ${paymentFocused ? 'border-debit' : ''}`}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-transparent md:block">
            &nbsp;
          </span>
          <button type="submit" disabled={saving} className="btn-primary h-[2.375rem]">
            <Check size={14} strokeWidth={2.5} />
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>

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
              className="input"
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
              className="input"
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
