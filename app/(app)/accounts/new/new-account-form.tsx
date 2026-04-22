'use client';

import { useActionState } from 'react';
import { createAccountAction, type CreateAccountState } from './actions';

const initial: CreateAccountState = {};

const ACCOUNT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'cash', label: 'Cash' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'retirement', label: 'Retirement' },
];

function isoToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export function NewAccountForm() {
  const [state, action, pending] = useActionState(createAccountAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="card space-y-5 p-5">
      <Field label="Name" error={fe.name} htmlFor="name">
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          placeholder="e.g. Joint Checking"
          className="input"
        />
      </Field>

      <Field label="Type" error={fe.accountType} htmlFor="accountType">
        <select
          id="accountType"
          name="accountType"
          required
          defaultValue="checking"
          className="input"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Opening balance" error={fe.openingBalance} htmlFor="openingBalance">
          <input
            id="openingBalance"
            name="openingBalance"
            type="text"
            inputMode="decimal"
            required
            placeholder="0.00"
            className="input amount"
          />
        </Field>

        <Field label="Opening date" error={fe.openingDate} htmlFor="openingDate">
          <input
            id="openingDate"
            name="openingDate"
            type="date"
            required
            defaultValue={isoToday()}
            className="input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Field label="Institution" htmlFor="institution">
          <input
            id="institution"
            name="institution"
            type="text"
            placeholder="e.g. Wells Fargo"
            className="input"
          />
        </Field>

        <Field label="Last 4" htmlFor="last4">
          <input
            id="last4"
            name="last4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            className="input w-20"
          />
        </Field>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-debit">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Creating…' : 'Create & backfill'}
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
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[10px] uppercase tracking-wider text-text-tertiary"
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-debit">{error}</p>}
    </div>
  );
}
