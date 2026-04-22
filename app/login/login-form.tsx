'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs text-text-secondary">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="block w-full rounded border border-border bg-surface px-3 py-2 text-sm shadow-surface outline-none transition-colors duration-120 ease-swift focus:border-accent"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs text-text-secondary">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="block w-full rounded border border-border bg-surface px-3 py-2 text-sm shadow-surface outline-none transition-colors duration-120 ease-swift focus:border-accent"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-debit">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white transition-opacity duration-120 ease-swift hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
