'use client';

import { useActionState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { createPayeeAction, type PayeeActionState } from './actions';

const initial: PayeeActionState = {};

export function NewPayeeForm() {
  const [state, action, pending] = useActionState(createPayeeAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // After a successful add, clear the input and keep focus for rapid entry.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      inputRef.current?.focus();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-1.5">
      <label htmlFor="new-payee" className="block text-xs text-text-secondary">
        Add a payee
      </label>
      <div className="flex items-center gap-2">
        <input
          id="new-payee"
          ref={inputRef}
          name="name"
          type="text"
          required
          autoComplete="off"
          placeholder="e.g. Target"
          disabled={pending}
          className="input max-w-sm"
        />
        <button type="submit" disabled={pending} className="btn-primary">
          <Plus size={14} strokeWidth={2} />
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {state.error && <p className="text-xs text-debit">{state.error}</p>}
      {state.success && <p className="text-xs text-credit">{state.success}</p>}
    </form>
  );
}
