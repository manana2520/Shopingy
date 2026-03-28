'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Network, Search } from 'lucide-react';
import { fetchEcosystem } from '@/lib/api';
import type { EcosystemData } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function EcosystemPage() {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [brandData, setBrandData] = useState<EcosystemData | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);

  useEffect(() => {
    fetchEcosystem()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const searchBrand = useCallback(() => {
    const brand = searchInput.trim();
    if (!brand) {
      setSelectedBrand(null);
      setBrandData(null);
      return;
    }
    setSelectedBrand(brand);
    setBrandLoading(true);
    fetchEcosystem(brand)
      .then(setBrandData)
      .catch((err) => setError(err.message))
      .finally(() => setBrandLoading(false));
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') searchBrand();
  };

  const topPairs = useMemo(() => {
    if (!data?.pairs) return [];
    return data.pairs.slice(0, 30);
  }, [data]);

  const maxShared = useMemo(() => {
    return Math.max(...topPairs.map((p) => p.shared_malls), 1);
  }, [topPairs]);

  const coOccurringChartData = useMemo(() => {
    if (!brandData?.co_occurring) return [];
    return brandData.co_occurring.slice(0, 15).map((entry) => ({
      brand: entry.brand,
      shared_malls: entry.shared_malls,
      strength: Math.round(entry.strength * 100),
    }));
  }, [brandData]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { brand: string; shared_malls: number; strength: number } }>;
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
          {d.brand}
        </p>
        <p>Shared Malls: {d.shared_malls}</p>
        <p>Strength: {d.strength}%</p>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Brand Ecosystem
      </h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Which brands always appear together
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

      {/* Search */}
      <div className="section-card mb-6">
        <label className="text-xs font-medium mb-2 block" style={{ color: '#64748B' }}>
          Search Brand Ecosystem
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#94A3B8' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a brand name (e.g. Zara, H&M)..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: '#E5EAF0', color: COLORS.dark }}
            />
          </div>
          <button
            onClick={searchBrand}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: COLORS.primary }}
          >
            Search
          </button>
          {selectedBrand && (
            <button
              onClick={() => {
                setSearchInput('');
                setSelectedBrand(null);
                setBrandData(null);
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#F1F5F9', color: '#64748B' }}
            >
              Clear
            </button>
          )}
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
            <p>Loading ecosystem data...</p>
          </div>
        </div>
      ) : selectedBrand ? (
        /* Brand-specific view */
        brandLoading ? (
          <div
            className="flex items-center justify-center"
            style={{ minHeight: 300, color: '#94A3B8' }}
          >
            <div className="text-center">
              <div
                className="inline-block w-8 h-8 border-3 rounded-full animate-spin mb-3"
                style={{
                  borderColor: '#E5EAF0',
                  borderTopColor: COLORS.primary,
                }}
              />
              <p>Loading ecosystem for {selectedBrand}...</p>
            </div>
          </div>
        ) : !brandData?.co_occurring || brandData.co_occurring.length === 0 ? (
          <div className="section-card text-center py-12" style={{ color: '#94A3B8' }}>
            No ecosystem data found for &quot;{selectedBrand}&quot;.
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="section-card">
              <h3 className="text-sm font-semibold mb-1" style={{ color: COLORS.dark }}>
                Brands that always appear with {selectedBrand}
              </h3>
              <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>
                {selectedBrand} is present in {brandData.total_malls ?? '?'} malls
              </p>
              <ResponsiveContainer width="100%" height={Math.max(coOccurringChartData.length * 32, 200)}>
                <BarChart
                  data={coOccurringChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="brand"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    width={95}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="shared_malls"
                    name="Shared Malls"
                    fill={COLORS.primary}
                    barSize={14}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="section-card">
              <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.dark }}>
                Co-occurrence Details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: '#64748B', borderBottom: '1px solid #E5EAF0' }}>
                      <th className="text-left px-3 py-2 font-medium">#</th>
                      <th className="text-left px-3 py-2 font-medium">Brand</th>
                      <th className="text-right px-3 py-2 font-medium">Shared Malls</th>
                      <th className="text-right px-3 py-2 font-medium">Strength</th>
                      <th className="px-3 py-2 font-medium" style={{ width: 200 }}>
                        Overlap
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandData.co_occurring.map((entry, idx) => {
                      const pct = Math.round(entry.strength * 100);
                      return (
                        <tr key={entry.brand} style={{ borderBottom: '1px solid #E5EAF0' }}>
                          <td className="px-3 py-2" style={{ color: '#94A3B8' }}>
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-medium" style={{ color: COLORS.dark }}>
                            {entry.brand}
                          </td>
                          <td className="text-right px-3 py-2" style={{ color: COLORS.primary }}>
                            {entry.shared_malls}
                          </td>
                          <td className="text-right px-3 py-2 font-semibold" style={{ color: COLORS.dark }}>
                            {pct}%
                          </td>
                          <td className="px-3 py-2">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: '100%', background: '#E5EAF0' }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: COLORS.primary,
                                }}
                              />
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
        )
      ) : /* Default view: top pairs */ topPairs.length === 0 ? (
        <div className="section-card text-center py-12" style={{ color: '#94A3B8' }}>
          No ecosystem data available.
        </div>
      ) : (
        <div className="section-card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: COLORS.dark }}>
            <Network size={16} style={{ color: COLORS.primary }} />
            Top {topPairs.length} Brand Pairs
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: '#64748B', borderBottom: '1px solid #E5EAF0' }}>
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">Brand A</th>
                  <th className="text-left px-3 py-2 font-medium">Brand B</th>
                  <th className="text-right px-3 py-2 font-medium">Shared Malls</th>
                  <th className="px-3 py-2 font-medium" style={{ width: 250 }}>
                    Frequency
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPairs.map((pair, idx) => {
                  const pct = maxShared > 0 ? (pair.shared_malls / maxShared) * 100 : 0;
                  return (
                    <tr key={`${pair.brand_a}-${pair.brand_b}`} style={{ borderBottom: '1px solid #E5EAF0' }}>
                      <td className="px-3 py-2" style={{ color: '#94A3B8' }}>
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 font-medium" style={{ color: COLORS.dark }}>
                        <button
                          className="hover:underline text-left"
                          style={{ color: COLORS.primary }}
                          onClick={() => {
                            setSearchInput(pair.brand_a);
                            setSelectedBrand(pair.brand_a);
                            setBrandLoading(true);
                            fetchEcosystem(pair.brand_a)
                              .then(setBrandData)
                              .catch((err) => setError(err.message))
                              .finally(() => setBrandLoading(false));
                          }}
                        >
                          {pair.brand_a}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-medium" style={{ color: COLORS.dark }}>
                        <button
                          className="hover:underline text-left"
                          style={{ color: COLORS.primary }}
                          onClick={() => {
                            setSearchInput(pair.brand_b);
                            setSelectedBrand(pair.brand_b);
                            setBrandLoading(true);
                            fetchEcosystem(pair.brand_b)
                              .then(setBrandData)
                              .catch((err) => setError(err.message))
                              .finally(() => setBrandLoading(false));
                          }}
                        >
                          {pair.brand_b}
                        </button>
                      </td>
                      <td className="text-right px-3 py-2 font-semibold" style={{ color: COLORS.primary }}>
                        {pair.shared_malls}
                      </td>
                      <td className="px-3 py-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: '100%', background: '#E5EAF0' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: COLORS.primary,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
