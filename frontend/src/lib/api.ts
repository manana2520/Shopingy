import type {
  KPIs,
  Mall,
  MallDetail,
  Store,
  Brand,
  BrandDetail,
  EnumValues,
  GapRow,
  HeatmapPoint,
  TrendPoint,
  TrendData,
  StoreFilters,
  HeatmapFilters,
  HealthScore,
  EcosystemData,
  EcosystemPair,
  DisruptorBrand,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchKPIs(): Promise<KPIs> {
  return fetchJSON<KPIs>('/kpis');
}

export async function fetchMalls(): Promise<Mall[]> {
  return fetchJSON<Mall[]>('/malls');
}

export async function fetchStores(filters?: StoreFilters): Promise<Store[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }
  const query = params.toString();
  return fetchJSON<Store[]>(`/stores${query ? `?${query}` : ''}`);
}

export async function fetchBrands(): Promise<Brand[]> {
  return fetchJSON<Brand[]>('/brands');
}

export async function fetchEnums(): Promise<EnumValues> {
  return fetchJSON<EnumValues>('/enums');
}

export async function fetchGapAnalysis(mallNames: string[]): Promise<GapRow[]> {
  const joined = mallNames.join(',');
  return fetchJSON<GapRow[]>(`/gap?malls=${encodeURIComponent(joined)}`);
}

export async function fetchMallDetail(mallName: string): Promise<MallDetail> {
  return fetchJSON<MallDetail>(`/malls/${encodeURIComponent(mallName)}`);
}

export async function fetchHeatmapData(filters?: HeatmapFilters): Promise<HeatmapPoint[]> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }
  const query = params.toString();
  return fetchJSON<HeatmapPoint[]>(`/heatmap${query ? `?${query}` : ''}`);
}

export async function fetchTrends(): Promise<TrendPoint[]> {
  return fetchJSON<TrendPoint[]>('/trends');
}

export async function fetchTrendData(): Promise<TrendData> {
  return fetchJSON<TrendData>('/trends');
}

export async function fetchBrandDetail(brandName: string): Promise<BrandDetail> {
  return fetchJSON<BrandDetail>(`/brands/${encodeURIComponent(brandName)}`);
}

export async function fetchHealthScores() {
  return fetchJSON<HealthScore[]>('/health-scores');
}

export async function fetchEcosystem(brand?: string): Promise<EcosystemData> {
  const params = new URLSearchParams();
  if (brand) params.append('brand', brand);
  params.append('min_shared', '3');
  const raw = await fetchJSON<EcosystemPair[]>(`/ecosystem?${params.toString()}`);
  if (brand) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = raw as any[];
    return {
      brand,
      co_occurring: items.map((r) => ({
        brand: r.brand_b as string,
        shared_malls: r.shared_malls as number,
        strength: (r.strength as number) ?? 0,
      })),
    };
  }
  return { pairs: raw };
}

export async function fetchDisruptors(since?: string, category?: string) {
  const params = new URLSearchParams();
  if (since) params.append('since', since);
  if (category) params.append('category', category);
  const q = params.toString();
  return fetchJSON<DisruptorBrand[]>(`/disruptors${q ? `?${q}` : ''}`);
}
