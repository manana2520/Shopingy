"""Configuration for Shopingy backend - loads from environment or .env file."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root for local development
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

# Keboola configuration
KBC_TOKEN: str = os.environ.get("KBC_TOKEN") or os.environ.get("KEBOOLA_MASTER_TOKEN", "")
KBC_URL: str = os.environ.get("KBC_URL") or os.environ.get("KEBOOLA_STACK_URL", "")

# Local CSV fallback directory
LOCAL_CSV_DIR: Path = PROJECT_ROOT / "data" / "processed"

# Table IDs in Keboola Storage
TABLE_IDS = {
    "malls": "in.c-shopingy.malls",
    "stores": "in.c-shopingy.stores",
    "brands": "in.c-shopingy.brands",
    "store_index": "in.c-shopingy.store_index",
    "brand_country_matrix": "in.c-shopingy.brand_country_matrix",
    "enum_categories": "in.c-shopingy-enums.enum_categories",
    "enum_outlettype": "in.c-shopingy-enums.enum_outlettype",
    "enum_sizes": "in.c-shopingy-enums.enum_sizes",
    "enum_cities": "in.c-shopingy-enums.enum_cities",
}

# API polling settings
EXPORT_POLL_INTERVAL_SECONDS = 2
EXPORT_POLL_MAX_ATTEMPTS = 60


def validate_config() -> None:
    """Validate that required configuration is present. Called at startup."""
    if not KBC_TOKEN and not LOCAL_CSV_DIR.exists():
        raise ValueError(
            "Neither KBC_TOKEN/KEBOOLA_MASTER_TOKEN is set nor local CSV directory "
            f"exists at {LOCAL_CSV_DIR}. Provide Keboola credentials or local data."
        )
