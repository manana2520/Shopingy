"""Data layer: reads tables from Keboola Storage API with local CSV fallback and caching."""

import io
import logging
import time
from functools import lru_cache

import httpx
import pandas as pd

from backend.config import (
    EXPORT_POLL_INTERVAL_SECONDS,
    EXPORT_POLL_MAX_ATTEMPTS,
    INPUT_MAPPING_DIR,
    LOCAL_CSV_DIR,
    TABLE_IDS,
    get_kbc_token,
    get_kbc_url,
)

logger = logging.getLogger(__name__)

# CSV file name mapping (table key -> local CSV filename)
LOCAL_CSV_NAMES = {
    "malls": "malls.csv",
    "stores": "stores.csv",
    "brands": "brands.csv",
    "store_index": "store_index.csv",
    "brand_country_matrix": "brand_country_matrix.csv",
    "enum_categories": "enum_categories.csv",
    "enum_outlettype": "enum_outlettype.csv",
    "enum_sizes": "enum_sizes.csv",
    "enum_cities": "enum_cities.csv",
}


def _keboola_headers() -> dict[str, str]:
    return {"X-StorageApi-Token": get_kbc_token()}


def _download_sliced_file(file_info: dict) -> str:
    """Download a sliced file from GCP Keboola using OAuth access token.

    GCS sliced files: fetch manifest for slice paths, then download each
    slice using the gcsCredentials access_token from the file info.
    """
    import json

    manifest_url = file_info["url"]
    gcs_creds = file_info.get("gcsCredentials", {})
    access_token = gcs_creds.get("access_token", "")
    gcs_path = file_info.get("gcsPath", {})
    bucket = gcs_path.get("bucket", "")

    logger.info("Fetching manifest, bucket=%s", bucket)

    # Download manifest using the signed URL
    resp = httpx.get(manifest_url, timeout=60.0, follow_redirects=True)
    resp.raise_for_status()
    manifest = json.loads(resp.text)
    entries = manifest.get("entries", [])
    logger.info("Manifest has %d slices", len(entries))

    auth_headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}

    chunks = []
    for i, entry in enumerate(entries):
        gs_url = entry["url"]

        # Convert gs://bucket/path to https://storage.googleapis.com/bucket/path
        if gs_url.startswith("gs://"):
            https_url = "https://storage.googleapis.com/" + gs_url[5:]
        else:
            https_url = gs_url

        logger.debug("Downloading slice %d/%d: %s", i + 1, len(entries), https_url[:80])
        resp = httpx.get(https_url, headers=auth_headers, timeout=120.0, follow_redirects=True)
        resp.raise_for_status()
        chunks.append(resp.text)

    return "".join(chunks)


def _export_table(table_id: str) -> pd.DataFrame:
    """Export a table from Keboola Storage API using async export.

    Steps:
    1. POST /tables/{table_id}/export-async -> job
    2. Poll GET /jobs/{job_id} until success
    3. Get file ID from job results
    4. GET /files/{file_id}?federationToken=1 -> file info JSON
    5. If sliced: download manifest + all slices; otherwise download single CSV
    """
    base_url = f"{get_kbc_url()}/v2/storage"
    headers = _keboola_headers()

    # Step 1: Start async export
    resp = httpx.post(
        f"{base_url}/tables/{table_id}/export-async",
        headers=headers,
        timeout=30.0,
    )
    resp.raise_for_status()
    job = resp.json()
    job_id = job["id"]
    logger.info("Started export job %s for table %s", job_id, table_id)

    # Step 2: Poll until success
    for attempt in range(EXPORT_POLL_MAX_ATTEMPTS):
        resp = httpx.get(f"{base_url}/jobs/{job_id}", headers=headers, timeout=30.0)
        resp.raise_for_status()
        job = resp.json()
        status = job.get("status")
        if status == "success":
            break
        if status == "error":
            raise RuntimeError(f"Export job {job_id} failed: {job}")
        time.sleep(EXPORT_POLL_INTERVAL_SECONDS)
    else:
        raise TimeoutError(f"Export job {job_id} did not complete in time")

    # Step 3: Get file ID
    file_id = job["results"]["file"]["id"]
    logger.info("Export job %s completed, file ID: %s", job_id, file_id)

    # Step 4: Get file info with download URL
    resp = httpx.get(
        f"{base_url}/files/{file_id}",
        params={"federationToken": "1"},
        headers=headers,
        timeout=30.0,
    )
    resp.raise_for_status()
    file_info = resp.json()

    # Step 5: Download - handle sliced vs non-sliced files
    is_sliced = file_info.get("isSliced", False)

    if is_sliced:
        logger.info("File %s is sliced, downloading slices...", file_id)
        csv_text = _download_sliced_file(file_info)
        # Sliced files have no header row - get columns from the table metadata
        columns_resp = httpx.get(
            f"{base_url}/tables/{table_id}",
            headers=headers,
            timeout=30.0,
        )
        columns_resp.raise_for_status()
        table_meta = columns_resp.json()
        columns = table_meta.get("columns", [])
        if columns and csv_text.strip():
            df = pd.read_csv(io.StringIO(csv_text), header=None, names=columns)
        elif csv_text.strip():
            df = pd.read_csv(io.StringIO(csv_text))
        else:
            df = pd.DataFrame()
    else:
        download_url = file_info["url"]
        resp = httpx.get(download_url, timeout=120.0, follow_redirects=True)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))

    logger.info("Loaded %d rows from table %s", len(df), table_id)
    return df


