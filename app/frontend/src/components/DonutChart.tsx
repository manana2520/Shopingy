'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { COLORS } from '@/lib/theme';

interface DonutChartProps {
  data: { name: string; value: number }[];
  title?: string;
}

export default function DonutChart({ data, title = 'Mall Type Distribution' }: DonutChartProps) {
  return (
    <div className="section-card">
      <h3 className="text-sm font-semibold mb-4" style={{ color: '#1A1A2E' }}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) =>
              `${name} (${(percent * 100).toFixed(0)}%)`
            }
            labelLine={{ stroke: '#94A3B8' }}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS.chart[index % COLORS.chart.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #E5EAF0',
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
