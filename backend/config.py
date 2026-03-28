"""Configuration for Shopingy backend - loads from environment at runtime."""

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Load .env from project root for local development only
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
if ENV_FILE.exists():
    from dotenv import load_dotenv
    load_dotenv(ENV_FILE)


def get_kbc_token() -> str:
    """Get Keboola Storage API token from environment."""
    return os.environ.get("KBC_TOKEN") or os.environ.get("KEBOOLA_MASTER_TOKEN", "")


def get_kbc_url() -> str:
    """Get Keboola connection URL from environment."""
    return os.environ.get("KBC_URL") or os.environ.get("KEBOOLA_STACK_URL", "")


# Local CSV fallback directory (for local development)
LOCAL_CSV_DIR: Path = PROJECT_ROOT / "data" / "processed"

# Keboola input mapping directory (for data apps with input mapping)
INPUT_MAPPING_DIR: Path = Path("/data/in/tables")

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
    """Log config status at startup."""
    token = get_kbc_token()
    url = get_kbc_url()
    logger.info("KBC_TOKEN present: %s, KBC_URL: %s", bool(token), url or "NOT SET")
    logger.info("LOCAL_CSV_DIR exists: %s", LOCAL_CSV_DIR.exists())
    logger.info("INPUT_MAPPING_DIR exists: %s", INPUT_MAPPING_DIR.exists())
    if INPUT_MAPPING_DIR.exists():
        logger.info("Input mapping files: %s", list(INPUT_MAPPING_DIR.iterdir()))
