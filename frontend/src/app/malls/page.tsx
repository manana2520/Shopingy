'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, MapPin, Building2, Store, ExternalLink } from 'lucide-react';
import { fetchMalls, fetchEnums, fetchMallDetail } from '@/lib/api';
import { COLORS } from '@/lib/theme';
import MallMap from '@/components/MallMap';
import type { Mall, EnumValues, MallDetail } from '@/lib/types';

type SortField = 'name' | 'type' | 'city' | 'stores_count' | 'brands_count' | 'gla' | 'operator';
type SortDirection = 'asc' | 'desc';

export default function MallsPage() {
  const [malls, setMalls] = useState<Mall[]>([]);
  const [enums, setEnums] = useState<EnumValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [expandedMall, setExpandedMall] = useState<string | null>(null);
  const [mallDetail, setMallDetail] = useState<MallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchMalls(), fetchEnums()])
      .then(([mallData, enumData]) => {
        setMalls(mallData);
        setEnums(enumData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredMalls = useMemo(() => {
    let result = malls;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.city.toLowerCase().includes(term) ||
          (m.operator && m.operator.toLowerCase().includes(term))
      );
    }
    if (cityFilter) {
      result = result.filter((m) => m.city === cityFilter);
    }
    if (typeFilter) {
      result = result.filter((m) => m.type === typeFilter);
    }

    return [...result].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'type':
          return dir * (a.type || '').localeCompare(b.type || '');
        case 'city':
          return dir * a.city.localeCompare(b.city);
        case 'stores_count':
          return dir * (a.stores_count - b.stores_count);
        case 'brands_count':
          return dir * (a.brands_count - b.brands_count);
        case 'gla':
          return dir * ((a.gla ?? 0) - (b.gla ?? 0));
        case 'operator':
          return dir * (a.operator || '').localeCompare(b.operator || '');
        default:
          return 0;
      }
    });
  }, [malls, searchTerm, cityFilter, typeFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'city' || field === 'type' || field === 'operator' ? 'asc' : 'desc');
    }
  };

  const handleExpandMall = useCallback(
    async (mallName: string) => {
      if (expandedMall === mallName) {
        setExpandedMall(null);
        setMallDetail(null);
        return;
      }
      setExpandedMall(mallName);
      setMallDetail(null);
      setDetailLoading(true);
      try {
        const detail = await fetchMallDetail(mallName);
        setMallDetail(detail);
      } catch {
        setMallDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedMall]
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-30" />;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const formatGLA = (gla: number | null) => {
    if (gla === null) return '-';
    return `${gla.toLocaleString()} m\u00B2`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        Malls Explorer
      </h1>
      <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
        Directory of shopping centers and malls
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
      <div className="section-card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px] relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search by name, city, or operator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors"
              style={{ borderColor: '#E5EAF0', background: 'white' }}
            />
          </div>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm border outline-none"
            style={{ borderColor: '#E5EAF0', background: 'white', minWidth: 150 }}
          >
            <option value="">All Cities</option>
            {enums?.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm border outline-none"
            style={{ borderColor: '#E5EAF0', background: 'white', minWidth: 150 }}
          >
            <option value="">All Types</option>
            {enums?.mall_types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {(searchTerm || cityFilter || typeFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCityFilter('');
                setTypeFilter('');
              }}
              className="px-3 py-2.5 rounded-lg text-sm border transition-colors hover:bg-gray-50"
              style={{ borderColor: '#E5EAF0', color: '#64748B' }}
            >
              Clear filters
            </button>
          )}

          <span className="text-sm" style={{ color: '#94A3B8' }}>
            {filteredMalls.length} malls
          </span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 400, color: '#94A3B8' }}
        >
          <div className="text-center">
            <div
              className="inline-block w-8 h-8 border-3 rounded-full animate-spin mb-3"
              style={{ borderColor: '#E5EAF0', borderTopColor: COLORS.primary }}
            />
            <p>Loading malls...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="section-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid #E5EAF0' }}>
                {(
                  [
                    { field: 'name' as SortField, label: 'Name', align: 'left' },
                    { field: 'type' as SortField, label: 'Type', align: 'left' },
                    { field: 'city' as SortField, label: 'City', align: 'left' },
                    { field: 'stores_count' as SortField, label: 'Stores', align: 'right' },
                    { field: 'brands_count' as SortField, label: 'Brands', align: 'right' },
                    { field: 'gla' as SortField, label: 'GLA', align: 'right' },
                    { field: 'operator' as SortField, label: 'Operator', align: 'left' },
                  ] as const
                ).map(({ field, label, align }) => (
                  <th
                    key={field}
                    className={`py-3 px-3 cursor-pointer select-none ${
                      align === 'right' ? 'text-right' : 'text-left'
                    }`}
                    onClick={() => handleSort(field)}
                    style={{ color: COLORS.dark }}
                  >
                    <div
                      className={`flex items-center gap-1 ${
                        align === 'right' ? 'justify-end' : ''
                      }`}
                    >
                      {label} <SortIcon field={field} />
                    </div>
                  </th>
                ))}
                <th className="py-3 px-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filteredMalls.map((mall) => {
                const isExpanded = expandedMall === mall.name;
                return (
                  <MallTableRow
                    key={mall.name}
                    mall={mall}
                    isExpanded={isExpanded}
                    mallDetail={isExpanded ? mallDetail : null}
                    detailLoading={isExpanded && detailLoading}
                    onToggle={() => handleExpandMall(mall.name)}
                    formatGLA={formatGLA}
                    selectedMalls={malls}
                  />
                );
              })}
            </tbody>
          </table>

          {filteredMalls.length === 0 && (
            <div className="text-center py-12" style={{ color: '#94A3B8' }}>
              No malls found matching your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MallTableRow({
  mall,
  isExpanded,
  mallDetail,
  detailLoading,
  onToggle,
  formatGLA,
  selectedMalls,
}: {
  mall: Mall;
  isExpanded: boolean;
  mallDetail: MallDetail | null;
  detailLoading: boolean;
  onToggle: () => void;
  formatGLA: (gla: number | null) => string;
  selectedMalls: Mall[];
}) {
  const activeStores = mallDetail?.stores.filter((s) => !s.closed_date) ?? [];
  const closedStores = mallDetail?.stores.filter((s) => s.closed_date) ?? [];
  const mapMall = selectedMalls.find((m) => m.name === mall.name);

  return (
    <>
      <tr
        className="cursor-pointer transition-colors"
        style={{
          borderBottom: isExpanded ? 'none' : '1px solid #F1F5F9',
          background: isExpanded ? 'rgba(62, 168, 255, 0.04)' : 'transparent',
        }}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!isExpanded)
            (e.currentTarget as HTMLElement).style.background = '#F8FAFE';
        }}
        onMouseLeave={(e) => {
          if (!isExpanded)
            (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <td className="py-3 px-3 font-medium" style={{ color: COLORS.primary }}>
          <div className="flex items-center gap-2">
            <Building2 size={16} style={{ color: COLORS.primary, flexShrink: 0 }} />
            {mall.name}
          </div>
        </td>
        <td className="py-3 px-3">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs"
            style={{ background: '#F1F5F9', color: '#64748B' }}
          >
            {mall.type || '-'}
          </span>
        </td>
        <td className="py-3 px-3">
          <div className="flex items-center gap-1">
            <MapPin size={14} style={{ color: '#94A3B8' }} />
            {mall.city}
          </div>
        </td>
        <td className="py-3 px-3 text-right tabular-nums">{mall.stores_count}</td>
        <td className="py-3 px-3 text-right tabular-nums">{mall.brands_count}</td>
        <td className="py-3 px-3 text-right tabular-nums">{formatGLA(mall.gla)}</td>
        <td className="py-3 px-3" style={{ color: '#64748B' }}>
          {mall.operator || '-'}
        </td>
        <td className="py-3 px-3 text-center">
          {isExpanded ? (
            <ChevronUp size={16} style={{ color: '#94A3B8' }} />
          ) : (
            <ChevronDown size={16} style={{ color: '#94A3B8' }} />
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
          <td colSpan={8} className="p-0">
            <div
              className="px-6 py-4"
              style={{ background: 'rgba(62, 168, 255, 0.04)' }}
            >
              {detailLoading ? (
                <div className="flex items-center gap-2 py-4" style={{ color: '#94A3B8' }}>
                  <div
                    className="inline-block w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: '#E5EAF0', borderTopColor: COLORS.primary }}
                  />
                  Loading mall details...
                </div>
              ) : mallDetail ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Mall Info */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: COLORS.dark }}>
                      Mall Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: '#64748B' }}>ZIP:</span>
                        <span style={{ color: COLORS.dark }}>{mallDetail.zip}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: '#64748B' }}>Country:</span>
                        <span style={{ color: COLORS.dark }}>{mallDetail.country}</span>
                      </div>
                      {mallDetail.operator && (
                        <div className="flex justify-between">
                          <span style={{ color: '#64748B' }}>Operator:</span>
                          <span style={{ color: COLORS.dark }}>{mallDetail.operator}</span>
                        </div>
                      )}
                      {mallDetail.gla && (
                        <div className="flex justify-between">
                          <span style={{ color: '#64748B' }}>GLA:</span>
                          <span style={{ color: COLORS.dark }}>
                            {mallDetail.gla.toLocaleString()} m&sup2;
                          </span>
                        </div>
                      )}
                      {mallDetail.www && (
                        <div className="flex justify-between">
                          <span style={{ color: '#64748B' }}>Website:</span>
                          <a
                            href={
                              mallDetail.www.startsWith('http')
                                ? mallDetail.www
                                : `https://${mallDetail.www}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                            style={{ color: COLORS.primary }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visit <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      {mallDetail.last_update && (
                        <div className="flex justify-between">
                          <span style={{ color: '#64748B' }}>Last Update:</span>
                          <span style={{ color: COLORS.dark }}>{mallDetail.last_update}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Store List */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: COLORS.dark }}>
                      <Store size={14} className="inline mr-1" />
                      Active Stores ({activeStores.length})
                    </h4>
                    <div
                      className="max-h-60 overflow-y-auto rounded-lg border"
                      style={{ borderColor: '#E5EAF0' }}
                    >
                      {activeStores.length === 0 ? (
                        <div className="p-4 text-center text-xs" style={{ color: '#94A3B8' }}>
                          No active stores
                        </div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr
                              className="sticky top-0"
                              style={{ background: '#F8FAFE', borderBottom: '1px solid #E5EAF0' }}
                            >
                              <th className="text-left py-2 px-3" style={{ color: '#64748B' }}>
                                Store
                              </th>
                              <th className="text-left py-2 px-3" style={{ color: '#64748B' }}>
                                Category
                              </th>
                              <th className="text-right py-2 px-3" style={{ color: '#64748B' }}>
                                Size
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStores.map((store) => (
                              <tr
                                key={store.id}
                                style={{ borderBottom: '1px solid #F1F5F9' }}
                              >
                                <td className="py-1.5 px-3" style={{ color: COLORS.dark }}>
                                  {store.store_name}
                                </td>
                                <td className="py-1.5 px-3" style={{ color: '#94A3B8' }}>
                                  {store.major_category}
                                </td>
                                <td className="py-1.5 px-3 text-right tabular-nums" style={{ color: '#94A3B8' }}>
                                  {store.store_sqm
                                    ? `${store.store_sqm.toLocaleString()} m\u00B2`
                                    : store.store_size || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {closedStores.length > 0 && (
                      <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                        + {closedStores.length} closed store{closedStores.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Mini Map */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: COLORS.dark }}>
                      <MapPin size={14} className="inline mr-1" />
                      Location
                    </h4>
                    {mapMall && (
                      <MallMap malls={[mapMall]} height="240px" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-sm" style={{ color: '#94A3B8' }}>
                  Failed to load mall details.
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
