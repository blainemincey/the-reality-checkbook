import type { ReactNode } from 'react';

type StatTone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'debit' | 'credit' | 'neutral';

interface Props {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: StatTone;
  className?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  1: 'text-stat-1',
  2: 'text-stat-2',
  3: 'text-stat-3',
  4: 'text-stat-4',
  5: 'text-stat-5',
  6: 'text-stat-6',
  7: 'text-stat-7',
  8: 'text-stat-8',
  debit: 'text-debit',
  credit: 'text-credit',
  neutral: 'text-text',
};

const ACCENT_BAR: Record<StatTone, string> = {
  1: 'bg-stat-1',
  2: 'bg-stat-2',
  3: 'bg-stat-3',
  4: 'bg-stat-4',
  5: 'bg-stat-5',
  6: 'bg-stat-6',
  7: 'bg-stat-7',
  8: 'bg-stat-8',
  debit: 'bg-debit',
  credit: 'bg-credit',
  neutral: 'bg-text-tertiary',
};

export function StatCard({ label, value, subtitle, tone = 'neutral', className = '' }: Props) {
  return (
    <div
      className={
        'card relative overflow-hidden px-4 py-4 ' +
        'transition-colors duration-120 ease-swift hover:border-border-strong ' +
        className
      }
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT_BAR[tone]}`}
      />
      <div className="pl-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
          {label}
        </div>
        <div className={`stat-value mt-2 text-3xl leading-none ${TONE_CLASS[tone]}`}>
          {value}
        </div>
        {subtitle && (
          <div className="mt-2 text-[11px] text-text-tertiary">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
