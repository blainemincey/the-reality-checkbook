import type { Cash } from '@/money';
import { formatCash, formatSigned } from '@/money';

interface AmountProps {
  value: Cash;
  signed?: boolean;
  className?: string;
}

export function Amount({ value, signed = false, className = '' }: AmountProps) {
  const text = signed ? formatSigned(value) : formatCash(value);
  const colorClass = value.isNegative()
    ? 'text-debit'
    : value.isPositive()
      ? 'text-credit'
      : 'text-text-secondary';
  return <span className={`amount ${colorClass} ${className}`}>{text}</span>;
}
