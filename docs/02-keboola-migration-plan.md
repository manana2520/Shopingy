# Shopingy to Keboola Migration Plan

## Goal

Migrate the Shopingy Mall Analyzer platform to Keboola, creating a modern data-driven application running on Keboola's infrastructure with Keboola Storage as the database backend.

## Phase 1: Data Extraction from Shopingy

### 1.1 Export All Data via XLS Download
The Shopingy business app provides XLS export functionality. Download all available data:

- **Stores** (/stores/) - Export All (~10,932 records for CZ; full dataset ~340,000+)
- **Malls** (/shoppingmall/) - Export All (~325 records for CZ; full dataset ~8,000+)
- **Brands** (/brands/) - Export All (~1,340 records)
- **Store Index** (/unique-stores/) - Export All (~4,419 records for CZ)

### 1.2 Export via API (Alternative/Supplement)
Use the Shopingy REST API to pull data programmatically:

```
POST /api/shops/         - All stores
POST /api/shoppingmalls/ - All malls
POST /api/brands/        - All brands
POST /api/unique-shops/  - Store index
GET  /api/enums/*        - All reference data
```

The API uses DataTables server-side protocol. **Paginate in batches of 5,000** records using the `start` parameter (requesting 50,000+ at once risks server timeouts).

**Authentication note:** The login flow requires a CSRF token. First `GET /login` to capture the CSRF token and session cookie, then `POST /login` with credentials + CSRF token.

### 1.3 Extract Reference/Enum Data
Pull all enum endpoints and store as lookup tables:
- active, types, categories, kinds, cities, countries
- sizes, outlettype, streetmall, brands, malls, mallsoperator

---

## Phase 2: Keboola Storage Design

### 2.1 Table Structure in Keboola Storage

Create the following tables in Keboola Storage:

#### Fact Tables (in.c-shopingy bucket)
| Table | Description | Primary Key |
|---|---|---|
| `stores` | All store records with full attributes | store_id |
| `malls` | All shopping mall records | mall_id |
| `brands` | Brand master data | brand_id |
| `store_index` | Aggregated unique store view | store_index_id |
| `brand_country_matrix` | Brand presence per country - **unpivoted long format** (brand_name, country, monobrand_stores, multibrand_stores) | brand_id + country |
| `store_history` | Historical changes (openings/closings) with dates | store_id + change_date |
| `user_preferences` | Saved filter configurations per user (JSON) for Favorite Filters feature | user_id + filter_name |

#### Dimension/Lookup Tables (in.c-shopingy-enums bucket)
| Table | Description |
|---|---|
| `enum_categories` | Major product categories (20 values) |
| `enum_subcategories` | Subcategories/kinds (71 values) |
| `enum_store_types` | Monobrand/Multibrand |
| `enum_mall_types` | Shopping Mall, Outlet, Airport, Retail Park, etc. (7 values) |
| `enum_sizes` | Store size categories XXL-XS (6 values) |
| `enum_countries` | All tracked countries |
| `enum_cities` | All tracked cities |
| `enum_mall_operators` | Mall operating companies (165 values) |

### 2.2 Data Loading into Keboola

**Keboola Project:** ID 1313 on `eu-west-1.aws.keboola.dev` (dev/staging stack)
- URL: `https://connection.eu-west-1.aws.keboola.dev/admin/projects/1313/dashboard`
- Master token in `.env` as `KEBOOLA_MASTER_TOKEN`

Option A: **Manual CSV upload** - Export XLS from Shopingy, convert to CSV, upload to Keboola Storage
Option B: **Generic Extractor** - Configure Keboola's HTTP extractor to pull from Shopingy API
Option C: **Python Transformation** - Write a Python script in Keboola to call Shopingy API and load data

**Recommended:** Start with Option A for initial load, then set up Option B or C for recurring updates.

**Type casting during load:** Explicitly cast numeric strings (GLA, store_sqm, lat/lng) and date strings (last_update, created_on, etc.) during load or in the first SQL transformation. For the `stores` table, if `store_id` is not stable across exports, use composite key: `store_name + mall_id + city`.

---

## Phase 3: Data Transformations in Keboola

### 3.1 SQL Transformations

Create SQL transformations to produce analytical views:

1. **Mall Summary** - Aggregate store counts, brand counts, GLA per mall
2. **Brand Penetration** - Percentage of malls where each brand has presence, by country
3. **Category Mix** - Category distribution per mall (for GAP analysis)
4. **Store Changes** - Monthly/quarterly delta of openings vs closings per mall/city/country
5. **Competitive Analysis** - Which brands appear together most frequently
6. **Geographic Coverage** - Brand presence by city/country with lat/lng for mapping
7. **GAP Analysis Matrix** - Pre-compute a "Brand x Mall" presence matrix in SQL for responsive Streamlit performance
8. **Geocoding Enrichment** - Fill missing lat/lng values using Keboola Geocoding augmentation (Google Maps or OSM) based on City + ZIP

