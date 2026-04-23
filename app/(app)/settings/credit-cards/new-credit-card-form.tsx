'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { CurrencyInput } from '@/ui/components/currency-input';
import { createCreditCardAction, type CreditCardActionState } from './actions';

const initial: CreditCardActionState = {};

export function NewCreditCardForm() {
  const [state, action, pending] = useActionState(createCreditCardAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1fr_6rem_7rem]">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Name
          </span>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Amex Cash Preferred"
            disabled={pending}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Institution
          </span>
          <input
            name="institution"
            type="text"
            placeholder="e.g. Amex"
            disabled={pending}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Last 4
          </span>
          <input
            name="last4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            disabled={pending}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Amount owed
          </span>
          <CurrencyInput
            name="amountOwed"
            placeholder="0.00"
            defaultValue="0"
            disabled={pending}
          />
        </label>
      </div>

      {state.error && <p className="text-xs text-debit">{state.error}</p>}
      {state.success && <p className="text-xs text-credit">{state.success}</p>}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          <Plus size={14} strokeWidth={2.5} />
          {pending ? 'Adding…' : 'Add card'}
        </button>
      </div>
    </form>
  );
}
