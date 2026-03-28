'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { fetchMalls, fetchEnums } from '@/lib/api';
import type { Mall, EnumValues } from '@/lib/types';

const MallMapInner = dynamic(() => import('@/components/MallMapInner'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 'calc(100vh - 160px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FAFE',
        borderRadius: '12px',
        color: '#94A3B8',
      }}
    >
      Loading map...
    </div>
  ),
});

const ALL_OPTION = 'All';

export default function HeatmapPage() {
  const [malls, setMalls] = useState<Mall[]>([]);
  const [enums, setEnums] = useState<EnumValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCity, setSelectedCity] = useState(ALL_OPTION);
  const [selectedType, setSelectedType] = useState(ALL_OPTION);

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
    return malls.filter((mall) => {
      if (selectedCity !== ALL_OPTION && mall.city !== selectedCity) return false;
      if (selectedType !== ALL_OPTION && mall.type !== selectedType) return false;
      return true;
    });
  }, [malls, selectedCity, selectedType]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>
        Heatmap
      </h1>
      <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
        Geographic distribution of shopping malls
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
          Failed to load data: {error}
        </div>
      )}

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-4 mb-4 p-4 rounded-lg"
        style={{ background: '#F8FAFE', border: '1px solid #E5EAF0' }}
      >
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: '#64748B' }}>
            City
          </label>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: '#E5EAF0', color: '#1A1A2E' }}
          >
            <option value={ALL_OPTION}>All Cities</option>
            {enums?.cities?.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: '#64748B' }}>
            Mall Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: '#E5EAF0', color: '#1A1A2E' }}
          >
            <option value={ALL_OPTION}>All Types</option>
            {enums?.mall_types?.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-sm" style={{ color: '#64748B' }}>
          Showing{' '}
          <strong style={{ color: '#3EA8FF' }}>{filteredMalls.length}</strong> of{' '}
          <strong>{malls.length}</strong> malls
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ height: 'calc(100vh - 240px)', color: '#94A3B8' }}
        >
          <div className="text-center">
            <div
              className="inline-block w-8 h-8 border-3 rounded-full animate-spin mb-3"
              style={{
                borderColor: '#E5EAF0',
                borderTopColor: '#3EA8FF',
              }}
            />
            <p>Loading heatmap data...</p>
          </div>
        </div>
      ) : (
        <MallMapInner
          malls={filteredMalls}
          height="calc(100vh - 240px)"
        />
      )}
    </div>
  );
}
