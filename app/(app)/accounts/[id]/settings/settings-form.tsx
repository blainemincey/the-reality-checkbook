'use client';

import { useActionState, useMemo, useState } from 'react';
import { Cash, parseCashInput, formatCash, formatSigned } from '@/money';
import { updateAccountAction, type UpdateAccountState } from './actions';

interface Defaults {
  name: string;
  openingBalance: string; // NUMERIC string from DB
  openingDate: string;
  institution: string;
  last4: string;
}

interface Props {
  accountId: string;
  defaults: Defaults;
}

const inputClass =
  'block w-full rounded border border-border bg-surface px-3 py-2 text-sm shadow-surface outline-none transition-colors duration-120 ease-swift focus:border-accent';

const initial: UpdateAccountState = {};

export function SettingsForm({ accountId, defaults }: Props) {
  const boundAction = updateAccountAction.bind(null, accountId);
  const [state, action, pending] = useActionState(boundAction, initial);

  const [name, setName] = useState(defaults.name);
  const [openingBalance, setOpeningBalance] = useState(
    // Strip trailing .0000 for a cleaner initial display.
    formatRawForEdit(defaults.openingBalance),
  );
  const [openingDate, setOpeningDate] = useState(defaults.openingDate);
  const [institution, setInstitution] = useState(defaults.institution);
  const [last4, setLast4] = useState(defaults.last4);

  const openingChanged = useMemo(() => {
    const parsedNew = parseCashInput(openingBalance);
    if (!parsedNew.ok || !parsedNew.value) return null;
    const prev = Cash.of(defaults.openingBalance);
    const next = parsedNew.value;
    const delta = next.sub(prev);
    if (delta.isZero() && openingDate === defaults.openingDate) return null;
    return {
      prev,
      next,
      delta,
      dateChanged: openingDate !== defaults.openingDate,
    };
  }, [openingBalance, openingDate, defaults.openingBalance, defaults.openingDate]);

  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <Field label="Name" error={fe.name} htmlFor="name">
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="rounded border border-border bg-surface p-4 shadow-surface">
        <h3 className="mb-1 text-xs uppercase tracking-wider text-text-tertiary">
          Opening balance
        </h3>
        <p className="mb-3 text-xs text-text-secondary">
          This is not a transaction — it's the starting point from which running
          balances are computed. Editing here shifts every downstream running
          balance.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount" error={fe.openingBalance} htmlFor="openingBalance">
            <input
              id="openingBalance"
              name="openingBalance"
              type="text"
              inputMode="decimal"
              required
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className={`${inputClass} amount`}
            />
          </Field>
          <Field label="As of" error={fe.openingDate} htmlFor="openingDate">
            <input
              id="openingDate"
              name="openingDate"
              type="date"
              required
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {openingChanged && (
          <div
            role="alert"
            className="mt-4 rounded border border-debit/40 bg-debit/5 px-3 py-2 text-xs text-text"
          >
            <div className="font-medium">Heads up:</div>
            <ul className="mt-1 space-y-0.5 text-text-secondary">
              <li>
                Amount:{' '}
                <span className="amount">{formatCash(openingChanged.prev)}</span> →{' '}
                <span className="amount">{formatCash(openingChanged.next)}</span>{' '}
                ({' '}
                <span
                  className={
                    'amount ' +
                    (openingChanged.delta.isNegative() ? 'text-debit' : 'text-credit')
                  }
                >
                  {formatSigned(openingChanged.delta)}
                </span>
                )
              </li>
              {openingChanged.dateChanged && (
                <li>
                  Date: {defaults.openingDate} → {openingDate}
                </li>
              )}
              <li>
                Every downstream running balance will shift by{' '}
                <span
                  className={
                    'amount ' +
                    (openingChanged.delta.isNegative() ? 'text-debit' : 'text-credit')
                  }
                >
                  {formatSigned(openingChanged.delta)}
                </span>
                .
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Field label="Institution" htmlFor="institution">
          <input
            id="institution"
            name="institution"
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Last 4" error={fe.last4} htmlFor="last4">
          <input
            id="last4"
            name="last4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={last4}
            onChange={(e) => setLast4(e.target.value)}
            className={`${inputClass} w-20`}
          />
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-debit">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-credit">
          {state.success}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity duration-120 ease-swift hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | undefined;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs text-text-secondary">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-debit">{error}</p>}
    </div>
  );
}

function formatRawForEdit(raw: string): string {
  // The DB returns NUMERIC as a string like "1234.5600". For editing we show
  // the minimum decimals needed. If fractional == 0, show integer.
  const [intPart, fracPart] = raw.split('.');
  if (!fracPart || /^0+$/.test(fracPart)) return intPart ?? raw;
  const trimmed = fracPart.replace(/0+$/, '');
  return `${intPart}.${trimmed}`;
}
