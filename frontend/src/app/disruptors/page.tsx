'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Zap, TrendingUp, TrendingDown, Award } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { fetchDisruptors, fetchEnums } from '@/lib/api';
import type { DisruptorBrand, EnumValues } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type DateFilter = 'last12' | '2024' | '2025' | 'all';

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'last12', label: 'Last 12 months' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: 'all', label: 'All time' },
];

function getSinceParam(filter: DateFilter): string | undefined {
  const now = new Date();
  switch (filter) {
    case 'last12': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split('T')[0];
    }
    case '2024':
      return '2024-01-01';
    case '2025':
      return '2025-01-01';
    case 'all':
      return undefined;
  }
}

const MAX_BRANDS = 20;

export default function DisruptorsPage() {
  const [data, setData] = useState<DisruptorBrand[]>([]);
  const [enums, setEnums] = useState<EnumValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('last12');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    const since = getSinceParam(dateFilter);
    fetchDisruptors(since, categoryFilter || undefined)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dateFilter, categoryFilter]);

  useEffect(() => {
    fetchEnums().then(setEnums).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const winners = useMemo(() => {
    return [...data]
      .filter((d) => d.net_change > 0)
      .sort((a, b) => b.net_change - a.net_change)
      .slice(0, MAX_BRANDS);
  }, [data]);

  const losers = useMemo(() => {
    return [...data]
      .filter((d) => d.net_change < 0)
      .sort((a, b) => a.net_change - b.net_change)
      .slice(0, MAX_BRANDS);
  }, [data]);

  const expandingCount = useMemo(() => data.filter((d) => d.net_change > 0).length, [data]);
  const contractingCount = useMemo(() => data.filter((d) => d.net_change < 0).length, [data]);
  const biggestMover = useMemo(() => {
    if (data.length === 0) return '-';
    const sorted = [...data].sort(
      (a, b) => Math.abs(b.net_change) - Math.abs(a.net_change)
    );
    return sorted[0]?.brand_name || '-';
  }, [data]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: DisruptorBrand & { type: string } }>;
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
          {d.brand_name}
        </p>
        <p
          className="text-xs mb-2 px-1.5 py-0.5 rounded inline-block"
          style={{ background: '#F1F5F9', color: '#64748B' }}
        >
          {d.category}
        </p>
        <div className="mt-1 space-y-1">
          <p>
            <span style={{ color: '#22C55E' }}>Openings:</span> {d.openings}
          </p>
          <p>
            <span style={{ color: '#EF4444' }}>Closings:</span> {d.closings}
          </p>
          <p>
            <span
              style={{ color: d.net_change >= 0 ? '#22C55E' : '#EF4444' }}
            >
              Net Change:
            </span>{' '}
            {d.net_change >= 0 ? '+' : ''}
            {d.net_change}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Market Disruptors
      </h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Brand expansion vs contraction
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
          label="Expanding Brands"
          value={expandingCount}
          icon={<TrendingUp size={24} />}
        />
        <KPICard
          label="Contracting Brands"
          value={contractingCount}
          icon={<TrendingDown size={24} />}
        />
        <KPICard
          label="Biggest Mover"
          value={0}
          icon={<Award size={24} />}
          suffix={biggestMover}
        />
      </div>

      {/* Filters */}
      <div className="section-card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#64748B' }}>
              Time Period
            </label>
            <div className="flex gap-1">
              {DATE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateFilter(opt.value)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: dateFilter === opt.value ? COLORS.primary : '#F1F5F9',
                    color: dateFilter === opt.value ? 'white' : '#64748B',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#64748B' }}>
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md text-xs border"
              style={{ borderColor: '#E5EAF0', color: COLORS.dark }}
            >
              <option value="">All Categories</option>
              {enums?.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
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
            <p>Loading disruptors data...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="section-card text-center py-12" style={{ color: '#94A3B8' }}>
          No disruptor data available for the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Winners */}
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: COLORS.dark }}>
              <Zap size={16} style={{ color: '#22C55E' }} />
              Winners (Top {Math.min(winners.length, MAX_BRANDS)} Expanding)
            </h3>
            {winners.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: '#94A3B8' }}>
                No expanding brands found.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(winners.length * 32, 200)}>
                <BarChart
                  data={winners}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="brand_name"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    width={95}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="openings" name="Openings" barSize={10} radius={[0, 2, 2, 0]}>
                    {winners.map((_, idx) => (
                      <Cell key={idx} fill="#22C55E" />
                    ))}
                  </Bar>
                  <Bar dataKey="closings" name="Closings" barSize={10} radius={[0, 2, 2, 0]}>
                    {winners.map((_, idx) => (
                      <Cell key={idx} fill="#EF4444" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Losers */}
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: COLORS.dark }}>
              <Zap size={16} style={{ color: '#EF4444' }} />
              Losers (Top {Math.min(losers.length, MAX_BRANDS)} Contracting)
            </h3>
            {losers.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: '#94A3B8' }}>
                No contracting brands found.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(losers.length * 32, 200)}>
                <BarChart
                  data={losers}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="brand_name"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    width={95}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="openings" name="Openings" barSize={10} radius={[0, 2, 2, 0]}>
                    {losers.map((_, idx) => (
                      <Cell key={idx} fill="#22C55E" />
                    ))}
                  </Bar>
                  <Bar dataKey="closings" name="Closings" barSize={10} radius={[0, 2, 2, 0]}>
                    {losers.map((_, idx) => (
                      <Cell key={idx} fill="#EF4444" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
