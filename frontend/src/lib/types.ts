export interface Mall {
  id: string;
  name: string;
  brands_count: number;
  stores_count: number;
  gla: number | null;
  type: string;
  city: string;
  zip: string;
  country: string;
  operator: string;
  latitude: number;
  longitude: number;
}

export interface Store {
  id: string;
  store_name: string;
  store_type: string;
  store_brands: string;
  major_category: string;
  additional_categories: string;
  store_tags: string;
  shopping_mall: string;
  mall_type: string;
  city: string;
  zip: string;
  country: string;
  store_sqm: string | null;
  store_size: string | null;
  opened_date: string | null;
  closed_date: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Brand {
  brand_name: string;
  category: string;
  primary_category: string;
  website: string;
  total_monobrand: number;
  total_multibrand: number;
  total_locations: number;
}

export interface BrandDetailMall {
  id: number;
  name: string;
  city: string;
  country: string;
  type: string;
}

export interface BrandDetail {
  brand_name: string;
  category: string;
  primary_category: string;
  website: string;
  brand_tags: string;
  malls: BrandDetailMall[];
  total_mall_count: number;
  country_matrix: Record<string, number>;
}

export interface TrendData {
  openings: { month: string; count: number }[];
  closings: { month: string; count: number }[];
}

export interface KPIs {
  total_malls: number;
  total_stores: number;
  total_brands: number;
  total_cities: number;
  total_operators: number;
}

export interface GapRow {
  brand_name: string;
  category: string;
  malls: Record<string, boolean>;
  coverage_pct: number;
  present_in: number;
  total_selected: number;
}

export interface MallDetail {
  id: number;
  name: string;
  brands_count: number;
  stores_count: number;
  gla: number | null;
  type: string;
  city: string;
  zip: string;
  country: string;
  www: string | null;
  mall_plan: string | null;
  operator: string | null;
  last_update: string | null;
  in_database_from: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  stores: MallStore[];
}

export interface MallStore {
  id: number;
  store_name: string;
  store_type: string;
  store_brands: number;
  major_category: string;
  store_tags: string | null;
  store_sqm: number | null;
  store_size: string | null;
  opened_date: string | null;
  closed_date: string | null;
}

export interface EnumValues {
  countries: string[];
  cities: string[];
  categories: string[];
  operators: string[];
  mall_types: string[];
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  value: number;
  label: string;
}

export interface TrendPoint {
  period: string;
  value: number;
  category?: string;
}

export interface StoreFilters {
  country?: string;
  city?: string;
  category?: string;
  mall_name?: string;
  brand_name?: string;
}

export interface HeatmapFilters {
  country?: string;
  metric?: string;
}

export interface HealthScore {
  mall_name: string;
  city: string;
  openings: number;
  closings: number;
  total_stores: number;
  net_change: number;
  churn_rate: number;
}

export interface DisruptorBrand {
  brand_name: string;
  category: string;
  openings: number;
  closings: number;
  net_change: number;
}

export interface EcosystemPair {
  brand_a: string;
  brand_b: string;
  shared_malls: number;
}

export interface EcosystemBrandEntry {
  brand: string;
  shared_malls: number;
  strength: number;
}

export interface EcosystemData {
  pairs?: EcosystemPair[];
  brand?: string;
  total_malls?: number;
  co_occurring?: EcosystemBrandEntry[];
}
