'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchMalls, fetchProximity } from '@/lib/api';
import type { Mall, ProximityResult } from '@/lib/types';
import ProximityMap from '@/components/ProximityMap';

const RADIUS_OPTIONS = [5, 10, 25, 50];

export default function ProximityPage() {
  const [mallList, setMallList] = useState<Mall[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMall, setSelectedMall] = useState('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [result, setResult] = useState<ProximityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [mallsLoading, setMallsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Load mall names for autocomplete
  useEffect(() => {
    fetchMalls()
      .then((data) => setMallList(data))
      .catch((err) => setError(err.message))
      .finally(() => setMallsLoading(false));
  }, []);

  const filteredMallNames = useMemo(() => {
    if (!searchTerm) return mallList.map((m) => m.name).slice(0, 50);
    const term = searchTerm.toLowerCase();
    return mallList
      .map((m) => m.name)
      .filter((name) => name.toLowerCase().includes(term))
      .slice(0, 50);
  }, [mallList, searchTerm]);

  const handleSearch = async () => {
    if (!selectedMall) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProximity(selectedMall, radiusKm);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proximity data');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const avgDistance = useMemo(() => {
    if (!result || result.nearby.length === 0) return 0;
    const total = result.nearby.reduce((sum, m) => sum + m.distance_km, 0);
    return (total / result.nearby.length).toFixed(1);
  }, [result]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>
        Catchment Area Analysis
      </h1>
      <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
        Find nearby malls within a radius
      </p>

      {error && (
        <div
          className="mb-4 p-4 rounded-lg text-sm"
          style={{
            background: '#FEF2F2',
            color: '#EF4444',
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </div>
      )}

      {/* Controls bar */}
      <div
        className="flex flex-wrap items-center gap-4 mb-4 p-4 rounded-lg"
        style={{ background: '#F8FAFE', border: '1px solid #E5EAF0' }}
      >
        {/* Mall search dropdown */}
        <div className="relative flex-1 min-w-[240px] max-w-[360px]">
          <label className="text-sm font-medium block mb-1" style={{ color: '#64748B' }}>
            Mall
          </label>
          <input
            type="text"
            placeholder={mallsLoading ? 'Loading malls...' : 'Search for a mall...'}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full text-sm px-3 py-2 rounded-lg border"
            style={{ borderColor: '#E5EAF0', color: '#1A1A2E' }}
          />
          {showDropdown && filteredMallNames.length > 0 && (
            <div
              className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg"
              style={{ background: '#fff', borderColor: '#E5EAF0' }}
            >
              {filteredMallNames.map((name) => (
                <button
                  key={name}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                  style={{ color: name === selectedMall ? '#3EA8FF' : '#1A1A2E' }}
                  onClick={() => {
                    setSelectedMall(name);
                    setSearchTerm(name);
                    setShowDropdown(false);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Radius toggle */}
        <div>
          <label className="text-sm font-medium block mb-1" style={{ color: '#64748B' }}>
            Radius
          </label>
          <div className="flex gap-1">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  background: radiusKm === r ? '#3EA8FF' : '#fff',
                  color: radiusKm === r ? '#fff' : '#64748B',
                  border: `1px solid ${radiusKm === r ? '#3EA8FF' : '#E5EAF0'}`,
                }}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Search button */}
        <div className="self-end">
          <button
            onClick={handleSearch}
            disabled={!selectedMall || loading}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{
              background: !selectedMall || loading ? '#94A3B8' : '#3EA8FF',
              cursor: !selectedMall || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* KPI row */}
      {result && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-lg" style={{ background: '#F8FAFE', border: '1px solid #E5EAF0' }}>
            <div className="text-2xl font-bold" style={{ color: '#3EA8FF' }}>
              {result.total_nearby}
            </div>
            <div className="text-sm" style={{ color: '#64748B' }}>
              malls within {result.radius_km} km
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ background: '#F8FAFE', border: '1px solid #E5EAF0' }}>
            <div className="text-2xl font-bold" style={{ color: '#3EA8FF' }}>
              {result.total_stores_in_catchment.toLocaleString()}
            </div>
            <div className="text-sm" style={{ color: '#64748B' }}>
              total stores in catchment
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ background: '#F8FAFE', border: '1px solid #E5EAF0' }}>
            <div className="text-2xl font-bold" style={{ color: '#3EA8FF' }}>
              {avgDistance}
            </div>
            <div className="text-sm" style={{ color: '#64748B' }}>
              avg distance (km)
            </div>
          </div>
        </div>
      )}

      {/* Main content: map + table */}
      {loading && (
        <div
          className="flex items-center justify-center"
          style={{ height: '400px', color: '#94A3B8' }}
        >
          <div className="text-center">
            <div
              className="inline-block w-8 h-8 border-3 rounded-full animate-spin mb-3"
              style={{ borderColor: '#E5EAF0', borderTopColor: '#3EA8FF' }}
            />
            <p>Searching nearby malls...</p>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Map (60%) */}
          <div className="lg:col-span-3 rounded-lg overflow-hidden" style={{ border: '1px solid #E5EAF0' }}>
            <ProximityMap
              center={{
                lat: result.center.latitude,
                lng: result.center.longitude,
                name: result.center.name,
              }}
              nearby={result.nearby}
              radiusKm={result.radius_km}
              height="calc(100vh - 420px)"
            />
          </div>

          {/* Table (40%) */}
          <div
            className="lg:col-span-2 rounded-lg overflow-auto"
            style={{
              border: '1px solid #E5EAF0',
              maxHeight: 'calc(100vh - 420px)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F8FAFE' }}>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: '#64748B' }}>Name</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#64748B' }}>Dist (km)</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: '#64748B' }}>Type</th>
                  <th className="text-left px-3 py-2.5 font-medium" style={{ color: '#64748B' }}>City</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#64748B' }}>Stores</th>
                  <th className="text-right px-3 py-2.5 font-medium" style={{ color: '#64748B' }}>Brands</th>
                </tr>
              </thead>
              <tbody>
                {result.nearby.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8" style={{ color: '#94A3B8' }}>
                      No malls found within {result.radius_km} km
                    </td>
                  </tr>
                ) : (
                  result.nearby.map((mall) => (
                    <tr key={mall.name} className="border-t" style={{ borderColor: '#F1F5F9' }}>
                      <td className="px-3 py-2">
                        <a
                          href={`/malls?search=${encodeURIComponent(mall.name)}`}
                          className="font-medium hover:underline"
                          style={{ color: '#3EA8FF' }}
                        >
                          {mall.name}
                        </a>
                      </td>
                      <td className="text-right px-3 py-2" style={{ color: '#1A1A2E' }}>{mall.distance_km}</td>
                      <td className="px-3 py-2" style={{ color: '#64748B' }}>{mall.type || '-'}</td>
                      <td className="px-3 py-2" style={{ color: '#64748B' }}>{mall.city || '-'}</td>
                      <td className="text-right px-3 py-2" style={{ color: '#1A1A2E' }}>{mall.stores_count}</td>
                      <td className="text-right px-3 py-2" style={{ color: '#1A1A2E' }}>{mall.brands_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ height: '400px', background: '#F8FAFE', border: '1px solid #E5EAF0', color: '#94A3B8' }}
        >
          <div className="text-center">
            <p className="text-lg mb-1">Select a mall and click Search</p>
            <p className="text-sm">Find competing malls within the catchment area</p>
          </div>
        </div>
      )}
    </div>
  );
}
