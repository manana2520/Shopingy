'use client';

import { useEffect, useState, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { fetchHealthScores } from '@/lib/api';
import type { HealthScore } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
} from 'recharts';

function getHealthColor(item: HealthScore): string {
  if (item.net_change > 0) return '#22C55E';
  if (item.net_change < 0) return '#EF4444';
  return '#F59E0B';
}

interface ScatterPoint {
  openings: number;
  closings: number;
  total_stores: number;
  mall_name: string;
  city: string;
  net_change: number;
  churn_rate: number;
  fill: string;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthScores()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const scatterData = useMemo<ScatterPoint[]>(() => {
    return data.map((item) => ({
      openings: item.openings,
      closings: item.closings,
      total_stores: item.total_stores,
      mall_name: item.mall_name,
      city: item.city,
      net_change: item.net_change,
      churn_rate: item.churn_rate,
      fill: getHealthColor(item),
    }));
  }, [data]);

  const growing = useMemo(() => data.filter((d) => d.net_change > 0), [data]);
  const declining = useMemo(() => data.filter((d) => d.net_change < 0), [data]);
  const avgChurn = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.churn_rate, 0) / data.length;
  }, [data]);

  const worstMalls = useMemo(() => {
    return [...data].sort((a, b) => b.churn_rate - a.churn_rate).slice(0, 10);
  }, [data]);

  const bestMalls = useMemo(() => {
    return [...data].sort((a, b) => b.net_change - a.net_change).slice(0, 10);
  }, [data]);

  const maxAxis = useMemo(() => {
    const maxOpen = Math.max(...data.map((d) => d.openings), 0);
    const maxClose = Math.max(...data.map((d) => d.closings), 0);
    return Math.max(maxOpen, maxClose, 1) + 2;
  }, [data]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ScatterPoint }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    return (
      <div
        className="p-3 rounded-lg text-xs"
        style={{
          background: 'white',
          border: '1px solid #E5EAF0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <p className="font-semibold mb-1" style={{ color: COLORS.dark }}>
          {d.mall_name}
        </p>
        <p style={{ color: '#64748B' }}>{d.city}</p>
        <div className="mt-2 space-y-1">
          <p>
            <span style={{ color: '#22C55E' }}>Openings:</span> {d.openings}
          </p>
          <p>
            <span style={{ color: '#EF4444' }}>Closings:</span> {d.closings}
          </p>
          <p>
            <span style={{ color: d.net_change >= 0 ? '#22C55E' : '#EF4444' }}>
              Net Change:
            </span>{' '}
            {d.net_change >= 0 ? '+' : ''}
            {d.net_change}
          </p>
          <p>
            <span style={{ color: '#64748B' }}>Churn Rate:</span>{' '}
            {(d.churn_rate * 100).toFixed(1)}%
          </p>
          <p>
            <span style={{ color: '#64748B' }}>Total Stores:</span> {d.total_stores}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Mall Health Score
      </h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Store openings vs closings trajectory
      </p>

      {error && (
        <div
          className="mb-6 p-4 rounded-lg text-sm"
          style={{
            background: '#FEF2F2',
            color: COLORS.danger,
            border: '1px solid #FECACA',
          }}
        >
          Failed to load data: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KPICard
          label="Total Growing"
          value={growing.length}
          icon={<TrendingUp size={24} />}
        />
        <KPICard
          label="Total Declining"
          value={declining.length}
          icon={<TrendingDown size={24} />}
        />
        <KPICard
          label="Average Churn Rate"
          value={Math.round(avgChurn * 100)}
          icon={<Activity size={24} />}
          suffix="%"
        />
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 400, color: '#94A3B8' }}
        >
          <div className="text-center">
            <div
              className="inline-block w-8 h-8 border-3 rounded-full animate-spin mb-3"
              style={{
                borderColor: '#E5EAF0',
                borderTopColor: COLORS.primary,
              }}
            />
            <p>Loading health scores...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="section-card text-center py-12" style={{ color: '#94A3B8' }}>
          No health score data available.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
              Mall Growth vs Decline
            </h3>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis
                  type="number"
                  dataKey="openings"
                  name="Openings"
                  domain={[0, maxAxis]}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  label={{
                    value: 'Store Openings',
                    position: 'insideBottom',
                    offset: -10,
                    style: { fontSize: 12, fill: '#64748B' },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="closings"
                  name="Closings"
                  domain={[0, maxAxis]}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  label={{
                    value: 'Store Closings',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: { fontSize: 12, fill: '#64748B' },
                  }}
                />
                <ZAxis
                  type="number"
                  dataKey="total_stores"
                  range={[40, 400]}
                  name="Total Stores"
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: maxAxis, y: maxAxis },
                  ]}
                  stroke="#94A3B8"
                  strokeDasharray="5 5"
                  label={{
                    value: 'Breakeven',
                    position: 'end',
                    style: { fontSize: 11, fill: '#94A3B8' },
                  }}
                />
                <Scatter
                  data={scatterData.filter((d) => d.net_change > 0)}
                  fill="#22C55E"
                  name="Growing"
                />
                <Scatter
                  data={scatterData.filter((d) => d.net_change < 0)}
                  fill="#EF4444"
                  name="Declining"
                />
                <Scatter
                  data={scatterData.filter((d) => d.net_change === 0)}
                  fill="#F59E0B"
                  name="Stable"
                />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 justify-center mt-2 text-xs" style={{ color: '#64748B' }}>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#22C55E' }} />
                Growing (above line)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#EF4444' }} />
                Declining (below line)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: '#F59E0B' }} />
                Stable (on line)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="section-card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
                <span className="flex items-center gap-2">
                  <BarChart3 size={16} style={{ color: '#EF4444' }} />
                  Worst Performing Malls (Highest Churn)
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: '#64748B', borderBottom: '1px solid #E5EAF0' }}>
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      <th className="text-left px-3 py-2 font-medium">Mall</th>
                      <th className="text-left px-3 py-2 font-medium">City</th>
                      <th className="text-right px-3 py-2 font-medium">Churn</th>
                      <th className="text-right px-3 py-2 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worstMalls.map((mall, idx) => (
                      <tr key={mall.mall_name} style={{ borderBottom: '1px solid #E5EAF0' }}>
                        <td className="px-3 py-2" style={{ color: '#94A3B8' }}>
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-medium" style={{ color: COLORS.dark }}>
                          {mall.mall_name}
                        </td>
                        <td className="px-3 py-2" style={{ color: '#64748B' }}>
                          {mall.city}
                        </td>
                        <td className="text-right px-3 py-2" style={{ color: '#EF4444' }}>
                          {(mall.churn_rate * 100).toFixed(1)}%
                        </td>
                        <td
                          className="text-right px-3 py-2 font-semibold"
                          style={{ color: mall.net_change >= 0 ? COLORS.success : COLORS.danger }}
                        >
                          {mall.net_change >= 0 ? '+' : ''}
                          {mall.net_change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section-card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
                <span className="flex items-center gap-2">
                  <BarChart3 size={16} style={{ color: '#22C55E' }} />
                  Best Performing Malls (Highest Net Growth)
                </span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: '#64748B', borderBottom: '1px solid #E5EAF0' }}>
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      <th className="text-left px-3 py-2 font-medium">Mall</th>
                      <th className="text-left px-3 py-2 font-medium">City</th>
                      <th className="text-right px-3 py-2 font-medium">Net</th>
                      <th className="text-right px-3 py-2 font-medium">Openings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestMalls.map((mall, idx) => (
                      <tr key={mall.mall_name} style={{ borderBottom: '1px solid #E5EAF0' }}>
                        <td className="px-3 py-2" style={{ color: '#94A3B8' }}>
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-medium" style={{ color: COLORS.dark }}>
                          {mall.mall_name}
                        </td>
                        <td className="px-3 py-2" style={{ color: '#64748B' }}>
                          {mall.city}
                        </td>
                        <td
                          className="text-right px-3 py-2 font-semibold"
                          style={{ color: mall.net_change >= 0 ? COLORS.success : COLORS.danger }}
                        >
                          {mall.net_change >= 0 ? '+' : ''}
                          {mall.net_change}
                        </td>
                        <td className="text-right px-3 py-2" style={{ color: '#22C55E' }}>
                          {mall.openings}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
