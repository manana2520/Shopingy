"""Post-load data quality checks for Shopingy data in Keboola.

These tests run against data already loaded in Keboola Storage and verify
referential integrity, value constraints, uniqueness, and expected row counts.
They query the Keboola Storage API directly using httpx.
"""

import csv
import io
import os
import time
from typing import Generator

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv()

# These tests require data to be loaded in Keboola first
pytestmark = [
    pytest.mark.integration,
    pytest.mark.slow,
]

KEBOOLA_STACK_URL: str = os.environ["KEBOOLA_STACK_URL"]
KEBOOLA_MASTER_TOKEN: str = os.environ["KEBOOLA_MASTER_TOKEN"]
STORAGE_API_BASE: str = f"{KEBOOLA_STACK_URL}/v2/storage"

POLL_INTERVAL = 2
POLL_TIMEOUT = 120


@pytest.fixture(scope="module")
def keboola_client() -> Generator[httpx.Client, None, None]:
    """Create an httpx.Client with the Keboola Storage API token header."""
    client = httpx.Client(
        base_url=STORAGE_API_BASE,
        headers={"X-StorageApi-Token": KEBOOLA_MASTER_TOKEN},
        timeout=120.0,
    )
    yield client
    client.close()


def get_table_metadata(client: httpx.Client, table_id: str) -> dict:
    """Fetch table metadata (row count, columns, etc.) from Keboola Storage API."""
    response = client.get(f"/tables/{table_id}")
    if response.status_code == 404:
        pytest.skip(f"Table {table_id} does not exist yet (data not loaded)")
    response.raise_for_status()
    return response.json()


def get_table_data(client: httpx.Client, table_id: str) -> list[dict[str, str]]:
    """Export table data via async export job on GCP Keboola.

    Steps: POST export-async -> poll job -> download result file as CSV.
    """
    # Start async export
    response = client.post(f"/tables/{table_id}/export-async")
    if response.status_code == 404:
        pytest.skip(f"Table {table_id} does not exist yet (data not loaded)")
    response.raise_for_status()
    job = response.json()

    # Poll job until complete
    job_url = job.get("url", f"/jobs/{job['id']}")
    elapsed = 0.0
    while elapsed < POLL_TIMEOUT:
        job_resp = client.get(job_url)
        job_resp.raise_for_status()
        job_data = job_resp.json()
        if job_data["status"] == "success":
            break
        if job_data["status"] == "error":
            pytest.fail(f"Export job failed: {job_data}")
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
    else:
        pytest.fail(f"Export job timed out after {POLL_TIMEOUT}s")

    # Download the result file
    file_info = job_data["results"]["file"]
    file_id = file_info["id"]
    file_resp = client.get(f"/files/{file_id}", params={"federationToken": "1"})
    file_resp.raise_for_status()
    file_meta = file_resp.json()

    # Download CSV from the GCS URL
    gcs_url = file_meta.get("url")
    if not gcs_url:
        pytest.fail("No download URL in export result")

    csv_resp = httpx.get(gcs_url, timeout=120.0)
    csv_resp.raise_for_status()

    reader = csv.DictReader(io.StringIO(csv_resp.text))
    return list(reader)


def get_column_values(
    client: httpx.Client, table_id: str, column: str,
) -> list[str]:
    """Extract all values of a single column from a Keboola table."""
    rows = get_table_data(client, table_id)
    return [row[column] for row in rows]


# ---------------------------------------------------------------------------
# Mall data quality
# ---------------------------------------------------------------------------


