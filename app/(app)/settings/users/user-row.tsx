'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Trash2, Check, X } from 'lucide-react';
import {
  deleteUserAction,
  resetUserPasswordAction,
  updateUserRoleAction,
} from './actions';

interface Props {
  user: { id: string; username: string; role: 'admin' | 'user'; createdAt: string };
  isSelf: boolean;
}

export function UserRow({ user, isSelf }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRole = (role: 'admin' | 'user') => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await updateUserRoleAction(user.id, role);
      if (r.error) setError(r.error);
      else if (r.success) setSuccess(r.success);
    });
  };

  const handleDelete = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await deleteUserAction(user.id);
      if (r.error) setError(r.error);
    });
  };

  const handleResetSubmit = async (formData: FormData) => {
    setError(null);
    setSuccess(null);
    const r = await resetUserPasswordAction(user.id, formData);
    if (r.error) setError(r.error);
    else {
      setSuccess(r.success ?? 'Password reset');
      setResetting(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">@{user.username}</span>
          {isSelf && (
            <span className="rounded border border-border-strong px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-tertiary">
              you
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-text-tertiary">
          created {user.createdAt.slice(0, 10)}
        </div>
      </div>

      <select
        value={user.role}
        onChange={(e) => handleRole(e.target.value as 'admin' | 'user')}
        disabled={pending}
        className="input !py-1 w-24 text-xs"
        aria-label={`Role for ${user.username}`}
      >
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>

      {resetting ? (
        <form action={handleResetSubmit} className="flex items-center gap-2">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoFocus
            placeholder="new password"
            className="input !py-1 w-40 text-xs"
          />
          <button type="submit" className="btn-ghost" title="Save">
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setResetting(false)}
            className="btn-ghost"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </form>
      ) : confirmingDelete ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-debit">delete user?</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="btn-ghost text-debit"
            title="Confirm delete"
          >
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="btn-ghost"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setResetting(true)}
            disabled={pending}
            className="btn-ghost"
            title="Reset password"
            aria-label="Reset password"
          >
            <KeyRound size={12} strokeWidth={2} />
          </button>
          {!isSelf && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              className="btn-ghost text-debit"
              title="Delete user"
              aria-label="Delete"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {(error || success) && (
        <div className="w-full pl-0">
          {error && <p className="text-xs text-debit">{error}</p>}
          {success && <p className="text-xs text-credit">{success}</p>}
        </div>
      )}
    </li>
  );
}