def _load_table(table_key: str) -> pd.DataFrame:
    """Load a table from: 1) local CSV, 2) input mapping, 3) Keboola API."""
    csv_name = LOCAL_CSV_NAMES[table_key]
    csv_path = LOCAL_CSV_DIR / csv_name

    # 1. Prefer local CSV if available (fast, works offline)
    if csv_path.exists():
        logger.info("Loading %s from local CSV: %s", table_key, csv_path)
        return pd.read_csv(csv_path)

    # 2. Check Keboola input mapping (/data/in/tables/)
    input_path = INPUT_MAPPING_DIR / csv_name
    if input_path.exists():
        logger.info("Loading %s from input mapping: %s", table_key, input_path)
        return pd.read_csv(input_path)

    # 3. Fall back to Keboola Storage API
    table_id = TABLE_IDS[table_key]
    token = get_kbc_token()
    url = get_kbc_url()
    logger.info("Attempting Keboola API: token=%s, url=%s, table=%s", bool(token), url, table_id)
    if token and url:
        return _export_table(table_id)

    raise FileNotFoundError(
        f"Cannot load table '{table_key}': no local CSV at {csv_path}, "
        f"no input mapping, token_present={bool(token)}, url={url}"
    )


@lru_cache(maxsize=1)
def load_malls() -> pd.DataFrame:
    return _load_table("malls")


@lru_cache(maxsize=1)
def load_stores() -> pd.DataFrame:
    return _load_table("stores")


@lru_cache(maxsize=1)
def load_brands() -> pd.DataFrame:
    return _load_table("brands")


@lru_cache(maxsize=1)
def load_store_index() -> pd.DataFrame:
    return _load_table("store_index")


@lru_cache(maxsize=1)
def load_brand_country_matrix() -> pd.DataFrame:
    return _load_table("brand_country_matrix")


@lru_cache(maxsize=1)
def load_enum_categories() -> pd.DataFrame:
    return _load_table("enum_categories")


@lru_cache(maxsize=1)
def load_enum_outlettype() -> pd.DataFrame:
    return _load_table("enum_outlettype")


@lru_cache(maxsize=1)
def load_enum_sizes() -> pd.DataFrame:
    return _load_table("enum_sizes")


@lru_cache(maxsize=1)
def load_enum_cities() -> pd.DataFrame:
    return _load_table("enum_cities")


def clear_cache() -> None:
    """Clear all cached data to force reload."""
    load_malls.cache_clear()
    load_stores.cache_clear()
    load_brands.cache_clear()
    load_store_index.cache_clear()
    load_brand_country_matrix.cache_clear()
    load_enum_categories.cache_clear()
    load_enum_outlettype.cache_clear()
    load_enum_sizes.cache_clear()
    load_enum_cities.cache_clear()
