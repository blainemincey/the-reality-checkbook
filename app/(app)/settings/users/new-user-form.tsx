'use client';

import { useActionState, useEffect, useRef } from 'react';
import { UserPlus } from 'lucide-react';
import { createUserAction, type UserActionState } from './actions';

const initial: UserActionState = {};

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_8rem]">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="someone@example.com"
            disabled={pending}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Temporary password
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="min 8 characters"
            disabled={pending}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Role
          </span>
          <select name="role" defaultValue="user" disabled={pending} className="input">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>

      {state.error && <p className="text-xs text-debit">{state.error}</p>}
      {state.success && <p className="text-xs text-credit">{state.success}</p>}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          <UserPlus size={14} strokeWidth={2} />
          {pending ? 'Adding…' : 'Add user'}
        </button>
      </div>
    </form>
  );
}
