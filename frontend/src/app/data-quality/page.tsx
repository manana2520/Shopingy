'use client';

import { useEffect, useState, useMemo } from 'react';
import { Building2, Store, ShieldCheck, Database } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { fetchDataQuality } from '@/lib/api';
import type { DataQualityResult, FieldCompleteness, MallQualityScore } from '@/lib/types';
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

function qualityColor(pct: number): string {
  if (pct >= 80) return '#22C55E';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

type SortKey = 'mall_name' | 'store_count' | 'avg_completeness' | 'major_category' | 'store_type' | 'store_sqm' | 'opened_date';

export default function DataQualityPage() {
  const [data, setData] = useState<DataQualityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('avg_completeness');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetchDataQuality()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedMallScores = useMemo(() => {
    if (!data) return [];
    const scores = [...data.mall_scores];
    scores.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return scores;
  }, [data, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'mall_name');
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortAsc ? ' \u25B2' : ' \u25BC';
  }

  const FieldChart = ({ fields, title }: { fields: FieldCompleteness[]; title: string }) => {
    const sorted = [...fields].sort((a, b) => a.pct - b.pct);
    return (
      <div className="section-card flex-1 min-w-0">
        <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
          {title}
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(sorted.length * 28, 200)}>
          <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 50, bottom: 0, left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis
              type="category"
              dataKey="field"
              tick={{ fontSize: 11, fill: '#64748B' }}
              width={115}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Completeness']}
              contentStyle={{ fontSize: 12, border: '1px solid #E5EAF0' }}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={18} label={{ position: 'right', fontSize: 11, fill: '#64748B', formatter: (v: number) => `${v}%` }}>
              {sorted.map((entry, idx) => (
                <Cell key={idx} fill={qualityColor(entry.pct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const CellValue = ({ value }: { value: number }) => (
    <span style={{ color: qualityColor(value), fontWeight: 600 }}>
      {value}%
    </span>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Data Quality
      </h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Dataset completeness and coverage analysis
      </p>

      {error && (
        <div
          className="mb-6 p-4 rounded-lg text-sm"
          style={{ background: '#FEF2F2', color: COLORS.danger, border: '1px solid #FECACA' }}
        >
          Failed to load data: {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center" style={{ minHeight: 400, color: '#94A3B8' }}>
          <div className="text-center">
            <div
              className="inline-block w-8 h-8 border-3 rounded-full animate-spin mb-3"
              style={{ borderColor: '#E5EAF0', borderTopColor: COLORS.primary }}
            />
            <p>Loading data quality metrics...</p>
          </div>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Malls"
              value={data.summary.total_malls}
              icon={<Building2 size={24} />}
            />
            <KPICard
              label="Total Stores"
              value={data.summary.total_stores}
              icon={<Store size={24} />}
            />
            <KPICard
              label="Mall Completeness"
              value={Math.round(data.summary.mall_completeness_avg)}
              icon={<ShieldCheck size={24} />}
              suffix="%"
            />
            <KPICard
              label="Store Completeness"
              value={Math.round(data.summary.store_completeness_avg)}
              icon={<Database size={24} />}
              suffix="%"
            />
          </div>

          {/* Field Completeness Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FieldChart fields={data.mall_fields} title="Mall Fields Completeness" />
            <FieldChart fields={data.store_fields} title="Store Fields Completeness" />
          </div>

          {/* Per-Mall Data Quality Table */}
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
              Per-Mall Data Quality
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: '#64748B', borderBottom: '2px solid #E5EAF0' }}>
                    {([
                      ['mall_name', 'Mall Name'],
                      ['store_count', 'Stores'],
                      ['avg_completeness', 'Avg Completeness'],
                      ['major_category', 'Category %'],
                      ['store_type', 'Type %'],
                      ['store_sqm', 'Size %'],
                      ['opened_date', 'Dates %'],
                    ] as [SortKey, string][]).map(([key, label]) => (
                      <th
                        key={key}
                        className={`px-3 py-2 font-medium cursor-pointer hover:text-gray-900 ${key === 'mall_name' ? 'text-left' : 'text-right'}`}
                        onClick={() => handleSort(key)}
                      >
                        {label}{sortIndicator(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMallScores.map((mall: MallQualityScore) => (
                    <tr key={mall.mall_name} style={{ borderBottom: '1px solid #E5EAF0' }}>
                      <td className="px-3 py-2 font-medium" style={{ color: COLORS.dark }}>
                        {mall.mall_name}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: '#64748B' }}>
                        {mall.store_count}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CellValue value={Number(mall.avg_completeness)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CellValue value={Number(mall.major_category ?? 0)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CellValue value={Number(mall.store_type ?? 0)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CellValue value={Number(mall.store_sqm ?? 0)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CellValue value={Number(mall.opened_date ?? 0)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="section-card text-center py-12" style={{ color: '#94A3B8' }}>
          No data quality information available.
        </div>
      )}
    </div>
  );
}
