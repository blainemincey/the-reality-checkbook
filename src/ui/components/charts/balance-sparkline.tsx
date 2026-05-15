'use client';

import { AreaChart, Area, YAxis } from 'recharts';
import type { BalancePoint } from '@/domain/charts';

interface Props {
  data: readonly BalancePoint[];
  width?: number;
  height?: number;
  /** Whether the trend ends higher/lower than it started — drives stroke color. */
  trend?: 'up' | 'down' | 'flat';
}

export function BalanceSparkline({ data, width = 96, height = 28, trend = 'flat' }: Props) {
  if (data.length < 2) {
    return <span style={{ width, height, display: 'inline-block' }} aria-hidden />;
  }

  const stroke =
    trend === 'up'
      ? 'rgb(var(--color-credit))'
      : trend === 'down'
        ? 'rgb(var(--color-debit))'
        : 'rgb(var(--color-text-tertiary))';

  return (
    <span
      style={{ width, height, display: 'inline-block' }}
      aria-hidden
      className="shrink-0"
    >
      <AreaChart width={width} height={height} data={[...data]} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={stroke}
          strokeWidth={1.5}
          fill={stroke}
          fillOpacity={0.12}
          isAnimationActive={false}
        />
      </AreaChart>
    </span>
  );
}
