"""Upload processed CSV files to Keboola Storage.

Creates buckets for fact tables and enum tables, uploads all CSVs,
and prints a verification summary.
"""

import logging
import sys
from pathlib import Path

# Ensure src/ is on the import path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from shopingy.keboola_loader import create_bucket, upload_csv_to_table, verify_table

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"

# Fact tables: (filename_without_ext, primary_key_columns)
FACT_TABLES: list[tuple[str, list[str]]] = [
    ("malls", ["id"]),
    ("stores", ["id"]),
    ("brands", ["brand_name"]),
    ("store_index", ["id"]),
    ("brand_country_matrix", ["brand_name", "country"]),
]

FACT_BUCKET_NAME = "shopingy"
ENUM_BUCKET_NAME = "shopingy-enums"
BUCKET_STAGE = "in"


def main() -> None:
    """Run the full upload pipeline."""
    logger.info("Starting Keboola upload pipeline")

    # Step 1: Create buckets
    logger.info("Creating buckets...")
    fact_bucket_id = create_bucket(
        FACT_BUCKET_NAME, BUCKET_STAGE, "Shopingy fact tables"
    )
    enum_bucket_id = create_bucket(
        ENUM_BUCKET_NAME, BUCKET_STAGE, "Shopingy enum/lookup tables"
    )
    logger.info("Fact bucket: %s", fact_bucket_id)
    logger.info("Enum bucket: %s", enum_bucket_id)

    uploaded_tables: list[str] = []

    # Step 2: Upload fact tables
    logger.info("Uploading fact tables...")
    for table_name, pk in FACT_TABLES:
        csv_path = DATA_DIR / f"{table_name}.csv"
        if not csv_path.exists():
            logger.warning("CSV not found, skipping: %s", csv_path)
            continue
        table_id = upload_csv_to_table(
            fact_bucket_id, table_name, csv_path, primary_key=pk
        )
        uploaded_tables.append(table_id)

    # Step 3: Upload enum tables
    logger.info("Uploading enum tables...")
    enum_csvs = sorted(DATA_DIR.glob("enum_*.csv"))
    for csv_path in enum_csvs:
        table_name = csv_path.stem  # e.g. "enum_active"
        table_id = upload_csv_to_table(
            enum_bucket_id, table_name, csv_path, primary_key=["value"]
        )
        uploaded_tables.append(table_id)

    # Step 4: Verification summary
    logger.info("=" * 60)
    logger.info("VERIFICATION SUMMARY")
    logger.info("=" * 60)
    for table_id in uploaded_tables:
        result = verify_table(table_id)
        logger.info(
            "  %-40s  rows=%d  cols=%d",
            table_id,
            result["row_count"],
            len(result["columns"]),
        )

    logger.info("=" * 60)
    logger.info("Upload complete. %d tables uploaded.", len(uploaded_tables))


if __name__ == "__main__":
    main()
