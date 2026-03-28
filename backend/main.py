"""Shopingy FastAPI backend - retail real estate data API."""

import logging
import math
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_kbc_token, get_kbc_url, validate_config
from backend.data import (
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

# ---------------------------------------------------------------------------
# Kai AI chatbot proxy state
# ---------------------------------------------------------------------------
_kai_url: str | None = None
_async_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app_instance):
    global _async_client
    _async_client = httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=30.0))
    try:
        await _discover_kai_url()
    except Exception as e:
        logger.warning("Kai pre-warm failed: %s", e)
    yield
    if _async_client:
        await _async_client.aclose()


app = FastAPI(title="Shopingy API", lifespan=lifespan)
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
# Kai AI chatbot helpers
# ---------------------------------------------------------------------------


async def _discover_kai_url() -> str:
    global _kai_url
    if _kai_url:
        return _kai_url
    token = get_kbc_token()
    url = get_kbc_url()
    if not token or not url:
        raise HTTPException(500, "KBC_TOKEN/KBC_URL not configured")
    base = url.split("/v2/")[0] if "/v2/" in url else url
    resp = await _async_client.get(
        f"{base}/v2/storage",
        headers={"x-storageapi-token": token},
        timeout=30.0,
    )
    data = resp.json()
    services = data.get("services", [])
    svc = next((s for s in services if s["id"] == "kai-assistant"), None)
    if not svc:
        raise HTTPException(500, "kai-assistant service not found")
    _kai_url = svc["url"].rstrip("/")
    logger.info("Kai service discovered: %s", _kai_url)
    return _kai_url


def _kai_headers() -> dict:
    import os
    # Prefer SHOPINGY_KAI_TOKEN (dedicated Kai-enabled token), fall back to KBC_TOKEN
    token = os.environ.get("SHOPINGY_KAI_TOKEN", "").strip() or os.environ.get("KAI_TOKEN", "").strip() or get_kbc_token()
    logger.info("Kai auth: using %s", "KAI_TOKEN" if os.environ.get("KAI_TOKEN", "").strip() else "KBC_TOKEN")
    return {
        "x-storageapi-token": token,
        "content-type": "application/json",
    }


# ---------------------------------------------------------------------------
# Kai AI chatbot endpoints
# ---------------------------------------------------------------------------


@app.websocket("/api/chat/ws")
async def kai_ws(websocket: WebSocket):
    """WebSocket proxy to Kai AI. Client sends JSON, receives SSE chunks."""
    await websocket.accept()
    try:
        body = await websocket.receive_json()
    except WebSocketDisconnect:
        return

    kai_url = await _discover_kai_url()
    headers = _kai_headers()
    logger.info("Kai WS proxy: POST %s/api/chat", kai_url)

    resp = None
    try:
        req = _async_client.build_request("POST", f"{kai_url}/api/chat", headers=headers, json=body)
        resp = await _async_client.send(req, stream=True)

        if resp.status_code != 200:
            error_body = await resp.aread()
            await websocket.send_json({"error": error_body.decode("utf-8", errors="replace")[:500]})
            await websocket.close()
            await resp.aclose()
            return

        raw = b""
        async for chunk in resp.aiter_bytes():
            raw += chunk
            while b"\n\n" in raw:
                event_bytes, raw = raw.split(b"\n\n", 1)
                event_str = event_bytes.decode("utf-8", errors="replace").strip()
                if event_str:
                    await websocket.send_text(event_str)

        await websocket.send_json({"done": True})
        await websocket.close()
    except WebSocketDisconnect:
        logger.info("Kai WS: client disconnected")
    except Exception as exc:
        logger.exception("Kai WS error: %s", exc)
        try:
            await websocket.send_json({"error": str(exc)})
            await websocket.close()
        except Exception:
            pass
    finally:
        try:
            if resp:
                await resp.aclose()
        except Exception:
            pass


@app.post("/api/chat")
async def kai_chat_http(request: Request):
    """HTTP fallback for chat (non-streaming)."""
    kai_url = await _discover_kai_url()
    headers = _kai_headers()
    body = await request.json()
    resp = await _async_client.post(f"{kai_url}/api/chat", headers=headers, json=body, timeout=120.0)
    return Response(content=resp.content, status_code=resp.status_code, media_type="text/event-stream")


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


@app.get("/api/health-scores")
def get_health_scores() -> list[dict[str, Any]]:
    """Mall health: openings vs closings, churn rate, net change."""
    stores_df = load_stores().copy()
    malls_df = load_malls().copy()

    # Parse dates
    stores_df["has_close"] = (
        stores_df["closed_date"].notna()
        & (stores_df["closed_date"] != "")
        & (stores_df["closed_date"] != "-0001-11-30")
    )
    stores_df["has_open"] = (
        stores_df["opened_date"].notna()
        & (stores_df["opened_date"] != "")
        & (stores_df["opened_date"] != "-0001-11-30")
    )

    churn = (
        stores_df.groupby("shopping_mall")
        .agg(total=("id", "count"), closings=("has_close", "sum"), openings=("has_open", "sum"))
        .reset_index()
    )

    churn["churn_rate"] = (churn["closings"] / churn["total"]).round(3)
    churn["net_change"] = churn["openings"] - churn["closings"]
    churn["status"] = churn["net_change"].apply(
        lambda x: "growing" if x > 0 else ("declining" if x < 0 else "stable")
    )

    # Add mall metadata
    mall_info = malls_df[["name", "type", "city", "stores_count", "brands_count"]].copy()
    result = churn.merge(mall_info, left_on="shopping_mall", right_on="name", how="left")

    return _df_to_records(result.rename(columns={"shopping_mall": "mall_name"}))