class TestMallsDataQuality:
    """Data quality checks for the malls table."""

    def test_malls_no_null_names(self, keboola_client: httpx.Client) -> None:
        """Mall name column has no null or empty values."""
        values = get_column_values(keboola_client, "in.c-shopingy.malls", "name")
        empty_names = [v for v in values if not v or v.strip() == ""]
        assert len(empty_names) == 0, (
            f"Found {len(empty_names)} malls with null/empty name"
        )

    def test_malls_no_null_country(self, keboola_client: httpx.Client) -> None:
        """Mall country column has no null or empty values."""
        values = get_column_values(keboola_client, "in.c-shopingy.malls", "country")
        empty_countries = [v for v in values if not v or v.strip() == ""]
        assert len(empty_countries) == 0, (
            f"Found {len(empty_countries)} malls with null/empty country"
        )

    def test_malls_gla_positive_where_present(
        self, keboola_client: httpx.Client,
    ) -> None:
        """GLA values are > 0 where not null or empty."""
        values = get_column_values(keboola_client, "in.c-shopingy.malls", "gla")
        invalid_gla: list[str] = []
        for v in values:
            if v and v.strip() != "":
                try:
                    if float(v) <= 0:
                        invalid_gla.append(v)
                except ValueError:
                    invalid_gla.append(v)
        assert len(invalid_gla) == 0, (
            f"Found {len(invalid_gla)} malls with non-positive GLA: {invalid_gla[:10]}"
        )

    def test_malls_valid_coordinates(self, keboola_client: httpx.Client) -> None:
        """Latitude in [-90, 90] and longitude in [-180, 180] where present."""
        rows = get_table_data(keboola_client, "in.c-shopingy.malls")
        invalid_coords: list[dict[str, str]] = []
        for row in rows:
            lat_str = row.get("latitude", "")
            lon_str = row.get("longitude", "")
            if lat_str and lat_str.strip():
                try:
                    lat = float(lat_str)
                    if not (-90 <= lat <= 90):
                        invalid_coords.append(row)
                        continue
                except ValueError:
                    invalid_coords.append(row)
                    continue
            if lon_str and lon_str.strip():
                try:
                    lon = float(lon_str)
                    if not (-180 <= lon <= 180):
                        invalid_coords.append(row)
                except ValueError:
                    invalid_coords.append(row)
        assert len(invalid_coords) == 0, (
            f"Found {len(invalid_coords)} malls with invalid coordinates"
        )


# ---------------------------------------------------------------------------
# Store data quality
# ---------------------------------------------------------------------------


class TestStoresDataQuality:
    """Data quality checks for the stores table."""

    def test_stores_reference_valid_malls(
        self, keboola_client: httpx.Client,
    ) -> None:
        """Every store's shopping_mall value exists in the malls name column."""
        mall_names: set[str] = set(
            get_column_values(keboola_client, "in.c-shopingy.malls", "name"),
        )
        store_malls = get_column_values(
            keboola_client, "in.c-shopingy.stores", "shopping_mall",
        )
        invalid_refs = [m for m in store_malls if m and m not in mall_names]
        assert len(invalid_refs) == 0, (
            f"Found {len(invalid_refs)} stores referencing non-existent malls. "
            f"Examples: {invalid_refs[:5]}"
        )

    def test_stores_valid_status(self, keboola_client: httpx.Client) -> None:
        """All store_status values are in the allowed set."""
        allowed: set[str] = {"Active", "Closed"}
        values = get_column_values(
            keboola_client, "in.c-shopingy.stores", "store_status",
        )
        invalid = [v for v in values if v and v not in allowed]
        assert len(invalid) == 0, (
            f"Found {len(invalid)} stores with invalid status. "
            f"Examples: {set(invalid)}"
        )

    def test_stores_valid_size_category(
        self, keboola_client: httpx.Client,
    ) -> None:
        """All store_size values are in the allowed set."""
        allowed: set[str] = {"XXL", "XL", "L", "M", "S", "XS", ""}
        values = get_column_values(
            keboola_client, "in.c-shopingy.stores", "store_size",
        )
        invalid = [v for v in values if v not in allowed]
        assert len(invalid) == 0, (
            f"Found {len(invalid)} stores with invalid size. "
            f"Examples: {set(invalid)}"
        )

    def test_stores_valid_type(self, keboola_client: httpx.Client) -> None:
        """All store_type values are in the allowed set."""
        allowed: set[str] = {"Monobrand", "Multibrand", ""}
        values = get_column_values(
            keboola_client, "in.c-shopingy.stores", "store_type",
        )
        invalid = [v for v in values if v not in allowed]
        assert len(invalid) == 0, (
            f"Found {len(invalid)} stores with invalid type. "
            f"Examples: {set(invalid)}"
        )


