"""Integration tests for Keboola bucket creation and CSV upload pipeline.

These tests verify that the keboola_loader module can create buckets,
upload CSV files, and that uploaded data matches source files. Skipped
automatically when the loader module is not yet implemented.
"""

from pathlib import Path

import pytest

try:
    from shopingy.keboola_loader import create_bucket, upload_csv_to_table, verify_table

    HAS_LOADER = True
except (NotImplementedError, ImportError):
    HAS_LOADER = False

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not HAS_LOADER, reason="Keboola loader not yet implemented"),
]

DATA_DIR: Path = Path(__file__).resolve().parents[1] / "data" / "processed"

ENUM_NAMES: list[str] = [
    "active",
    "types",
    "categories",
    "kinds",
    "cities",
    "countries",
    "brands",
    "malls",
    "outlettype",
    "sizes",
    "streetmall",
    "mallsoperator",
]


class TestBucketCreation:
    """Tests for creating Keboola storage buckets."""

    def test_create_shopingy_bucket(self) -> None:
        bucket_id: str = create_bucket("shopingy", "in", "Shopingy fact tables")
        assert bucket_id.startswith("in.c-shopingy")

    def test_create_enums_bucket(self) -> None:
        bucket_id: str = create_bucket("shopingy-enums", "in", "Shopingy enum tables")
        assert bucket_id == "in.c-shopingy-enums"


class TestFactTableUploads:
    """Tests for uploading fact table CSVs and verifying row counts."""

    def test_upload_malls_csv(self) -> None:
        csv_path: Path = DATA_DIR / "malls.csv"
        table_id: str = upload_csv_to_table(
            "in.c-shopingy", "malls", csv_path, primary_key=["id"],
        )
        assert table_id
        result = verify_table(table_id)
        assert 300 <= result["row_count"] <= 400, (
            f"Expected malls ~325, got {result['row_count']}"
        )

    def test_upload_stores_csv(self) -> None:
        csv_path: Path = DATA_DIR / "stores.csv"
        table_id: str = upload_csv_to_table(
            "in.c-shopingy", "stores", csv_path, primary_key=["id"],
        )
        assert table_id
        result = verify_table(table_id)
        assert 14000 <= result["row_count"] <= 17000, (
            f"Expected stores ~15509, got {result['row_count']}"
        )

    def test_upload_brands_csv(self) -> None:
        csv_path: Path = DATA_DIR / "brands.csv"
        table_id: str = upload_csv_to_table(
            "in.c-shopingy", "brands", csv_path, primary_key=["brand_name"],
        )
        assert table_id
        result = verify_table(table_id)
        assert 1200 <= result["row_count"] <= 1500, (
            f"Expected brands ~1340, got {result['row_count']}"
        )

    def test_upload_store_index_csv(self) -> None:
        csv_path: Path = DATA_DIR / "store_index.csv"
        table_id: str = upload_csv_to_table(
            "in.c-shopingy", "store_index", csv_path, primary_key=["id"],
        )
        assert table_id
        result = verify_table(table_id)
        assert 4000 <= result["row_count"] <= 5000, (
            f"Expected store_index ~4419, got {result['row_count']}"
        )

    def test_upload_brand_country_matrix_csv(self) -> None:
        csv_path: Path = DATA_DIR / "brand_country_matrix.csv"
        table_id: str = upload_csv_to_table(
            "in.c-shopingy", "brand_country_matrix", csv_path,
            primary_key=["brand_name", "country"],
        )
        assert table_id
        result = verify_table(table_id)
        assert 40000 <= result["row_count"] <= 55000, (
            f"Expected brand_country_matrix ~48240, got {result['row_count']}"
        )


class TestEnumTableUploads:
    """Tests for uploading all enum CSVs."""

    def test_upload_all_enum_tables(self) -> None:
        for enum_name in ENUM_NAMES:
            csv_path: Path = DATA_DIR / f"enum_{enum_name}.csv"
            table_id: str = upload_csv_to_table(
                "in.c-shopingy-enums", f"enum_{enum_name}", csv_path,
                primary_key=["value"],
            )
            assert table_id, f"Empty table_id for {enum_name}"
            result = verify_table(table_id)
            assert result["row_count"] > 0, (
                f"Enum table 'enum_{enum_name}' has 0 rows"
            )


class TestDataIntegrity:
    """Tests for column matching and idempotent re-uploads."""

    def test_table_columns_match_csv_headers(self) -> None:
        csv_path: Path = DATA_DIR / "malls.csv"
        # Just verify existing table, don't re-upload
        result = verify_table("in.c-shopingy.malls")

        with csv_path.open("r", encoding="utf-8") as f:
            header_line: str = f.readline().strip()
        expected_columns: set[str] = set(header_line.split(","))
        actual_columns: set[str] = set(result["columns"])

        assert actual_columns == expected_columns, (
            f"Column mismatch.\n"
            f"  Missing in Keboola: {expected_columns - actual_columns}\n"
            f"  Extra in Keboola:   {actual_columns - expected_columns}"
        )

    def test_idempotent_reupload(self) -> None:
        csv_path: Path = DATA_DIR / "malls.csv"

        # Get current count
        result_before = verify_table("in.c-shopingy.malls")
        count_before: int = result_before["row_count"]

        # Re-upload same data
        upload_csv_to_table(
            "in.c-shopingy", "malls", csv_path, primary_key=["id"],
        )
        result_after = verify_table("in.c-shopingy.malls")
        count_after: int = result_after["row_count"]

        assert count_after == count_before, (
            f"Row count changed: {count_before} -> {count_after}"
        )
