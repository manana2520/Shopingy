"""Full extraction pipeline: authenticate, fetch all data, transform, save CSVs.

Usage:
    .venv/bin/python scripts/extract_shopingy.py
"""

import csv
import json
import logging
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from shopingy.api import (
    ALL_ENUM_NAMES,
    ENDPOINT_BRANDS,
    ENDPOINT_MALLS,
    ENDPOINT_SHOPS,
    ENDPOINT_UNIQUE_SHOPS,
    fetch_all_enums,
    fetch_all_records,
)
from shopingy.auth import get_authenticated_session
from shopingy.config import get_settings
from shopingy.transform import (
    BRAND_COUNTRIES,
    cast_numeric,
    map_brands,
    map_malls,
    map_store_index,
    unpivot_brands,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

# Real API store columns (23 columns) -- different from test fixture
STORE_API_COLUMNS = [
    "id", "is_favorite", "store_name", "store_type", "store_brands",
    "major_category", "additional_categories", "store_tags",
    "shopping_mall", "mall_type", "city", "zip", "country",
    "store_sqm", "store_size", "street_mall", "www",
    "closed_date", "opened_date", "created_on", "updated_on",
    "latitude", "longitude",
]


def save_raw_json(data: object, filename: str) -> Path:
    """Save raw API data as JSON."""
    path = RAW_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info("Saved raw JSON: %s", path)
    return path


def save_csv(rows: list[dict], filename: str) -> Path:
    """Save list of dicts as CSV."""
    if not rows:
        logger.warning("No rows to save for %s", filename)
        return PROCESSED_DIR / filename

    path = PROCESSED_DIR / filename
    fieldnames = list(rows[0].keys())
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    logger.info("Saved CSV: %s (%d rows, %d columns)", path, len(rows), len(fieldnames))
    return path


def map_store_api_row(row: list) -> dict:
    """Map a real 23-column store API row to a named dict."""
    return dict(zip(STORE_API_COLUMNS, row))


def main() -> None:
    """Run the full extraction pipeline."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    settings = get_settings()
    logger.info("Starting extraction pipeline")

    # Step 1: Authenticate
    session = get_authenticated_session(settings)
    logger.info("Authentication successful")

    try:
        # Step 2: Extract enums
        logger.info("--- Extracting enums ---")
        all_enums = fetch_all_enums(session)
        save_raw_json(all_enums, "enums.json")

        for enum_name, values in all_enums.items():
            rows = [{"value": v} for v in values]
            save_csv(rows, f"enum_{enum_name}.csv")

        # Step 3: Extract malls
        logger.info("--- Extracting malls ---")
        mall_rows_raw, mall_total = fetch_all_records(session, ENDPOINT_MALLS)
        save_raw_json(mall_rows_raw, "malls_raw.json")
        mall_dicts = [map_malls(row) for row in mall_rows_raw]
        save_csv(mall_dicts, "malls.csv")
        logger.info("Malls: %d extracted (expected ~325)", len(mall_dicts))

        # Step 4: Extract stores
        logger.info("--- Extracting stores ---")
        store_rows_raw, store_total = fetch_all_records(session, ENDPOINT_SHOPS)
        save_raw_json(store_rows_raw, "stores_raw.json")
        store_dicts = [map_store_api_row(row) for row in store_rows_raw]
        save_csv(store_dicts, "stores.csv")
        logger.info("Stores: %d extracted (expected ~15509)", len(store_dicts))

        # Step 5: Extract brands
        logger.info("--- Extracting brands ---")
        brand_rows_raw, brand_total = fetch_all_records(session, ENDPOINT_BRANDS)
        save_raw_json(brand_rows_raw, "brands_raw.json")
        brand_dicts = [map_brands(row) for row in brand_rows_raw]
        save_csv(brand_dicts, "brands.csv")
        logger.info("Brands: %d extracted (expected ~1340)", len(brand_dicts))

        # Step 5b: Unpivot brands to long format
        logger.info("--- Unpivoting brands ---")
        brand_long_rows = []
        for brand in brand_dicts:
            brand_long_rows.extend(unpivot_brands(brand))
        save_csv(brand_long_rows, "brand_country_matrix.csv")
        logger.info("Brand country matrix: %d rows", len(brand_long_rows))

        # Step 6: Extract store index (unique shops)
        logger.info("--- Extracting store index ---")
        si_rows_raw, si_total = fetch_all_records(session, ENDPOINT_UNIQUE_SHOPS)
        save_raw_json(si_rows_raw, "store_index_raw.json")
        si_dicts = [map_store_index(row) for row in si_rows_raw]
        save_csv(si_dicts, "store_index.csv")
        logger.info("Store index: %d extracted (expected ~4419)", len(si_dicts))

        # Summary
        logger.info("=== Extraction Complete ===")
        logger.info("  Malls: %d", len(mall_dicts))
        logger.info("  Stores: %d", len(store_dicts))
        logger.info("  Brands: %d", len(brand_dicts))
        logger.info("  Brand country matrix: %d", len(brand_long_rows))
        logger.info("  Store index: %d", len(si_dicts))
        logger.info("  Enums: %d endpoints", len(all_enums))

    finally:
        session.close()


if __name__ == "__main__":
    main()
