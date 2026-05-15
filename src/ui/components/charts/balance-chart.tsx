'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { BalancePoint } from '@/domain/charts';
import { Cash } from '@/money';
import { formatCash } from '@/money';

interface Props {
  data: readonly BalancePoint[];
  height?: number;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatAxisCurrency(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

interface TooltipBodyProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string | number;
}

function TooltipBody({ active, payload, label }: TooltipBodyProps) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const v = typeof raw === 'number' ? raw : raw ? Number(raw) : NaN;
  if (!Number.isFinite(v)) return null;
  return (
    <div className="rounded-md border border-border-strong bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="text-text-tertiary">{formatDate(String(label))}</div>
      <div className="amount mt-0.5 font-medium text-text">
        {formatCash(Cash.of(v.toFixed(2)))}
      </div>
    </div>
  );
}

export function BalanceChart({ data, height = 200 }: Props) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-tertiary"
        style={{ height }}
      >
        Add a few transactions to see the balance trend.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={[...data]} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
          <defs>
            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgb(var(--color-border))"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: 'rgb(var(--color-text-tertiary))', fontSize: 11 }}
            axisLine={{ stroke: 'rgb(var(--color-border))' }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={formatAxisCurrency}
            tick={{ fill: 'rgb(var(--color-text-tertiary))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            content={<TooltipBody />}
            cursor={{ stroke: 'rgb(var(--color-border-strong))' }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="rgb(16,185,129)"
            strokeWidth={2}
            fill="url(#balGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
