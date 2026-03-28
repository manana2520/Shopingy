'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { fetchBrands, fetchEnums, fetchBrandDetail } from '@/lib/api';
import type { Brand, BrandDetail, EnumValues } from '@/lib/types';
import { COLORS } from '@/lib/theme';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  Sport: COLORS.chart[0],
  Apparel: COLORS.chart[1],
  'Bags & Accessories': COLORS.chart[2],
  Eyewear: COLORS.chart[3],
  Entertainment: COLORS.chart[4],
  'Watches & Jewellery': COLORS.chart[5],
  'Department Store': COLORS.chart[6],
  Streetwear: COLORS.chart[7],
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || COLORS.chart[0];
}

function BrandExpandedRow({ brandName }: { brandName: string }) {
  const [detail, setDetail] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBrandDetail(brandName)
      .then(setDetail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [brandName]);

  if (loading) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-6">
          <div className="flex items-center gap-2" style={{ color: '#94A3B8' }}>
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: '#E5EAF0', borderTopColor: COLORS.primary }}
            />
            Loading brand details...
          </div>
        </td>
      </tr>
    );
  }

  if (error || !detail) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-4" style={{ color: COLORS.danger }}>
          Failed to load brand details{error ? `: ${error}` : ''}
        </td>
      </tr>
    );
  }

  const donutData = [
    { name: 'Monobrand', value: detail.malls.filter(() => true).length > 0 ? 1 : 0 },
    { name: 'Multibrand', value: 1 },
  ];

  // Use country_matrix for the donut
  const countryData = Object.entries(detail.country_matrix || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <tr>
      <td colSpan={6} className="px-4 py-4" style={{ background: '#F8FAFE' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Malls list */}
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: COLORS.dark }}>
              Present in {detail.total_mall_count} malls
            </h4>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: '#64748B' }}>
                    <th className="text-left pb-2 font-medium">Mall</th>
                    <th className="text-left pb-2 font-medium">City</th>
                    <th className="text-left pb-2 font-medium">Country</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.malls.map((mall) => (
                    <tr key={mall.id} className="border-t" style={{ borderColor: '#E5EAF0' }}>
                      <td className="py-1.5">{mall.name}</td>
                      <td className="py-1.5" style={{ color: '#64748B' }}>{mall.city}</td>
                      <td className="py-1.5" style={{ color: '#64748B' }}>{mall.country}</td>
                      <td className="py-1.5">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs"
                          style={{ background: 'rgba(62, 168, 255, 0.1)', color: COLORS.primary }}
                        >
                          {mall.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Country distribution donut */}
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: COLORS.dark }}>
              Country Distribution
            </h4>
            {countryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={countryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {countryData.map((_, index) => (
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
                    formatter={(value: number, name: string) => [`${value} locations`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm" style={{ color: '#94A3B8' }}>No country data available</p>
            )}

            {detail.website && (
              <a
                href={`https://${detail.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs mt-2"
                style={{ color: COLORS.primary }}
              >
                <ExternalLink size={12} />
                {detail.website}
              </a>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [enums, setEnums] = useState<EnumValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'total_locations' | 'total_monobrand' | 'total_multibrand'>('total_locations');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    Promise.all([fetchBrands(), fetchEnums()])
      .then(([brandData, enumData]) => {
        setBrands(brandData);
        setEnums(enumData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredBrands = useMemo(() => {
    let result = brands;

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((b) => b.brand_name.toLowerCase().includes(lower));
    }

    if (categoryFilter) {
      result = result.filter((b) => b.primary_category === categoryFilter || b.category.includes(categoryFilter));
    }

    result = [...result].sort((a, b) => {
      const diff = sortAsc ? a[sortField] - b[sortField] : b[sortField] - a[sortField];
      return diff;
    });

    return result;
  }, [brands, search, categoryFilter, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Brands Intelligence
      </h1>
      <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
        Brand expansion strategy and distribution analysis
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Search brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              border: '1px solid #E5EAF0',
              background: 'white',
              color: COLORS.dark,
            }}
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
          style={{
            border: '1px solid #E5EAF0',
            background: 'white',
            color: COLORS.dark,
            minWidth: 180,
          }}
        >
          <option value="">All Categories</option>
          {enums?.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <div className="flex items-center text-sm" style={{ color: '#64748B' }}>
          {filteredBrands.length} brands
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
            <p>Loading brands data...</p>
          </div>
        </div>
      ) : (
        <div className="section-card overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F1F5F9', color: '#64748B' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ width: 40 }} />
                  <th className="text-left px-4 py-3 font-medium">Brand Name</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer select-none"
                    onClick={() => handleSort('total_locations')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Total Stores <SortIcon field="total_locations" />
                    </span>
                  </th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer select-none"
                    onClick={() => handleSort('total_monobrand')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Monobrand <SortIcon field="total_monobrand" />
                    </span>
                  </th>
                  <th
                    className="text-right px-4 py-3 font-medium cursor-pointer select-none"
                    onClick={() => handleSort('total_multibrand')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Multibrand <SortIcon field="total_multibrand" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center" style={{ color: '#94A3B8' }}>
                      No brands found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredBrands.map((brand) => {
                    const isExpanded = expandedBrand === brand.brand_name;
                    const total = brand.total_monobrand + brand.total_multibrand;
                    const monoPercent = total > 0 ? (brand.total_monobrand / total) * 100 : 0;

                    return (
                      <React.Fragment key={brand.brand_name}>
                        <tr
                          className="cursor-pointer transition-colors"
                          style={{
                            borderBottom: '1px solid #E5EAF0',
                            background: isExpanded ? '#F8FAFE' : 'white',
                          }}
                          onClick={() =>
                            setExpandedBrand(isExpanded ? null : brand.brand_name)
                          }
                          onMouseEnter={(e) => {
                            if (!isExpanded)
                              (e.currentTarget as HTMLElement).style.background = '#FAFBFC';
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded)
                              (e.currentTarget as HTMLElement).style.background = 'white';
                          }}
                        >
                          <td className="px-4 py-3">
                            {isExpanded ? (
                              <ChevronUp size={16} style={{ color: COLORS.primary }} />
                            ) : (
                              <ChevronDown size={16} style={{ color: '#94A3B8' }} />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium" style={{ color: COLORS.dark }}>
                            {brand.brand_name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-block px-2 py-1 rounded text-xs font-medium"
                              style={{
                                background: `${getCategoryColor(brand.primary_category)}18`,
                                color: getCategoryColor(brand.primary_category),
                              }}
                            >
                              {brand.primary_category}
                            </span>
                          </td>
                          <td className="text-right px-4 py-3 font-semibold" style={{ color: COLORS.dark }}>
                            {brand.total_locations.toLocaleString()}
                          </td>
                          <td className="text-right px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: 60,
                                  background: '#E5EAF0',
                                }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${monoPercent}%`,
                                    background: COLORS.primary,
                                  }}
                                />
                              </div>
                              <span style={{ color: '#64748B' }}>
                                {brand.total_monobrand.toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="text-right px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: 60,
                                  background: '#E5EAF0',
                                }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${100 - monoPercent}%`,
                                    background: COLORS.chart[2],
                                  }}
                                />
                              </div>
                              <span style={{ color: '#64748B' }}>
                                {brand.total_multibrand.toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <BrandExpandedRow brandName={brand.brand_name} />
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Need React import for Fragment
import React from 'react';
