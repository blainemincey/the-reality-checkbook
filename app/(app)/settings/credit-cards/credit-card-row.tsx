'use client';

import { useState, useTransition } from 'react';
import { Archive, ArchiveRestore, Check, Pencil, Trash2, X } from 'lucide-react';
import { Cash, formatCash } from '@/money';
import { CurrencyInput } from '@/ui/components/currency-input';
import { InstitutionBadge } from '@/ui/components/institution-badge';
import {
  archiveCreditCardAction,
  deleteCreditCardAction,
  restoreCreditCardAction,
  updateCreditCardAmountAction,
  updateCreditCardIdentityAction,
} from './actions';

interface CardShape {
  id: string;
  name: string;
  institution: string | null;
  last4: string | null;
  amountOwed: string;
  lastUpdatedAt: string;
  logoFilename: string | undefined;
}

interface Props {
  card: CardShape;
  archived: boolean;
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CreditCardRow({ card, archived }: Props) {
  const [pending, startTransition] = useTransition();
  const [editingAmount, setEditingAmount] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAmount = Cash.of(card.amountOwed);

  const handleAmountSubmit = async (formData: FormData) => {
    setError(null);
    const raw = String(formData.get('amount') ?? '');
    const r = await updateCreditCardAmountAction(card.id, raw);
    if (r.error) setError(r.error);
    else setEditingAmount(false);
  };

  const handleIdentitySubmit = async (formData: FormData) => {
    setError(null);
    const r = await updateCreditCardIdentityAction(card.id, {
      name: String(formData.get('name') ?? ''),
      institution: String(formData.get('institution') ?? ''),
      last4: String(formData.get('last4') ?? ''),
    });
    if (r.error) setError(r.error);
    else setEditingIdentity(false);
  };

  const handleArchive = () => {
    startTransition(async () => {
      await (archived ? restoreCreditCardAction(card.id) : archiveCreditCardAction(card.id));
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteCreditCardAction(card.id);
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <InstitutionBadge
        institution={card.institution}
        fallback={card.name}
        size="md"
        logoFilename={card.logoFilename}
      />

      {editingIdentity ? (
        <form
          action={handleIdentitySubmit}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
        >
          <input
            name="name"
            type="text"
            required
            defaultValue={card.name}
            autoFocus
            placeholder="name"
            className="input !py-1 text-xs w-48"
          />
          <input
            name="institution"
            type="text"
            defaultValue={card.institution ?? ''}
            placeholder="institution"
            className="input !py-1 text-xs w-40"
          />
          <input
            name="last4"
            type="text"
            inputMode="numeric"
            maxLength={4}
            defaultValue={card.last4 ?? ''}
            placeholder="last 4"
            className="input !py-1 text-xs w-20"
          />
          <button type="submit" disabled={pending} className="btn-ghost" title="Save">
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setEditingIdentity(false)}
            className="btn-ghost"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </form>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{card.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-tertiary">
            {card.institution && <span>{card.institution}</span>}
            {card.last4 && <span>····{card.last4}</span>}
            <span>updated {formatUpdated(card.lastUpdatedAt)}</span>
          </div>
        </div>
      )}

      {editingAmount ? (
        <form action={handleAmountSubmit} className="flex items-center gap-2">
          <CurrencyInput
            name="amount"
            defaultValue={currentAmount.toFixed(2)}
            autoFocus
            className="!py-1 w-32 text-xs"
          />
          <button type="submit" disabled={pending} className="btn-ghost" title="Save">
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setEditingAmount(false)}
            className="btn-ghost"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditingAmount(true)}
          title="Update amount"
          className="amount-display text-lg text-stat-8 transition-opacity duration-120 ease-swift hover:opacity-80"
        >
          {formatCash(currentAmount)}
        </button>
      )}

      {!editingAmount && !editingIdentity && (
        <div className="flex items-center gap-1">
          {confirmingDelete ? (
            <>
              <span className="text-xs text-debit">delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="btn-ghost text-debit"
                title="Confirm"
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
                onClick={() => setEditingIdentity(true)}
                className="btn-ghost"
                title="Edit name / institution"
                aria-label="Edit"
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

      {error && <span className="w-full text-xs text-debit">{error}</span>}
    </li>
  );
}
