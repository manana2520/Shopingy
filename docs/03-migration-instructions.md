# Migration Instructions - Self-Reference Guide

## Purpose
These instructions guide future Claude Code sessions on how to execute the Shopingy-to-Keboola migration. Read this document at the start of every session working on this project.

## Key Context

- **What:** Migrate Shopingy Mall Analyzer (a retail real estate data platform) to Keboola
- **Architecture doc:** `docs/01-architecture.md` - full reverse-engineered schema of the current app
- **Migration plan:** `docs/02-keboola-migration-plan.md` - phased plan for the migration
- **Credentials:** `.env` file has Shopingy login credentials
- **Keboola access:** Will be configured in `.env` when the Keboola project is created

## Essential Reference Files
Always read these before starting work:
1. `docs/01-architecture.md` - Data model, API endpoints, features
2. `docs/02-keboola-migration-plan.md` - Migration phases and plan
3. `.env` - Credentials for Shopingy and Keboola
4. This file (`docs/03-migration-instructions.md`)

---

## How to Work on Each Phase

### Phase 1: Data Extraction

**Goal:** Get all data out of Shopingy into local CSV/JSON files.

**Method 1 - Browser XLS Export:**
1. Open https://business.shopingy.com/ in Chrome
2. Log in with credentials from `.env`
3. Navigate to each section (Stores, Malls, Brands, Store Index)
4. Click "Export All" (XLS download button)
5. Save files to `data/raw/` directory

**Method 2 - API Extraction (preferred for automation):**
1. Create a Python script in `scripts/extract_shopingy.py`
2. **Authentication flow (CSRF required):**
   - `GET /login` to load the login page and capture the CSRF token from the HTML form + session cookie
   - `POST /login` with email, password, and CSRF token using the session cookie
   - Reuse the authenticated session for all subsequent API calls
3. Call each POST API using **paginated requests** (5,000 records per batch to avoid server timeouts):
   - `POST /api/shops/` with `{"draw":1,"start":0,"length":5000,"columns":[],"order":[],"search":{"value":"","regex":false}}`
   - Increment `start` by `length` until `start >= recordsFiltered`
   - `POST /api/shoppingmalls/` (same pattern)
   - `POST /api/brands/` (same pattern)
   - `POST /api/unique-shops/` (same pattern)
4. Call each GET enum endpoint:
   - `/api/enums/active`, `/api/enums/types`, `/api/enums/categories`, `/api/enums/kinds`
   - `/api/enums/cities`, `/api/enums/countries`, `/api/enums/brands`, `/api/enums/malls`
   - `/api/enums/outlettype`, `/api/enums/sizes`, `/api/enums/streetmall`, `/api/enums/mallsoperator`
5. Save all responses to `data/raw/` as JSON files
6. Convert to CSV with proper column headers (map positional array data to column names from architecture doc)

**Column mappings (API returns positional arrays):**

Malls API columns (in order):
`id, name, brands_count, stores_count, gla, type, city, zip, country, www, mall_plan, operator, last_update, in_database_from, website, latitude, longitude`

Store Index API columns (in order):
`id, is_favorite, store_name, total_locations, store_type, major_category, additional_categories, store_tags, city, zip, country`

Stores API columns (in order):
Check the grid column headers in architecture doc - 20+ columns including: checkbox, store_status, store_name, store_type, store_brands, major_category, additional_categories, store_tags, shopping_mall, mall_type, city, zip, country, store_sqm, store_size, street_mall, www, closed_date, opened_date, created_on, updated_on

Brands API columns (in order):
`checkbox, brand_name, category, website, brand_tags, then pairs of (MonobrandStores_Country, MultibrandStores_Country) for 36 countries, then primary_category`

**CRITICAL - Brands data unpivoting:**
The brands API returns 36 country-specific column pairs (wide format). During extraction, unpivot this into long format:
`brand_name, country, monobrand_stores, multibrand_stores`
This makes Keboola transformations, Streamlit filters, and penetration analysis significantly faster.

**Data type verification:**
During extraction, verify and cast data types explicitly:
- Numeric fields returned as strings: `gla`, `store_sqm`, `brands_count`, `stores_count`, `latitude`, `longitude`
- Date fields returned as strings: `last_update`, `in_database_from`, `created_on`, `updated_on`, `closed_date`, `opened_date`
- Count fields in brands matrix: ensure "-" is converted to 0

### Phase 2: Keboola Storage Setup

**Goal:** Create bucket and table structure in Keboola.

**Prerequisites:** Keboola project is ready. Credentials in `.env`:
- `KEBOOLA_URL` = `https://connection.eu-west-1.aws.keboola.dev/admin/projects/1313/dashboard`
- `KEBOOLA_MASTER_TOKEN` = stored in `.env` (project 1313 on eu-west-1.aws.keboola.dev)
- **Stack:** `eu-west-1.aws.keboola.dev` (this is a dev/staging stack)
- **Project ID:** 1313

