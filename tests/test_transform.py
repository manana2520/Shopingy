"""Tests for shopingy.transform -- data transformation module.

These tests define the expected API for transforming raw Shopingy API
responses (positional arrays) into named-column dicts with proper types.

Tests are skipped gracefully until the transform module is implemented.
"""

import pytest

# ---------------------------------------------------------------------------
# Guarded import -- skip all tests until implementation exists
# ---------------------------------------------------------------------------
try:
    from shopingy.transform import (
        cast_date,
        cast_numeric,
        map_brands,
        map_malls,
        map_store_index,
        map_stores,
        unpivot_brands,
    )

    HAS_TRANSFORM = True
except (NotImplementedError, ImportError):
    HAS_TRANSFORM = False

pytestmark = pytest.mark.skipif(
    not HAS_TRANSFORM, reason="Transform module not yet implemented"
)

# ---------------------------------------------------------------------------
# Constants -- the 36 countries in the brands pivot table (fixed order)
# ---------------------------------------------------------------------------
BRAND_COUNTRIES = [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Canada",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Mexico",
    "Montenegro",
    "Netherlands",
    "Norway",
    "Poland",
    "Portugal",
    "Romania",
    "Russia",
    "Serbia",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
    "Switzerland",
    "UAE",
    "Ukraine",
    "United Kingdom",
    "USA",
]

# ---------------------------------------------------------------------------
# Sample data fixtures
# ---------------------------------------------------------------------------

SAMPLE_MALL_ROW = [
    "42",           # 0  id
    "Palladium",    # 1  name
    "120",          # 2  brands_count
    "85",           # 3  stores_count
    "41000",        # 4  gla
    "Shopping Mall", # 5  type
    "Prague",       # 6  city
    "11000",        # 7  zip
    "Czech Republic", # 8  country
    "https://palladiumpraha.cz", # 9  www
    "plan.pdf",     # 10 mall_plan
    "ECE",          # 11 operator
    "2024-06-15",   # 12 last_update
    "2021-01-10",   # 13 in_database_from
    "https://palladiumpraha.cz", # 14 website
    "50.0879",      # 15 latitude
    "14.4285",      # 16 longitude
]

SAMPLE_STORE_ROW = [
    "",             # 0  checkbox (unused)
    "open",         # 1  store_status
    "H&M",          # 2  store_name
    "Fashion",      # 3  store_type
    "H&M",          # 4  store_brands
    "Clothing",     # 5  major_category
    "Accessories",  # 6  additional_categories
    "fast-fashion", # 7  store_tags
    "Palladium",    # 8  shopping_mall
    "Shopping Mall", # 9  mall_type
    "Prague",       # 10 city
    "11000",        # 11 zip
    "Czech Republic", # 12 country
    "850",          # 13 store_sqm
    "Large",        # 14 store_size
    "No",           # 15 street_mall
    "https://hm.com", # 16 www
    "",             # 17 closed_date
    "2019-03-01",   # 18 opened_date
    "2019-02-15",   # 19 created_on
    "2024-06-10",   # 20 updated_on
]

SAMPLE_STORE_INDEX_ROW = [
    "1001",         # 0  id
    "0",            # 1  is_favorite
    "Zara",         # 2  store_name
    "35",           # 3  total_locations
    "Fashion",      # 4  store_type
    "Clothing",     # 5  major_category
    "Shoes",        # 6  additional_categories
    "premium",      # 7  store_tags
    "Prague",       # 8  city
    "11000",        # 9  zip
    "Czech Republic", # 10 country
]


def _make_brand_row(
    brand_name: str = "Nike",
    category: str = "Sportswear",
    website: str = "https://nike.com",
    tags: str = "sport,running",
    primary_category: str = "Sports",
    country_values: dict | None = None,
) -> list[str]:
    """Build a 78-element brand row with sensible defaults.

    country_values maps country name -> (monobrand, multibrand) tuple.
    Missing countries default to ("-", "-").
    """
    if country_values is None:
        country_values = {}

    row: list[str] = ["", brand_name, category, website, tags]
    for country in BRAND_COUNTRIES:
        mono, multi = country_values.get(country, ("-", "-"))
        row.append(str(mono))
        row.append(str(multi))
    row.append(primary_category)

    assert len(row) == 78, f"Expected 78 columns, got {len(row)}"
    return row


SAMPLE_BRAND_ROW = _make_brand_row(
    brand_name="Nike",
    category="Sportswear",
    website="https://nike.com",
    tags="sport,running",
    primary_category="Sports",
    country_values={
        "Czech Republic": (5, 3),
        "Germany": (12, 8),
        "Poland": (0, 1),
    },
)