@app.get("/api/proximity")
def get_proximity(mall: str = Query(...), radius_km: float = 10.0):
    """Find malls within a radius of the selected mall using Haversine formula."""

    def haversine(lat1, lon1, lat2, lon2):
        R = 6371  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        return R * 2 * math.asin(math.sqrt(a))

    malls_df = load_malls().copy()

    # Find center mall
    center = malls_df[malls_df["name"] == mall]
    if center.empty:
        raise HTTPException(404, f"Mall '{mall}' not found")

    center_row = center.iloc[0]
    center_lat = float(center_row.get("latitude", 0) or 0)
    center_lng = float(center_row.get("longitude", 0) or 0)

    if center_lat == 0 or center_lng == 0:
        raise HTTPException(400, f"Mall '{mall}' has no GPS coordinates")

    # Compute distances to all other malls
    nearby = []
    for _, row in malls_df.iterrows():
        if row["name"] == mall:
            continue
        lat = float(row.get("latitude", 0) or 0)
        lng = float(row.get("longitude", 0) or 0)
        if lat == 0 or lng == 0:
            continue
        dist = haversine(center_lat, center_lng, lat, lng)
        if dist <= radius_km:
            nearby.append({
                "name": row["name"],
                "distance_km": round(dist, 1),
                "type": row.get("type", ""),
                "city": row.get("city", ""),
                "stores_count": int(row.get("stores_count", 0) or 0),
                "brands_count": int(row.get("brands_count", 0) or 0),
                "gla": row.get("gla", None),
                "operator": row.get("operator", ""),
                "latitude": lat,
                "longitude": lng,
            })

    nearby.sort(key=lambda x: x["distance_km"])

    return {
        "center": {
            "name": mall,
            "latitude": center_lat,
            "longitude": center_lng,
            "type": str(center_row.get("type", "")),
            "city": str(center_row.get("city", "")),
            "stores_count": int(center_row.get("stores_count", 0) or 0),
            "brands_count": int(center_row.get("brands_count", 0) or 0),
        },
        "radius_km": radius_km,
        "total_nearby": len(nearby),
        "total_stores_in_catchment": sum(m["stores_count"] for m in nearby),
        "nearby": nearby,
    }


@app.get("/api/ecosystem")
def get_ecosystem(
    brand: str | None = None,
    min_shared: int = 3,
) -> list[dict[str, Any]]:
    """Brand co-occurrence: pairs of brands that share malls."""
    stores_df = load_stores().copy()

    # Build brand -> set of malls mapping
    brand_malls = stores_df.groupby("store_name")["shopping_mall"].apply(set).to_dict()

    # Filter to brands in 5+ malls
    frequent = {b: m for b, m in brand_malls.items() if len(m) >= 5}

    if brand:
        # Show ecosystem for one specific brand
        if brand not in frequent:
            return []
        target_malls = frequent[brand]
        pairs: list[dict[str, Any]] = []
        for other_brand, other_malls in frequent.items():
            if other_brand == brand:
                continue
            shared = len(target_malls & other_malls)
            if shared >= min_shared:
                pairs.append({
                    "brand_a": brand,
                    "brand_b": other_brand,
                    "shared_malls": int(shared),
                    "strength": round(shared / len(target_malls), 3),
                })
        pairs.sort(key=lambda x: -x["shared_malls"])
        return pairs[:50]
    else:
        # Return top co-occurring pairs overall
        brands_list = sorted(frequent.keys())
        pairs = []
        for i in range(len(brands_list)):
            for j in range(i + 1, len(brands_list)):
                shared = len(frequent[brands_list[i]] & frequent[brands_list[j]])
                if shared >= min_shared:
                    pairs.append({
                        "brand_a": brands_list[i],
                        "brand_b": brands_list[j],
                        "shared_malls": int(shared),
                    })
        pairs.sort(key=lambda x: -x["shared_malls"])
        return pairs[:100]


@app.get("/api/disruptors")
def get_disruptors(
    since: str = "2024-01-01",
    category: str | None = None,
) -> list[dict[str, Any]]:
    """Brand winners & losers: openings vs closings since a date."""
    stores_df = load_stores().copy()

    stores_df["open_date"] = pd.to_datetime(stores_df["opened_date"], errors="coerce")
    stores_df["close_date"] = pd.to_datetime(stores_df["closed_date"], errors="coerce")
    since_dt = pd.to_datetime(since)

    if category:
        stores_df = stores_df[stores_df["major_category"] == category]

    openings = (
        stores_df[stores_df["open_date"] >= since_dt]
        .groupby("store_name")
        .size()
        .reset_index(name="openings")
    )
    closings = (
        stores_df[stores_df["close_date"] >= since_dt]
        .groupby("store_name")
        .size()
        .reset_index(name="closings")
    )

    result = openings.merge(closings, on="store_name", how="outer").fillna(0)
    result["openings"] = result["openings"].astype(int)
    result["closings"] = result["closings"].astype(int)
    result["net_change"] = result["openings"] - result["closings"]

    # Add category info
    cat_map = stores_df.groupby("store_name")["major_category"].first()
    result["category"] = result["store_name"].map(cat_map).fillna("")

    result = result.sort_values("net_change", ascending=False)

    return _df_to_records(result.rename(columns={"store_name": "brand_name"}))
