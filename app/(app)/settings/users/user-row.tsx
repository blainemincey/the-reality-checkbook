'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  deleteUserAction,
  resetUserPasswordAction,
  updateUserIdentityAction,
  updateUserRoleAction,
} from './actions';

interface UserShape {
  id: string;
  username: string;
  name: string | null;
  role: 'admin' | 'user';
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Props {
  user: UserShape;
  isSelf: boolean;
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function UserRow({ user, isSelf }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
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

  const handleIdentitySubmit = async (formData: FormData) => {
    setError(null);
    setSuccess(null);
    const username = String(formData.get('username') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const r = await updateUserIdentityAction(user.id, { username, name });
    if (r.error) setError(r.error);
    else {
      setSuccess(r.success ?? 'Saved');
      setEditingIdentity(false);
    }
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

  if (editingIdentity) {
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3">
        <form action={handleIdentitySubmit} className="flex min-w-0 flex-1 items-center gap-2">
          <input
            name="username"
            type="text"
            required
            defaultValue={user.username}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder="username"
            className="input !py-1 text-xs w-40"
          />
          <input
            name="name"
            type="text"
            defaultValue={user.name ?? ''}
            placeholder="display name"
            className="input !py-1 text-xs flex-1"
          />
          <button type="submit" disabled={pending} className="btn-ghost" title="Save">
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingIdentity(false);
              setError(null);
            }}
            className="btn-ghost"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </form>
        {error && <span className="w-full text-xs text-debit">{error}</span>}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {user.name ? (
            <>
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-text-tertiary">@{user.username}</span>
            </>
          ) : (
            <span className="truncate text-sm">@{user.username}</span>
          )}
          {isSelf && (
            <span className="rounded border border-border-strong px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text-tertiary">
              you
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-tertiary">
          <span>
            last login: <span className="text-text-secondary">{formatLastLogin(user.lastLoginAt)}</span>
          </span>
          <span>
            {user.loginCount} login{user.loginCount === 1 ? '' : 's'}
          </span>
          <span>created {user.createdAt.slice(0, 10)}</span>
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
            onClick={() => setEditingIdentity(true)}
            disabled={pending}
            className="btn-ghost"
            title="Edit username / name"
            aria-label="Edit identity"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
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
        <div className="w-full">
          {error && <p className="text-xs text-debit">{error}</p>}
          {success && <p className="text-xs text-credit">{success}</p>}
        </div>
      )}
    </li>
  );
}