# ===================================================================
# Tests: positional-to-named column mapping
# ===================================================================


class TestMapMalls:
    """map_malls: convert a positional mall row to a named dict."""

    def test_mall_positional_to_named_columns(self) -> None:
        result = map_malls(SAMPLE_MALL_ROW)

        assert isinstance(result, dict)
        assert result["id"] == "42"
        assert result["name"] == "Palladium"
        assert result["brands_count"] == "120"
        assert result["stores_count"] == "85"
        assert result["gla"] == "41000"
        assert result["type"] == "Shopping Mall"
        assert result["city"] == "Prague"
        assert result["zip"] == "11000"
        assert result["country"] == "Czech Republic"
        assert result["www"] == "https://palladiumpraha.cz"
        assert result["mall_plan"] == "plan.pdf"
        assert result["operator"] == "ECE"
        assert result["last_update"] == "2024-06-15"
        assert result["in_database_from"] == "2021-01-10"
        assert result["website"] == "https://palladiumpraha.cz"
        assert result["latitude"] == "50.0879"
        assert result["longitude"] == "14.4285"

    def test_mall_result_has_exactly_17_keys(self) -> None:
        result = map_malls(SAMPLE_MALL_ROW)
        assert len(result) == 17


class TestMapStores:
    """map_stores: convert a positional store row to a named dict."""

    def test_store_positional_to_named_columns(self) -> None:
        result = map_stores(SAMPLE_STORE_ROW)

        assert isinstance(result, dict)
        assert result["store_status"] == "open"
        assert result["store_name"] == "H&M"
        assert result["store_type"] == "Fashion"
        assert result["store_brands"] == "H&M"
        assert result["major_category"] == "Clothing"
        assert result["additional_categories"] == "Accessories"
        assert result["store_tags"] == "fast-fashion"
        assert result["shopping_mall"] == "Palladium"
        assert result["mall_type"] == "Shopping Mall"
        assert result["city"] == "Prague"
        assert result["zip"] == "11000"
        assert result["country"] == "Czech Republic"
        assert result["store_sqm"] == "850"
        assert result["store_size"] == "Large"
        assert result["street_mall"] == "No"
        assert result["www"] == "https://hm.com"
        assert result["closed_date"] == ""
        assert result["opened_date"] == "2019-03-01"
        assert result["created_on"] == "2019-02-15"
        assert result["updated_on"] == "2024-06-10"

    def test_store_result_has_exactly_20_keys(self) -> None:
        """Store mapping should drop the checkbox column (index 0)."""
        result = map_stores(SAMPLE_STORE_ROW)
        assert len(result) == 20


class TestMapStoreIndex:
    """map_store_index: convert a positional store-index row to a named dict."""

    def test_store_index_positional_to_named_columns(self) -> None:
        result = map_store_index(SAMPLE_STORE_INDEX_ROW)

        assert isinstance(result, dict)
        assert result["id"] == "1001"
        assert result["is_favorite"] == "0"
        assert result["store_name"] == "Zara"
        assert result["total_locations"] == "35"
        assert result["store_type"] == "Fashion"
        assert result["major_category"] == "Clothing"
        assert result["additional_categories"] == "Shoes"
        assert result["store_tags"] == "premium"
        assert result["city"] == "Prague"
        assert result["zip"] == "11000"
        assert result["country"] == "Czech Republic"

    def test_store_index_result_has_exactly_11_keys(self) -> None:
        result = map_store_index(SAMPLE_STORE_INDEX_ROW)
        assert len(result) == 11


class TestMapBrands:
    """map_brands: convert a wide 78-column brand row to a named dict."""

    def test_brand_positional_to_named_columns(self) -> None:
        result = map_brands(SAMPLE_BRAND_ROW)

        assert isinstance(result, dict)
        assert result["brand_name"] == "Nike"
        assert result["category"] == "Sportswear"
        assert result["website"] == "https://nike.com"
        assert result["brand_tags"] == "sport,running"
        assert result["primary_category"] == "Sports"

    def test_brand_has_country_columns(self) -> None:
        """Each country produces two keys: monobrand_<country> and multibrand_<country>."""
        result = map_brands(SAMPLE_BRAND_ROW)
        for country in BRAND_COUNTRIES:
            key_mono = f"monobrand_{country}"
            key_multi = f"multibrand_{country}"
            assert key_mono in result, f"Missing key: {key_mono}"
            assert key_multi in result, f"Missing key: {key_multi}"

    def test_brand_result_has_expected_key_count(self) -> None:
        """5 base fields + 36*2 country fields = 77 keys."""
        result = map_brands(SAMPLE_BRAND_ROW)
        assert len(result) == 77


