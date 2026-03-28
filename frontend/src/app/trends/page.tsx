'use client';

import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { fetchTrendData } from '@/lib/api';
import type { TrendData } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

interface MergedTrendPoint {
  month: string;
  opened: number;
  closed: number;
  net: number;
}

function mergeTrendData(data: TrendData): MergedTrendPoint[] {
  const map = new Map<string, MergedTrendPoint>();

  for (const item of data.openings) {
    map.set(item.month, {
      month: item.month,
      opened: item.count,
      closed: 0,
      net: item.count,
    });
  }

  for (const item of data.closings) {
    const existing = map.get(item.month);
    if (existing) {
      existing.closed = item.count;
      existing.net = existing.opened - item.count;
    } else {
      map.set(item.month, {
        month: item.month,
        opened: 0,
        closed: item.count,
        net: -item.count,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(m, 10) - 1;
  return `${monthNames[monthIndex]} ${year.slice(2)}`;
}

export default function TrendsPage() {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrendData()
      .then(setTrendData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const mergedData = useMemo(() => {
    if (!trendData) return [];
    return mergeTrendData(trendData);
  }, [trendData]);

  const totalOpened = useMemo(
    () => mergedData.reduce((sum, d) => sum + d.opened, 0),
    [mergedData]
  );
  const totalClosed = useMemo(
    () => mergedData.reduce((sum, d) => sum + d.closed, 0),
    [mergedData]
  );
  const netChange = totalOpened - totalClosed;

  // Yearly aggregation for category breakdown
  const yearlyData = useMemo(() => {
    const map = new Map<string, { year: string; opened: number; closed: number; net: number }>();
    for (const d of mergedData) {
      const year = d.month.slice(0, 4);
      const existing = map.get(year);
      if (existing) {
        existing.opened += d.opened;
        existing.closed += d.closed;
        existing.net += d.net;
      } else {
        map.set(year, { year, opened: d.opened, closed: d.closed, net: d.net });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year));
  }, [mergedData]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div
        className="p-3 rounded-lg text-xs"
        style={{
          background: 'white',
          border: '1px solid #E5EAF0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <p className="font-semibold mb-2" style={{ color: COLORS.dark }}>
          {label}
        </p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span className="font-semibold">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Trends
      </h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Store opening and closing trends over time
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

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KPICard
          label="Total Openings"
          value={totalOpened}
          icon={<TrendingUp size={24} />}
        />
        <KPICard
          label="Total Closings"
          value={totalClosed}
          icon={<TrendingDown size={24} />}
        />
        <KPICard
          label="Net Change"
          value={Math.abs(netChange)}
          icon={<Activity size={24} />}
          suffix={netChange >= 0 ? '+' : '-'}
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
            <p>Loading trends data...</p>
          </div>
        </div>
      ) : mergedData.length === 0 ? (
        <div className="section-card text-center py-12" style={{ color: '#94A3B8' }}>
          No trend data available.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Main chart: openings vs closings with net change overlay */}
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
              Monthly Store Openings vs Closings
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={mergedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  interval={Math.max(0, Math.floor(mergedData.length / 12) - 1)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                />
                <Bar
                  dataKey="opened"
                  name="Openings"
                  fill={COLORS.success}
                  radius={[2, 2, 0, 0]}
                  barSize={8}
                />
                <Bar
                  dataKey="closed"
                  name="Closings"
                  fill={COLORS.danger}
                  radius={[2, 2, 0, 0]}
                  barSize={8}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net Change"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Yearly summary table */}
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
              Yearly Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: '#64748B', borderBottom: '1px solid #E5EAF0' }}>
                    <th className="text-left px-4 py-2 font-medium">Year</th>
                    <th className="text-right px-4 py-2 font-medium">Openings</th>
                    <th className="text-right px-4 py-2 font-medium">Closings</th>
                    <th className="text-right px-4 py-2 font-medium">Net Change</th>
                    <th className="px-4 py-2 font-medium" style={{ width: 200 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyData.map((row) => {
                    const total = row.opened + row.closed;
                    const openPct = total > 0 ? (row.opened / total) * 100 : 50;

                    return (
                      <tr
                        key={row.year}
                        style={{ borderBottom: '1px solid #E5EAF0' }}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: COLORS.dark }}>
                          {row.year}
                        </td>
                        <td className="text-right px-4 py-3" style={{ color: COLORS.success }}>
                          +{row.opened.toLocaleString()}
                        </td>
                        <td className="text-right px-4 py-3" style={{ color: COLORS.danger }}>
                          -{row.closed.toLocaleString()}
                        </td>
                        <td
                          className="text-right px-4 py-3 font-semibold"
                          style={{ color: row.net >= 0 ? COLORS.success : COLORS.danger }}
                        >
                          {row.net >= 0 ? '+' : ''}{row.net.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-2 rounded-full overflow-hidden"
                              style={{ width: '100%', background: '#E5EAF0' }}
                            >
                              <div
                                className="h-full"
                                style={{ width: `${openPct}%`, background: COLORS.success }}
                              />
                              <div
                                className="h-full"
                                style={{ width: `${100 - openPct}%`, background: COLORS.danger }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
