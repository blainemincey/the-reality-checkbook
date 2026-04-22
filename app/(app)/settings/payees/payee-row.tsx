'use client';

import { useState, useTransition } from 'react';
import { Archive, ArchiveRestore, Pencil, Trash2, Check, X } from 'lucide-react';
import type { PayeeRow as PayeeRowType } from '@/db/schema';
import {
  archivePayeeAction,
  deletePayeeAction,
  renamePayeeAction,
  restorePayeeAction,
} from './actions';

interface Props {
  payee: PayeeRowType;
  archived: boolean;
}

export function PayeeRow({ payee, archived }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(payee.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saveRename = async (formData: FormData) => {
    setError(null);
    const result = await renamePayeeAction(payee.id, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  };

  const handleArchive = () => {
    startTransition(async () => {
      await (archived ? restorePayeeAction(payee.id) : archivePayeeAction(payee.id));
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deletePayeeAction(payee.id);
    });
  };

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      {editing ? (
        <form
          action={saveRename}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <input
            name="name"
            type="text"
            defaultValue={payee.name}
            required
            autoFocus
            onChange={(e) => setName(e.target.value)}
            className="input !py-1 flex-1"
          />
          <button type="submit" disabled={pending} className="btn-ghost" title="Save">
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(payee.name);
              setError(null);
            }}
            className="btn-ghost"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </form>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      )}

      {!editing && (
        <div className="flex items-center gap-1">
          {confirmingDelete ? (
            <>
              <span className="mr-1 text-xs text-debit">delete?</span>
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
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-ghost"
                title="Rename"
                aria-label="Rename"
              >
                <Pencil size={12} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={pending}
                className="btn-ghost"
                title={archived ? 'Restore' : 'Archive'}
                aria-label={archived ? 'Restore' : 'Archive'}
              >
                {archived ? (
                  <ArchiveRestore size={12} strokeWidth={2} />
                ) : (
                  <Archive size={12} strokeWidth={2} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={pending}
                className="btn-ghost text-debit"
                title="Delete"
                aria-label="Delete"
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      )}

      {error && <span className="ml-2 text-xs text-debit">{error}</span>}
    </li>
  );
}
