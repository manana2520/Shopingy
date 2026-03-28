'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, BarChart3, TrendingUp, Target, ChevronDown, ChevronUp, X } from 'lucide-react';
import { fetchMalls, fetchGapAnalysis } from '@/lib/api';
import { COLORS } from '@/lib/theme';
import type { Mall, GapRow } from '@/lib/types';

type SortField = 'brand_name' | 'category' | 'coverage_pct';
type SortDirection = 'asc' | 'desc';

export default function GapAnalysisPage() {
  const [allMalls, setAllMalls] = useState<Mall[]>([]);
  const [selectedMalls, setSelectedMalls] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [gapData, setGapData] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mallsLoading, setMallsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('coverage_pct');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [analyzed, setAnalyzed] = useState(false);

  useEffect(() => {
    fetchMalls()
      .then((data) => setAllMalls(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(err.message))
      .finally(() => setMallsLoading(false));
  }, []);

  const filteredMallOptions = useMemo(() => {
    return allMalls.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedMalls.includes(m.name)
    );
  }, [allMalls, searchTerm, selectedMalls]);

  const handleSelectMall = useCallback((mallName: string) => {
    setSelectedMalls((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, mallName];
    });
    setSearchTerm('');
  }, []);

  const handleRemoveMall = useCallback((mallName: string) => {
    setSelectedMalls((prev) => prev.filter((n) => n !== mallName));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (selectedMalls.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGapAnalysis(selectedMalls);
      setGapData(data);
      setAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gap analysis');
    } finally {
      setLoading(false);
    }
  }, [selectedMalls]);

  const categories = useMemo(() => {
    const cats = new Set(gapData.map((r) => r.category));
    return Array.from(cats).sort();
  }, [gapData]);

  const sortedData = useMemo(() => {
    let filtered = gapData;
    if (categoryFilter) {
      filtered = filtered.filter((r) => r.category === categoryFilter);
    }
    return [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'brand_name') return dir * a.brand_name.localeCompare(b.brand_name);
      if (sortField === 'category') return dir * a.category.localeCompare(b.category);
      return dir * (a.coverage_pct - b.coverage_pct);
    });
  }, [gapData, sortField, sortDirection, categoryFilter]);

  const stats = useMemo(() => {
    if (gapData.length === 0 || selectedMalls.length === 0)
      return { inAll: 0, expansionOpps: 0, uniqueToOne: 0 };
    const total = selectedMalls.length;
    const inAll = gapData.filter((r) => r.present_in === total).length;
    const expansionOpps = gapData.filter(
      (r) => r.present_in === total - 1 && total > 1
    ).length;
    const uniqueToOne = gapData.filter((r) => r.present_in === 1).length;
    return { inAll, expansionOpps, uniqueToOne };
  }, [gapData, selectedMalls]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'coverage_pct' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-30" />;
    return sortDirection === 'asc' ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  const isExpansionOpportunity = (row: GapRow) =>
    selectedMalls.length > 1 && row.present_in === selectedMalls.length - 1;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.dark }}>
        GAP Analysis
      </h1>
      <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
        Brand coverage analysis across malls - find expansion opportunities
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
          {error}
        </div>
      )}

      {/* Mall Selector */}
      <div className="section-card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <label className="block text-sm font-medium mb-2" style={{ color: COLORS.dark }}>
              Select Malls (2-10)
            </label>

            {/* Selected mall tags */}
            {selectedMalls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedMalls.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: 'rgba(62, 168, 255, 0.1)',
                      color: COLORS.primary,
                      border: `1px solid ${COLORS.primary}`,
                    }}
                  >
                    {name}
                    <button
                      onClick={() => handleRemoveMall(name)}
                      className="hover:opacity-70 ml-1"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: '#94A3B8' }}
              />
              <input
                type="text"
                placeholder={
                  mallsLoading
                    ? 'Loading malls...'
                    : selectedMalls.length >= 10
                    ? 'Maximum 10 malls selected'
                    : 'Search and select malls...'
                }
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                disabled={mallsLoading || selectedMalls.length >= 10}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors"
                style={{
                  borderColor: dropdownOpen ? COLORS.primary : '#E5EAF0',
                  background: 'white',
                }}
              />
            </div>

            {/* Dropdown */}
            {dropdownOpen && filteredMallOptions.length > 0 && (
              <div
                className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border shadow-lg"
                style={{ background: 'white', borderColor: '#E5EAF0' }}
              >
                {filteredMallOptions.slice(0, 50).map((mall) => (
                  <button
                    key={mall.name}
                    onClick={() => {
                      handleSelectMall(mall.name);
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between"
                    style={{ color: COLORS.dark }}
                  >
                    <span>{mall.name}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>
                      {mall.city} - {mall.stores_count} stores
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={selectedMalls.length < 2 || loading}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
            style={{
              background:
                selectedMalls.length < 2
                  ? '#CBD5E1'
                  : loading
                  ? '#94A3B8'
                  : COLORS.primary,
              cursor: selectedMalls.length < 2 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDropdownOpen(false)}
        />
      )}

      {/* Loading */}
      {loading && (
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
            <p>Analyzing brand coverage across {selectedMalls.length} malls...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {analyzed && !loading && gapData.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="kpi-card flex items-center gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(34, 197, 94, 0.1)', color: COLORS.success }}
              >
                <Target size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: COLORS.dark }}>
                  {stats.inAll}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                  Brands in all malls
                </div>
              </div>
            </div>

            <div className="kpi-card flex items-center gap-4" style={{ borderLeftColor: COLORS.warning }}>
              <div
                className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning }}
              >
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: COLORS.dark }}>
                  {stats.expansionOpps}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                  Expansion opportunities
                </div>
              </div>
            </div>

            <div className="kpi-card flex items-center gap-4" style={{ borderLeftColor: COLORS.danger }}>
              <div
                className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: COLORS.danger }}
              >
                <BarChart3 size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: COLORS.dark }}>
                  {stats.uniqueToOne}
                </div>
                <div className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                  Unique to one mall
                </div>
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div className="section-card mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium" style={{ color: COLORS.dark }}>
                Filter by category:
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ borderColor: '#E5EAF0', background: 'white' }}
              >
                <option value="">All categories ({gapData.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({gapData.filter((r) => r.category === cat).length})
                  </option>
                ))}
              </select>
              <span className="text-sm" style={{ color: '#94A3B8' }}>
                Showing {sortedData.length} brands
              </span>
            </div>
          </div>

          {/* GAP Matrix Table */}
          <div className="section-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid #E5EAF0' }}>
                  <th
                    className="text-left py-3 px-3 cursor-pointer select-none"
                    onClick={() => handleSort('brand_name')}
                    style={{ color: COLORS.dark }}
                  >
                    <div className="flex items-center gap-1">
                      Brand <SortIcon field="brand_name" />
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-3 cursor-pointer select-none"
                    onClick={() => handleSort('category')}
                    style={{ color: COLORS.dark }}
                  >
                    <div className="flex items-center gap-1">
                      Category <SortIcon field="category" />
                    </div>
                  </th>
                  {selectedMalls.map((mall) => (
                    <th
                      key={mall}
                      className="text-center py-3 px-2"
                      style={{ color: COLORS.dark, minWidth: 100, maxWidth: 140 }}
                    >
                      <div className="text-xs font-semibold truncate" title={mall}>
                        {mall}
                      </div>
                    </th>
                  ))}
                  <th
                    className="text-right py-3 px-3 cursor-pointer select-none"
                    onClick={() => handleSort('coverage_pct')}
                    style={{ color: COLORS.dark, minWidth: 140 }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Coverage <SortIcon field="coverage_pct" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row) => {
                  const isExpOpp = isExpansionOpportunity(row);
                  return (
                    <tr
                      key={row.brand_name}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        background: isExpOpp
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isExpOpp
                          ? 'rgba(245, 158, 11, 0.15)'
                          : '#F8FAFE';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isExpOpp
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'transparent';
                      }}
                    >
                      <td className="py-2.5 px-3 font-medium" style={{ color: COLORS.dark }}>
                        {row.brand_name}
                        {isExpOpp && (
                          <span
                            className="ml-2 inline-block w-2 h-2 rounded-full"
                            style={{ background: COLORS.warning }}
                            title="Expansion opportunity"
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs"
                          style={{
                            background: '#F1F5F9',
                            color: '#64748B',
                          }}
                        >
                          {row.category}
                        </span>
                      </td>
                      {selectedMalls.map((mall) => (
                        <td key={mall} className="text-center py-2.5 px-2">
                          {row.malls[mall] ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                              style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: COLORS.success,
                              }}
                            >
                              &#10003;
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: COLORS.danger,
                              }}
                            >
                              &mdash;
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2 justify-end">
                          <div
                            className="flex-1 h-2 rounded-full overflow-hidden"
                            style={{ background: '#E5EAF0', maxWidth: 80 }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${row.coverage_pct * 100}%`,
                                background:
                                  row.coverage_pct === 1
                                    ? COLORS.success
                                    : row.coverage_pct >= 0.5
                                    ? COLORS.warning
                                    : COLORS.danger,
                              }}
                            />
                          </div>
                          <span
                            className="text-xs font-medium tabular-nums"
                            style={{
                              color:
                                row.coverage_pct === 1
                                  ? COLORS.success
                                  : row.coverage_pct >= 0.5
                                  ? COLORS.warning
                                  : COLORS.danger,
                              minWidth: 36,
                              textAlign: 'right',
                            }}
                          >
                            {Math.round(row.coverage_pct * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty state */}
      {analyzed && !loading && gapData.length === 0 && (
        <div className="placeholder-panel">
          No gap data found for the selected malls.
        </div>
      )}

      {/* Initial state */}
      {!analyzed && !loading && (
        <div className="placeholder-panel">
          Select 2 or more malls above and click Analyze to see brand coverage gaps.
        </div>
      )}
    </div>
  );
}
