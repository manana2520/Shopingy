'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { COLORS } from '@/lib/theme';

interface CategoryChartProps {
  data: { category: string; count: number }[];
}

export default function CategoryChart({ data }: CategoryChartProps) {
  return (
    <div className="section-card">
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#1A1A2E' }}>
        Top 10 Store Categories
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} />
          <YAxis
            type="category"
            dataKey="category"
            width={120}
            tick={{ fontSize: 11, fill: '#64748B' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #E5EAF0',
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
