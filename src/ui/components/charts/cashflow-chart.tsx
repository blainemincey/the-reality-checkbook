'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Cash, formatCash } from '@/money';

export interface CashflowPoint {
  month: string;        // 'YYYY-MM'
  deposits: number;     // positive number for chart
  payments: number;     // positive magnitude
  net: number;          // deposits - payments (can be negative)
}

interface Props {
  data: readonly CashflowPoint[];
  height?: number;
}

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
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
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}

function TooltipBody({ active, payload, label }: TooltipBodyProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border-strong bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="text-text-tertiary">{formatMonth(String(label))}</div>
      {payload.map((p) => {
        const v = typeof p.value === 'number' ? p.value : Number(p.value);
        if (!Number.isFinite(v)) return null;
        return (
          <div key={p.name} className="mt-0.5 flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: p.color }}
              />
              <span className="capitalize text-text-secondary">{p.name}</span>
            </span>
            <span className="amount font-medium text-text">
              {formatCash(Cash.of(v.toFixed(2)))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CashflowChart({ data, height = 260 }: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-tertiary"
        style={{ height }}
      >
        No transactions in this period.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
          <CartesianGrid
            stroke="rgb(var(--color-border))"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fill: 'rgb(var(--color-text-tertiary))', fontSize: 11 }}
            axisLine={{ stroke: 'rgb(var(--color-border))' }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={formatAxisCurrency}
            tick={{ fill: 'rgb(var(--color-text-tertiary))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine y={0} stroke="rgb(var(--color-border-strong))" />
          <Tooltip
            content={<TooltipBody />}
            cursor={{ fill: 'rgb(var(--color-border) / 0.5)' }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, color: 'rgb(var(--color-text-secondary))' }}
          />
          <Bar
            dataKey="deposits"
            name="Deposits"
            fill="rgb(var(--color-credit))"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="payments"
            name="Payments"
            fill="rgb(var(--color-debit))"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="net"
            name="Net"
            fill="rgb(var(--stat-3))"
            fillOpacity={0.6}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
