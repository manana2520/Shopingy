"""Shopingy FastAPI backend - retail real estate data API."""

import logging
import math
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from config import validate_config
from data import (
    clear_cache,
    load_brands,
    load_brand_country_matrix,
    load_enum_categories,
    load_enum_cities,
    load_enum_outlettype,
    load_enum_sizes,
    load_malls,
    load_stores,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

validate_config()

app = FastAPI(title="Shopingy API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clean_value(v: Any) -> Any:
    """Convert NaN/inf to None for JSON serialization."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _df_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert DataFrame to list of dicts with NaN replaced by None."""
    records = df.where(df.notna(), other=None).to_dict(orient="records")
    return [{k: _clean_value(v) for k, v in row.items()} for row in records]


def _to_numeric_safe(series: pd.Series) -> pd.Series:
    """Convert a series to numeric, coercing errors to NaN."""
    return pd.to_numeric(series, errors="coerce")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/reload")
def reload_data() -> dict[str, str]:
    """Clear cached data and force reload on next request."""
    clear_cache()
    return {"status": "cache_cleared"}


@app.get("/api/kpis")
def get_kpis() -> dict[str, Any]:
    """Return aggregated KPI metrics."""
    malls = load_malls()
    stores = load_stores()
    brands = load_brands()

    total_malls = len(malls)
    total_stores = len(stores)
    total_brands = len(brands)
    total_cities = malls["city"].nunique()
    total_operators = malls["operator"].nunique()
    total_countries = malls["country"].nunique()

    return {
        "total_malls": int(total_malls),
        "total_stores": int(total_stores),
        "total_brands": int(total_brands),
        "total_cities": int(total_cities),
        "total_operators": int(total_operators),
        "total_countries": int(total_countries),
    }


@app.get("/api/malls")
def get_malls_list() -> list[dict[str, Any]]:
    """Return all malls with key metrics."""
    malls = load_malls().copy()
    numeric_cols = ["brands_count", "stores_count", "gla", "latitude", "longitude"]
    for col in numeric_cols:
        if col in malls.columns:
            malls[col] = _to_numeric_safe(malls[col])
    cols = [
        "id", "name", "brands_count", "stores_count", "gla", "type",
        "city", "zip", "country", "operator", "latitude", "longitude",
    ]
    existing_cols = [c for c in cols if c in malls.columns]
    return _df_to_records(malls[existing_cols])


@app.get("/api/malls/{mall_name}")
def get_mall_detail(mall_name: str) -> dict[str, Any]:
    """Return mall detail with its stores list."""
    malls = load_malls()
    mall_row = malls[malls["name"] == mall_name]
    if mall_row.empty:
        raise HTTPException(status_code=404, detail=f"Mall '{mall_name}' not found")

    mall_dict = _df_to_records(mall_row)[0]

    # Convert numeric fields
    for field in ("brands_count", "stores_count", "gla", "latitude", "longitude"):
        if field in mall_dict and mall_dict[field] is not None:
            try:
                mall_dict[field] = float(mall_dict[field])
            except (ValueError, TypeError):
                mall_dict[field] = None

    stores = load_stores()
    mall_stores = stores[stores["shopping_mall"] == mall_name]
    store_cols = [
        "id", "store_name", "store_type", "store_brands", "major_category",
        "store_tags", "store_sqm", "store_size", "opened_date", "closed_date",
    ]
    existing_cols = [c for c in store_cols if c in mall_stores.columns]
    mall_dict["stores"] = _df_to_records(mall_stores[existing_cols])

    return mall_dict


@app.get("/api/stores")
def get_stores_list(
    city: str | None = None,
    category: str | None = None,
    mall: str | None = None,
    store_type: str | None = None,
) -> list[dict[str, Any]]:
    """Return stores with optional filters."""
    stores = load_stores().copy()

    if city:
        stores = stores[stores["city"].str.lower() == city.lower()]
    if category:
        stores = stores[stores["major_category"].str.lower() == category.lower()]
    if mall:
        stores = stores[stores["shopping_mall"].str.lower() == mall.lower()]
    if store_type:
        stores = stores[stores["store_type"].str.lower() == store_type.lower()]

    cols = [
        "id", "store_name", "store_type", "store_brands", "major_category",
        "additional_categories", "store_tags", "shopping_mall", "mall_type",
        "city", "zip", "country", "store_sqm", "store_size", "opened_date",
        "closed_date", "latitude", "longitude",
    ]
    existing_cols = [c for c in cols if c in stores.columns]

    for col in ("latitude", "longitude", "store_sqm"):
        if col in stores.columns:
            stores[col] = _to_numeric_safe(stores[col])

    return _df_to_records(stores[existing_cols])


@app.get("/api/brands")
def get_brands_list() -> list[dict[str, Any]]:
    """Return all brands with total location counts from brand_country_matrix."""
    brands = load_brands().copy()
    matrix = load_brand_country_matrix()

    # Sum monobrand + multibrand per brand from the matrix
    matrix_agg = matrix.copy()
    matrix_agg["monobrand_stores"] = _to_numeric_safe(matrix_agg["monobrand_stores"])
    matrix_agg["multibrand_stores"] = _to_numeric_safe(matrix_agg["multibrand_stores"])
    brand_totals = matrix_agg.groupby("brand_name").agg(
        total_monobrand=("monobrand_stores", "sum"),
        total_multibrand=("multibrand_stores", "sum"),
    ).reset_index()
    brand_totals["total_locations"] = (
        brand_totals["total_monobrand"] + brand_totals["total_multibrand"]
    )

    result = brands[["brand_name", "category", "primary_category", "website"]].merge(
        brand_totals[["brand_name", "total_monobrand", "total_multibrand", "total_locations"]],
        on="brand_name",
        how="left",
    )
    result = result.fillna({"total_monobrand": 0, "total_multibrand": 0, "total_locations": 0})
    result = result.sort_values("total_locations", ascending=False)
    return _df_to_records(result)


@app.get("/api/brands/{brand_name}")
def get_brand_detail(brand_name: str) -> dict[str, Any]:
    """Return brand detail with list of malls where present."""
    brands = load_brands()
    brand_row = brands[brands["brand_name"] == brand_name]
    if brand_row.empty:
        raise HTTPException(status_code=404, detail=f"Brand '{brand_name}' not found")

    brand_dict = _df_to_records(
        brand_row[["brand_name", "category", "primary_category", "website", "brand_tags"]]
    )[0]

    # Find malls where this brand has stores
    stores = load_stores()
    brand_stores = stores[stores["store_name"] == brand_name]
    mall_names = brand_stores["shopping_mall"].unique().tolist()

    malls = load_malls()
    brand_malls = malls[malls["name"].isin(mall_names)]
    mall_cols = ["id", "name", "city", "country", "type"]
    existing_cols = [c for c in mall_cols if c in brand_malls.columns]
    brand_dict["malls"] = _df_to_records(brand_malls[existing_cols])
    brand_dict["total_mall_count"] = len(mall_names)

    # Country matrix for this brand
    matrix = load_brand_country_matrix()
    brand_matrix = matrix[matrix["brand_name"] == brand_name]
    brand_matrix = brand_matrix.copy()
    brand_matrix["monobrand_stores"] = _to_numeric_safe(brand_matrix["monobrand_stores"])
    brand_matrix["multibrand_stores"] = _to_numeric_safe(brand_matrix["multibrand_stores"])
    brand_dict["country_matrix"] = _df_to_records(brand_matrix)

    return brand_dict


@app.get("/api/enums")
def get_enums() -> dict[str, list[str]]:
    """Return all enum values for filter dropdowns."""
    categories = load_enum_categories()
    mall_types = load_enum_outlettype()
    sizes = load_enum_sizes()
    cities = load_enum_cities()

    def _values(df: pd.DataFrame) -> list[str]:
        col = df.columns[0]
        return sorted(df[col].dropna().astype(str).unique().tolist())

    return {
        "categories": _values(categories),
        "mall_types": _values(mall_types),
        "sizes": _values(sizes),
        "cities": _values(cities),
    }


@app.get("/api/gap")
def get_gap_analysis(
    malls: str = Query(..., description="Comma-separated mall names"),
) -> list[dict[str, Any]]:
    """Return GAP analysis matrix.

    For each brand, show which of the selected malls it is present in.
    Sorted by coverage_pct descending (brands in most selected malls first).
    """
    mall_names = [m.strip() for m in malls.split(",") if m.strip()]
    if not mall_names:
        raise HTTPException(status_code=400, detail="Provide at least one mall name")

    stores = load_stores()
    # Filter to selected malls
    selected = stores[stores["shopping_mall"].isin(mall_names)]

    # Build brand-mall presence matrix
    presence = selected.groupby(["store_name", "shopping_mall"]).size().reset_index(name="count")

    # Get unique brands and their categories
    brand_cats = selected[["store_name", "major_category"]].drop_duplicates()
    brand_cats = brand_cats.groupby("store_name")["major_category"].first().reset_index()

    results = []
    for _, row in brand_cats.iterrows():
        brand = row["store_name"]
        category = row["major_category"]
        brand_presence = presence[presence["store_name"] == brand]
        malls_present = set(brand_presence["shopping_mall"].tolist())

        mall_flags = {name: name in malls_present for name in mall_names}
        coverage = len(malls_present) / len(mall_names) if mall_names else 0

        results.append({
            "brand_name": brand,
            "category": category,
            "malls": mall_flags,
            "coverage_pct": round(coverage, 4),
            "present_in": len(malls_present),
            "total_selected": len(mall_names),
        })

    results.sort(key=lambda x: x["coverage_pct"], reverse=True)
    return results


@app.get("/api/heatmap")
def get_heatmap_data(
    category: str | None = None,
    brand: str | None = None,
    mall_type: str | None = None,
) -> list[dict[str, Any]]:
    """Return mall coordinates with metrics for map visualization."""
    malls = load_malls().copy()
    stores = load_stores()

    # Apply filters on stores first, then aggregate to malls
    filtered_stores = stores.copy()
    if category:
        filtered_stores = filtered_stores[
            filtered_stores["major_category"].str.lower() == category.lower()
        ]
    if brand:
        filtered_stores = filtered_stores[
            filtered_stores["store_name"].str.lower() == brand.lower()
        ]

    if mall_type:
        malls = malls[malls["type"].str.lower() == mall_type.lower()]

    # Count filtered stores per mall
    store_counts = (
        filtered_stores.groupby("shopping_mall")
        .size()
        .reset_index(name="filtered_store_count")
    )

    malls = malls.merge(
        store_counts, left_on="name", right_on="shopping_mall", how="left"
    )
    malls["filtered_store_count"] = malls["filtered_store_count"].fillna(0).astype(int)

    malls["latitude"] = _to_numeric_safe(malls["latitude"])
    malls["longitude"] = _to_numeric_safe(malls["longitude"])
    malls["gla"] = _to_numeric_safe(malls["gla"])
    malls["brands_count"] = _to_numeric_safe(malls["brands_count"])
    malls["stores_count"] = _to_numeric_safe(malls["stores_count"])

    # Only return malls with valid coordinates
    valid = malls.dropna(subset=["latitude", "longitude"])

    cols = [
        "id", "name", "latitude", "longitude", "gla", "brands_count",
        "stores_count", "type", "city", "country", "operator",
        "filtered_store_count",
    ]
    existing_cols = [c for c in cols if c in valid.columns]
    return _df_to_records(valid[existing_cols])


@app.get("/api/trends")
def get_trends() -> dict[str, list[dict[str, Any]]]:
    """Return monthly store openings and closings."""
    stores = load_stores().copy()

    # Parse dates
    stores["opened_date"] = pd.to_datetime(stores["opened_date"], errors="coerce")
    stores["closed_date"] = pd.to_datetime(stores["closed_date"], errors="coerce")

    # Monthly openings
    opened = stores.dropna(subset=["opened_date"]).copy()
    opened["month"] = opened["opened_date"].dt.to_period("M").astype(str)
    openings = opened.groupby("month").size().reset_index(name="count")
    openings = openings.sort_values("month")

    # Monthly closings
    closed = stores.dropna(subset=["closed_date"]).copy()
    closed["month"] = closed["closed_date"].dt.to_period("M").astype(str)
    closings = closed.groupby("month").size().reset_index(name="count")
    closings = closings.sort_values("month")

    return {
        "openings": _df_to_records(openings),
        "closings": _df_to_records(closings),
    }