### 3.2 Output Tables (out.c-shopingy-analytics bucket)

| Table | Description |
|---|---|
| `mall_summary` | Enriched mall data with aggregated metrics |
| `brand_penetration` | Brand x Country penetration rates |
| `category_mix_by_mall` | Category breakdown per mall |
| `store_movement` | Monthly opening/closing trends |
| `gap_analysis_base` | Pre-computed GAP analysis data |
| `brand_mall_matrix` | Brand x Mall presence matrix for GAP analysis |

---

## Phase 4: Keboola Data App (Frontend)

### 4.1 Streamlit Data App on Keboola

Build a Streamlit-based data application deployed on Keboola platform. The app should replicate and improve upon the current Shopingy features.

#### App Pages/Sections:

1. **Malls Explorer**
   - Filterable table of shopping malls
   - Columns: Name, Stores, Brands, GLA, Type, City, Country, Operator
   - Click to drill down into mall detail (store list)
   - Map view with mall locations (using lat/lng)

2. **Stores Explorer**
   - Filterable table of all stores
   - Filters: Status, Type, Brand, Category, Mall, City, Country, Size
   - Saved filter presets

3. **Brands Dashboard**
   - Brand list with per-country store counts
   - Brand penetration visualization
   - Click brand to see all locations

4. **GAP Analysis (Click & Compare)**
   - Select up to 10 malls/selections
   - Side-by-side comparison showing shared and unique brands/stores
   - Highlight gaps (brands present in selection A but missing in B)

5. **Heatmap / Map View**
   - Interactive map (Folium/Plotly) showing mall/store locations
   - Color-coded by selection or category
   - Cluster markers for dense areas

6. **Store History / Trends**
   - Timeline of store openings and closings
   - Filter by date range
   - Trend charts (monthly/quarterly)

7. **Export**
   - CSV/Excel download from any view

### 4.2 Technology Stack for Data App
- **Framework:** Streamlit (Keboola native support)
- **Data Access:** Keboola Storage API / SAPI client
- **Mapping:** Folium or Plotly for geographic visualization
- **Charts:** Plotly, Altair, or Streamlit native charts
- **Tables:** st.dataframe with filtering, or AG Grid component
- **CRITICAL:** Use server-side filtering via Keboola Storage API queries - do NOT load 340k+ rows into st.dataframe
- **Auth:** Keboola OIDC proxy authentication (built-in)

---

## Phase 5: Automation & Orchestration

### 5.1 Data Refresh Pipeline

Set up a Keboola Flow (orchestration) for regular data updates:

1. **Extract** - Pull latest data from Shopingy API (or manual upload)
2. **Transform** - Run SQL transformations to update analytical tables
3. **Notify** - Send notification on completion or data anomalies

Schedule: Weekly or monthly (matching Shopingy's update frequency)

### 5.2 Data Quality Checks

- Row count monitoring (detect unexpected drops)
- **Column count monitoring** - Detect if Shopingy API schema changes (columns added/reordered in positional arrays)
- Schema validation (new columns, missing data)
- Freshness checks (alert if data is stale)

---

## Implementation Timeline

| Phase | Duration | Dependencies |
|---|---|---|
| Phase 1: Data Extraction | 1-2 days | Shopingy access |
| Phase 2: Storage Design | 1 day | Phase 1 |
| Phase 3: Transformations | 2-3 days | Phase 2 |
| Phase 4: Data App | 5-7 days | Phase 3 |
| Phase 5: Automation | 1-2 days | Phase 4 |
| **Total** | **~10-15 days** | |

---

## Risks and Considerations

1. **Data Access Scope** - Current subscription may only cover Czech Republic. Full migration needs access to all countries or plan to expand.
2. **Data Freshness** - Shopingy updates data monthly. Need to establish a reliable extraction schedule.
3. **API Stability** - Shopingy API is not documented publicly; it may change without notice.
4. **Feature Parity** - The GAP analysis and Heatmap features require significant frontend development in Streamlit.
5. **Licensing** - Shopingy's Terms of Business restrict redistribution of data. The Keboola app should be for internal use or properly licensed.
6. **Store History** - Historical data may not be fully available via current API; need to verify export capabilities.
7. **Saved Selections Migration** - Existing user-saved selections (at `/api/helpers/tables/selections/`) may need to be migrated for continuity.
8. **Mall Floor Plans** - These are external URLs that may break if source site changes. Consider downloading to Keboola File Storage bucket as a backup.