**Steps:**
1. Use Keboola MCP tools or API to check project info: `get_project_info`
2. Create buckets:
   - `in.c-shopingy` for fact tables
   - `in.c-shopingy-enums` for reference/lookup tables
3. Upload CSV files to create tables:
   - `stores`, `malls`, `brands`, `store_index`, `brand_country_matrix`
   - All enum tables
4. Verify row counts match source data

**Type casting during load:**
- Ensure explicit casting of GLA, store_sqm (numeric), and all date fields (ISO date format)
- If `store_id` is not stable across exports, use composite primary key: `store_name` + `mall_id` + `city`

**Keboola MCP tools to use:**
- `get_project_info` - verify project access
- `get_buckets` - list existing buckets
- `get_tables` - list tables in a bucket
- `query_data` - verify data after loading
- `create_config` - set up extractors/writers if needed

### Phase 3: SQL Transformations

**Goal:** Create analytical views on top of raw data.

**Steps:**
1. Use `create_sql_transformation` to create each transformation
2. Create output bucket `out.c-shopingy-analytics`
3. Key transformations:
   - Mall summary with aggregated metrics
   - Brand penetration rates by country
   - Category mix per mall
   - Store movement (openings/closings timeline)
   - **GAP analysis base data** - Pre-compute a "Brand x Mall" presence matrix in SQL (not Python). This handles ~340k records efficiently and keeps the Streamlit app responsive.
   - **Geocoding enrichment** - Check for missing `latitude`/`longitude` values in malls. Use Keboola Geocoding augmentation (Google Maps or OSM) to fill gaps based on City + ZIP.

### Phase 4: Streamlit Data App

**Goal:** Build a Keboola Data App that replaces the Shopingy web interface.

**Steps:**
1. Use the `keboola-data-app` skill for guidance on building Keboola Data Apps
2. Create the app with pages: Malls Explorer, Stores Explorer, Brands Dashboard, GAP Analysis, Map View, Store History
3. Use Keboola Storage API to read data
4. Deploy via `deploy_data_app` MCP tool

**Key libraries for the Streamlit app:**
- `streamlit` - main framework
- `streamlit-keboola` or direct SAPI client - data access
- `folium` + `streamlit-folium` - map visualization
- `plotly` - charts and interactive visualizations
- `pandas` - data manipulation
- `openpyxl` - Excel export

**Performance: Server-side filtering (CRITICAL):**
Do NOT load 340,000 stores into a single `st.dataframe`. Use server-side filtering:
pass user filter inputs directly to Keboola Storage API queries to fetch only relevant rows.

**Favorite Filters / Saved Selections:**
Replicate the "Favorite Filters" feature by creating a `user_preferences` table in Keboola Storage
to store JSON filter configurations per user.

### Phase 5: Automation

**Goal:** Set up recurring data refresh.

**Steps:**
1. Create a Flow in Keboola that chains: Extract -> Transform -> Notify
2. Schedule for weekly or monthly execution
3. Use `create_conditional_flow` or `get_flows` / `modify_flow` MCP tools

---

## Important Notes

1. **Always read docs first** - Re-read architecture and plan docs at session start
2. **Staging first** - Use Keboola staging/dev environment before production
3. **No hardcoded values** - All config (URLs, tokens, table names) in `.env` or config files
4. **Test with CZ data first** - Czech Republic dataset is available; test everything with it before expanding to other countries
5. **API data format** - Shopingy API returns positional arrays (not named objects). Use column mappings from architecture doc.
6. **Save scripts** - All extraction/transformation scripts go in `scripts/` directory
7. **Troubleshooting scripts** - go in `.scratch/` directory
8. **Data files** - go in `data/` directory (gitignored)
9. **CSRF authentication** - Shopingy login requires CSRF token from login page GET before POST
10. **Paginate API calls** - Use 5,000 record batches to avoid server timeouts
11. **Unpivot brands data** - Convert wide country columns to long format during extraction
12. **Migrate saved selections** - Check `/api/helpers/tables/selections/` for user-saved filters that may need migration
13. **Mall floor plans** - These are external URLs; consider downloading to Keboola File Storage to prevent broken links
14. **Schema change detection** - In Phase 5, monitor row counts AND column counts to detect if Shopingy API schema changes (columns added/reordered in positional arrays)

## Directory Structure

```
Shopingy/
├── .env                          # Credentials (Shopingy + Keboola)
├── docs/
│   ├── 01-architecture.md        # Current Shopingy architecture
│   ├── 02-keboola-migration-plan.md  # Migration plan
│   └── 03-migration-instructions.md  # This file
├── scripts/
│   ├── extract_shopingy.py       # Data extraction script
│   └── upload_to_keboola.py      # Upload to Keboola Storage
├── data/
│   ├── raw/                      # Raw exports from Shopingy
│   └── processed/                # Cleaned CSVs for Keboola
├── app/                          # Streamlit Data App source
│   ├── app.py                    # Main Streamlit app
│   ├── pages/                    # Multi-page app pages
│   └── requirements.txt          # App dependencies
└── .scratch/                     # Temporary troubleshooting scripts
```