# ---------------------------------------------------------------------------
# Cross-table referential integrity
# ---------------------------------------------------------------------------


class TestReferentialIntegrity:
    """Cross-table referential integrity checks."""

    def test_brands_categories_in_enum(
        self, keboola_client: httpx.Client,
    ) -> None:
        """Brand categories exist in the enum_categories table."""
        enum_categories: set[str] = set(
            get_column_values(
                keboola_client, "in.c-shopingy-enums.categories", "name",
            ),
        )
        brand_categories = get_column_values(
            keboola_client, "in.c-shopingy.brands", "category",
        )
        invalid = [
            c for c in brand_categories
            if c and c.strip() and c not in enum_categories
        ]
        assert len(invalid) == 0, (
            f"Found {len(invalid)} brands with categories not in enum. "
            f"Examples: {set(list(set(invalid))[:5])}"
        )

    def test_brand_matrix_countries_in_enum(
        self, keboola_client: httpx.Client,
    ) -> None:
        """Countries in brand_country_matrix exist in the enum_countries table."""
        enum_countries: set[str] = set(
            get_column_values(
                keboola_client, "in.c-shopingy-enums.countries", "name",
            ),
        )
        matrix_countries = get_column_values(
            keboola_client, "in.c-shopingy.brand_country_matrix", "country",
        )
        invalid = [
            c for c in matrix_countries
            if c and c.strip() and c not in enum_countries
        ]
        assert len(invalid) == 0, (
            f"Found {len(invalid)} matrix rows with countries not in enum. "
            f"Examples: {set(list(set(invalid))[:5])}"
        )


# ---------------------------------------------------------------------------
# Uniqueness checks
# ---------------------------------------------------------------------------


class TestUniqueness:
    """Uniqueness constraint checks."""

    def test_no_duplicate_mall_ids(self, keboola_client: httpx.Client) -> None:
        """All mall IDs are unique."""
        ids = get_column_values(keboola_client, "in.c-shopingy.malls", "id")
        duplicates = [x for x in ids if ids.count(x) > 1]
        assert len(duplicates) == 0, (
            f"Found duplicate mall IDs: {set(duplicates)}"
        )

    def test_no_duplicate_store_index_ids(
        self, keboola_client: httpx.Client,
    ) -> None:
        """All store_index IDs are unique."""
        ids = get_column_values(
            keboola_client, "in.c-shopingy.store_index", "id",
        )
        seen: set[str] = set()
        duplicates: set[str] = set()
        for val in ids:
            if val in seen:
                duplicates.add(val)
            seen.add(val)
        assert len(duplicates) == 0, (
            f"Found {len(duplicates)} duplicate store_index IDs. "
            f"Examples: {list(duplicates)[:10]}"
        )


# ---------------------------------------------------------------------------
# Row count sanity checks
# ---------------------------------------------------------------------------


class TestRowCounts:
    """Verify row counts match expected ranges from source data."""

    def test_row_counts_source_vs_keboola(
        self, keboola_client: httpx.Client,
    ) -> None:
        """Row counts for major tables are within expected ranges."""
        expected_ranges: dict[str, range] = {
            "in.c-shopingy.malls": range(300, 400),
            "in.c-shopingy.stores": range(14000, 17000),
            "in.c-shopingy.brands": range(1200, 1500),
        }
        failures: list[str] = []
        for table_id, expected_range in expected_ranges.items():
            metadata = get_table_metadata(keboola_client, table_id)
            row_count: int = int(metadata["rowsCount"])
            if row_count not in expected_range:
                failures.append(
                    f"{table_id}: expected {expected_range.start}-"
                    f"{expected_range.stop - 1}, got {row_count}"
                )
        assert len(failures) == 0, (
            f"Row count mismatches:\n" + "\n".join(failures)
        )
