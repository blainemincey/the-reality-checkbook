'use client';

import { useEffect, useState } from 'react';

export type Period = '3m' | '6m' | '12m' | 'all';

const LABELS: Record<Period, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All time',
};

const STORAGE_KEY = 'cr.reports.period';

interface Props {
  value: Period;
  onChange: (next: Period) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Period)}
      className="input !py-1 !px-2 text-xs"
    >
      {(['3m', '6m', '12m', 'all'] as const).map((p) => (
        <option key={p} value={p}>
          {LABELS[p]}
        </option>
      ))}
    </select>
  );
}

export function usePersistedPeriod(initial: Period = '12m'): [
  Period,
  (p: Period) => void,
] {
  const [period, setPeriod] = useState<Period>(initial);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (['3m', '6m', '12m', 'all'] as const).includes(stored as Period)) {
      setPeriod(stored as Period);
    }
  }, []);

  const update = (p: Period) => {
    setPeriod(p);
    window.localStorage.setItem(STORAGE_KEY, p);
  };

  return [period, update];
}
