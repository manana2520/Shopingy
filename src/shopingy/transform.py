"""Data transformation - column mapping, type casting, brand unpivoting."""

import logging
from datetime import date

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column name definitions for each entity type
# ---------------------------------------------------------------------------

MALL_COLUMNS: list[str] = [
    "id", "name", "brands_count", "stores_count", "gla", "type",
    "city", "zip", "country", "www", "mall_plan", "operator",
    "last_update", "in_database_from", "website", "latitude", "longitude",
]

STORE_COLUMNS: list[str] = [
    "store_status", "store_name", "store_type", "store_brands",
    "major_category", "additional_categories", "store_tags",
    "shopping_mall", "mall_type", "city", "zip", "country",
    "store_sqm", "store_size", "street_mall", "www",
    "closed_date", "opened_date", "created_on", "updated_on",
]

STORE_INDEX_COLUMNS: list[str] = [
    "id", "is_favorite", "store_name", "total_locations", "store_type",
    "major_category", "additional_categories", "store_tags",
    "city", "zip", "country",
]

BRAND_BASE_COLUMNS: list[str] = [
    "brand_name", "category", "website", "brand_tags",
]

BRAND_COUNTRIES: list[str] = [
    "Austria", "Belgium", "Bulgaria", "Canada", "Croatia", "Cyprus",
    "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany",
    "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania",
    "Mexico", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal",
    "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Spain",
    "Sweden", "Switzerland", "UAE", "Ukraine", "United Kingdom", "USA",
]

# Store row has a checkbox at index 0 that is dropped
STORE_CHECKBOX_INDEX: int = 0


# ---------------------------------------------------------------------------
# Mapping functions: positional list -> named dict
# ---------------------------------------------------------------------------


def map_malls(row: list) -> dict:
    """Map a positional mall row (17 columns) to a named dict."""
    logger.debug("Mapping mall row with %d columns", len(row))
    return dict(zip(MALL_COLUMNS, row))


def map_stores(row: list) -> dict:
    """Map a positional store row (21 columns) to a named dict.

    Drops the checkbox column at index 0; returns 20 keys.
    """
    logger.debug("Mapping store row with %d columns", len(row))
    values = row[STORE_CHECKBOX_INDEX + 1:]
    return dict(zip(STORE_COLUMNS, values))


def map_store_index(row: list) -> dict:
    """Map a positional store-index row (11 columns) to a named dict."""
    logger.debug("Mapping store index row with %d columns", len(row))
    return dict(zip(STORE_INDEX_COLUMNS, row))


def map_brands(row: list) -> dict:
    """Map a wide 78-column brand row to a named dict.

    Layout: [0]=checkbox (dropped), [1-4]=base fields, [5-76]=36 country
    pairs (monobrand, multibrand), [77]=primary_category.
    Returns 77 keys: 5 base + 36*2 country columns.
    """
    logger.debug("Mapping brand row with %d columns", len(row))
    result: dict = {}

    # Base fields (indices 1-4, skipping checkbox at 0)
    for i, col_name in enumerate(BRAND_BASE_COLUMNS):
        result[col_name] = row[i + 1]

    # Country pairs starting at index 5
    country_start_index = 5
    for i, country in enumerate(BRAND_COUNTRIES):
        mono_idx = country_start_index + i * 2
        multi_idx = mono_idx + 1
        result[f"monobrand_{country}"] = row[mono_idx]
        result[f"multibrand_{country}"] = row[multi_idx]

    # Primary category at the last index (77)
    primary_category_index = 77
    result["primary_category"] = row[primary_category_index]

    return result


# ---------------------------------------------------------------------------
# Type casting helpers
# ---------------------------------------------------------------------------


def cast_numeric(value: str) -> int | float | None:
    """Convert a string value to int, float, or None.

    Special cases:
    - Empty string returns None
    - A bare dash "-" (common in brand count tables) returns 0
    """
    if value == "":
        return None
    if value == "-":
        return 0

    try:
        # Try int first
        int_val = int(value)
        # Verify it was truly an integer string (no decimal point)
        if "." not in value:
            return int_val
    except ValueError:
        pass

    try:
        return float(value)
    except ValueError:
        logger.warning("Could not cast '%s' to numeric", value)
        return None


def cast_date(value: str | None) -> str | None:
    """Validate and return a date string in ISO format, or None.

    Returns the value as-is if it parses as a valid ISO date.
    Returns None for empty strings or None input.
    """
    if value is None or value == "":
        return None

    try:
        date.fromisoformat(value)
        return value
    except ValueError:
        logger.warning("Invalid date format: '%s'", value)
        return None


# ---------------------------------------------------------------------------
# Brand unpivoting: wide -> long format
# ---------------------------------------------------------------------------


def unpivot_brands(brand_dict: dict) -> list[dict]:
    """Convert a mapped brand dict into a list of per-country rows.

    Takes the output of map_brands and returns 36 dicts (one per country),
    each with: brand_name, country, monobrand_stores, multibrand_stores.
    Numeric values are cast through cast_numeric (dash -> 0, empty -> None
    treated as 0).
    """
    brand_name = brand_dict["brand_name"]
    rows: list[dict] = []

    for country in BRAND_COUNTRIES:
        mono_raw = brand_dict.get(f"monobrand_{country}", "0")
        multi_raw = brand_dict.get(f"multibrand_{country}", "0")

        mono_val = cast_numeric(str(mono_raw))
        multi_val = cast_numeric(str(multi_raw))

        # Treat None as 0 for store counts
        rows.append({
            "brand_name": brand_name,
            "country": country,
            "monobrand_stores": mono_val if mono_val is not None else 0,
            "multibrand_stores": multi_val if multi_val is not None else 0,
        })

    logger.debug("Unpivoted brand '%s' into %d rows", brand_name, len(rows))
    return rows
