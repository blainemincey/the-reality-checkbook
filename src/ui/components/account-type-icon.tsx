import {
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  LineChart,
  Landmark,
} from 'lucide-react';
import type { AccountRow } from '@/db/schema';

type AccountType = AccountRow['accountType'];

const ICONS: Record<AccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  brokerage: LineChart,
  retirement: Landmark,
};

const LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  cash: 'Cash',
  brokerage: 'Brokerage',
  retirement: 'Retirement',
};

interface Props {
  type: AccountType;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

export function AccountTypeIcon({
  type,
  size = 14,
  className = '',
  showLabel = false,
}: Props) {
  const Icon = ICONS[type];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon
        size={size}
        strokeWidth={1.5}
        aria-hidden={!showLabel}
        aria-label={showLabel ? undefined : LABELS[type]}
      />
      {showLabel && <span>{LABELS[type]}</span>}
    </span>
  );
}

export function accountTypeLabel(type: AccountType): string {
  return LABELS[type];
}
