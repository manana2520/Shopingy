'use client';

import { useEffect, useState } from 'react';
import { Building2, Store, Tags, MapPin, Users } from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import MallMap from '@/components/MallMap';
import CategoryChart from '@/components/CategoryChart';
import DonutChart from '@/components/DonutChart';
import { fetchKPIs, fetchMalls, fetchStores } from '@/lib/api';
import type { KPIs, Mall, Store as StoreType } from '@/lib/types';

function computeCategoryData(stores: StoreType[]): { category: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const store of stores) {
    const cat = store.major_category || 'Unknown';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeMallTypeData(malls: Mall[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const mall of malls) {
    const type = mall.type || 'Unknown';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export default function MarketPulsePage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [malls, setMalls] = useState<Mall[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchKPIs(), fetchMalls(), fetchStores()])
      .then(([kpiData, mallData, storeData]) => {
        setKpis(kpiData);
        setMalls(mallData);
        setStores(storeData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categoryData = computeCategoryData(stores);
  const mallTypeData = computeMallTypeData(malls);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A2E' }}>
        Market Pulse
      </h1>
      <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
        Overview of the retail real estate market
      </p>

      {error && (
        <div
          className="mb-6 p-4 rounded-lg text-sm"
          style={{
            background: '#FEF2F2',
            color: '#EF4444',
            border: '1px solid #FECACA',
          }}
        >
          Failed to load data: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KPICard
          label="Total Malls"
          value={kpis?.total_malls ?? 0}
          icon={<Building2 size={24} />}
        />
        <KPICard
          label="Total Stores"
          value={kpis?.total_stores ?? 0}
          icon={<Store size={24} />}
        />
        <KPICard
          label="Total Brands"
          value={kpis?.total_brands ?? 0}
          icon={<Tags size={24} />}
        />
        <KPICard
          label="Cities"
          value={kpis?.total_cities ?? 0}
          icon={<MapPin size={24} />}
        />
        <KPICard
          label="Operators"
          value={kpis?.total_operators ?? 0}
          icon={<Users size={24} />}
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
                borderTopColor: '#3EA8FF',
              }}
            />
            <p>Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="section-card">
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#1A1A2E' }}>
              Mall Locations
            </h3>
            <MallMap malls={malls} height="450px" />
          </div>
          <div className="flex flex-col gap-6">
            <CategoryChart data={categoryData} />
            <DonutChart data={mallTypeData} />
          </div>
        </div>
      )}
    </div>
  );
}
