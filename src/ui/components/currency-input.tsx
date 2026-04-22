'use client';

import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  tone?: 'credit' | 'debit' | 'none';
}

/**
 * Text input rendered with a '$' prefix. The user still types/pastes a plain
 * decimal ('45.67'); we don't mutate their keystrokes. The visual affordance
 * is just a non-editable glyph on the left.
 */
export function CurrencyInput({
  className = '',
  tone = 'none',
  disabled,
  ...rest
}: Props) {
  const borderClass =
    tone === 'credit' ? 'focus-within:border-credit' :
    tone === 'debit' ? 'focus-within:border-debit' :
    '';
  return (
    <div className="relative">
      <span
        className={
          'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ' +
          (disabled ? 'text-text-tertiary opacity-50' : 'text-text-tertiary')
        }
      >
        $
      </span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className={`input amount pl-7 ${borderClass} ${className}`}
      />
    </div>
  );
}