# ===================================================================
# Tests: type casting
# ===================================================================


class TestCastNumeric:
    """cast_numeric: convert string values to int or float."""

    def test_integer_string(self) -> None:
        assert cast_numeric("12500") == 12500

    def test_zero_string(self) -> None:
        assert cast_numeric("0") == 0

    def test_empty_string_returns_none(self) -> None:
        assert cast_numeric("") is None

    def test_float_string(self) -> None:
        result = cast_numeric("50.0833")
        assert result == pytest.approx(50.0833)

    def test_negative_number(self) -> None:
        assert cast_numeric("-5") == -5

    def test_dash_returns_zero(self) -> None:
        """A bare dash '-' (used in brand tables) should become 0."""
        assert cast_numeric("-") == 0


class TestCastDate:
    """cast_date: normalize date strings to ISO format."""

    def test_valid_date(self) -> None:
        result = cast_date("2024-01-15")
        assert result is not None
        assert "2024-01-15" in result

    def test_empty_string_returns_none(self) -> None:
        assert cast_date("") is None

    def test_none_returns_none(self) -> None:
        assert cast_date(None) is None


# ===================================================================
# Tests: dash-to-zero and empty-to-none conversions
# ===================================================================


class TestDashToZeroInBrandCounts:
    """In brand rows, '-' values in country columns should become 0."""

    def test_dash_becomes_zero_after_mapping(self) -> None:
        row = _make_brand_row(country_values={})  # all dashes
        result = map_brands(row)
        # After mapping, country values should still be raw strings.
        # cast_numeric is used separately to convert them.
        assert cast_numeric(result["monobrand_Austria"]) == 0
        assert cast_numeric(result["multibrand_Austria"]) == 0


class TestEmptyStringToNone:
    """Empty strings should become None for optional text fields via cast helpers."""

    def test_cast_numeric_empty(self) -> None:
        assert cast_numeric("") is None

    def test_cast_date_empty(self) -> None:
        assert cast_date("") is None


# ===================================================================
# Tests: brand unpivoting (wide -> long)
# ===================================================================


class TestUnpivotBrands:
    """unpivot_brands: convert wide brand dicts into long-format rows."""

    def _mapped_brand(self, **kwargs) -> dict:
        """Helper: create a mapped brand dict."""
        row = _make_brand_row(**kwargs)
        return map_brands(row)

    def test_single_brand_produces_36_rows(self) -> None:
        brand = self._mapped_brand()
        rows = unpivot_brands(brand)
        assert len(rows) == 36

    def test_unpivot_row_schema(self) -> None:
        """Each unpivoted row must have exactly these keys."""
        brand = self._mapped_brand()
        rows = unpivot_brands(brand)
        expected_keys = {
            "brand_name",
            "country",
            "monobrand_stores",
            "multibrand_stores",
        }
        for row in rows:
            assert set(row.keys()) >= expected_keys

    def test_unpivot_preserves_nonzero_counts(self) -> None:
        brand = self._mapped_brand(
            brand_name="Adidas",
            country_values={
                "Czech Republic": (5, 3),
            },
        )
        rows = unpivot_brands(brand)
        cz_row = next(r for r in rows if r["country"] == "Czech Republic")
        assert cz_row["monobrand_stores"] == 5
        assert cz_row["multibrand_stores"] == 3
        assert cz_row["brand_name"] == "Adidas"

    def test_unpivot_total_row_count_multiple_brands(self) -> None:
        """3 brands x 36 countries = 108 rows."""
        brands = [
            self._mapped_brand(brand_name="Nike"),
            self._mapped_brand(brand_name="Adidas"),
            self._mapped_brand(brand_name="Puma"),
        ]
        all_rows: list[dict] = []
        for brand in brands:
            all_rows.extend(unpivot_brands(brand))
        assert len(all_rows) == 108

    def test_unpivot_zero_and_dash_countries_included(self) -> None:
        """Even countries with zero/dash counts should appear in output."""
        brand = self._mapped_brand(
            country_values={"Germany": (12, 8)},
        )
        rows = unpivot_brands(brand)
        countries_in_rows = {r["country"] for r in rows}
        assert countries_in_rows == set(BRAND_COUNTRIES)
