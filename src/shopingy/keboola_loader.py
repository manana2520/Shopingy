"""Keboola Storage API client for bucket/table management."""

import logging
import time
from pathlib import Path

import httpx

from shopingy.config import get_settings

logger = logging.getLogger(__name__)

# Polling configuration
POLL_INTERVAL_SECONDS = 2
POLL_TIMEOUT_SECONDS = 300
HTTP_TIMEOUT_SECONDS = 120


def _get_client() -> httpx.Client:
    """Create an httpx.Client configured for the Keboola Storage API."""
    settings = get_settings()
    base_url = f"{settings.keboola_stack_url}/v2/storage"
    return httpx.Client(
        base_url=base_url,
        headers={"X-StorageApi-Token": settings.keboola_master_token},
        timeout=HTTP_TIMEOUT_SECONDS,
    )


def _upload_file(client: httpx.Client, csv_path: Path) -> int:
    """Upload a CSV file to Keboola File Storage and return the file ID.

    Uses the /files/prepare endpoint to get a signed GCS URL, uploads the
    file content directly to GCS, then returns the Keboola file ID.

    Args:
        client: httpx.Client with auth headers set.
        csv_path: Path to the local CSV file.

    Returns:
        The Keboola file ID (dataFileId).
    """
    file_size = csv_path.stat().st_size

    # Step 1: Prepare the file resource
    prepare_resp = client.post(
        "/files/prepare",
        data={
            "name": csv_path.name,
            "isPublic": "0",
            "isPermanent": "0",
            "notify": "0",
            "sizeBytes": str(file_size),
        },
    )
    prepare_resp.raise_for_status()
    file_info = prepare_resp.json()
    file_id = file_info["id"]

    # Step 2: Upload the actual file content to GCS
    gcs_params = file_info["gcsUploadParams"]
    gcs_url = (
        f"https://storage.googleapis.com/{gcs_params['bucket']}/{gcs_params['key']}"
    )
    with csv_path.open("rb") as f:
        gcs_resp = httpx.put(
            gcs_url,
            content=f.read(),
            headers={
                "Authorization": f"Bearer {gcs_params['access_token']}",
                "Content-Type": "text/csv",
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
    gcs_resp.raise_for_status()
    logger.info("Uploaded %s to GCS (file ID: %d)", csv_path.name, file_id)

    return file_id


def _poll_job(client: httpx.Client, job_url: str) -> dict:
    """Poll an async job URL until it reaches a terminal state.

    Args:
        client: httpx.Client with auth headers set.
        job_url: Full URL or relative path to the job resource.

    Returns:
        The final job response dict.

    Raises:
        RuntimeError: If the job errors out or polling times out.
    """
    elapsed = 0.0
    while elapsed < POLL_TIMEOUT_SECONDS:
        response = client.get(job_url)
        response.raise_for_status()
        job = response.json()
        status = job.get("status")
        logger.debug("Job %s status: %s", job.get("id"), status)

        if status == "success":
            return job
        if status == "error":
            error_msg = job.get("error", {}).get("message", "Unknown error")
            raise RuntimeError(f"Keboola job failed: {error_msg}")

        time.sleep(POLL_INTERVAL_SECONDS)
        elapsed += POLL_INTERVAL_SECONDS

    raise RuntimeError(
        f"Keboola job polling timed out after {POLL_TIMEOUT_SECONDS}s"
    )


def create_bucket(name: str, stage: str, description: str) -> str:
    """Create a Keboola Storage bucket.

    Args:
        name: Bucket name (alphanumeric and dashes).
        stage: Bucket stage ('in' or 'out').
        description: Human-readable bucket description.

    Returns:
        The bucket ID (e.g. 'in.c-shopingy').
    """
    with _get_client() as client:
        response = client.post(
            "/buckets",
            data={"name": name, "stage": stage, "description": description},
        )

        if response.status_code in (400, 409):
            # Check if the error is about an existing bucket
            try:
                error_data = response.json()
                error_code = error_data.get("code", "")
            except Exception:
                error_code = ""

            if "alreadyExists" in error_code or response.status_code == 409:
                bucket_id = f"{stage}.c-{name}"
                logger.info("Bucket %s already exists, reusing.", bucket_id)
                return bucket_id
            # Not an "already exists" error - raise
            response.raise_for_status()

        response.raise_for_status()
        data = response.json()
        bucket_id = data["id"]
        logger.info("Created bucket %s", bucket_id)
        return bucket_id


def upload_csv_to_table(
    bucket_id: str,
    table_name: str,
    csv_path: Path,
    primary_key: list[str] | None = None,
) -> str:
    """Upload a CSV file to a Keboola Storage table (async).

    If the table does not exist, it is created. If it already exists,
    the data is re-imported (full load).

    Args:
        bucket_id: Target bucket ID (e.g. 'in.c-shopingy').
        table_name: Name for the table.
        csv_path: Path to the CSV file to upload.
        primary_key: Optional list of column names for the primary key.

    Returns:
        The table ID (e.g. 'in.c-shopingy.malls').
    """
    table_id = f"{bucket_id}.{table_name}"

    with _get_client() as client:
        # Check if table already exists
        table_exists = False
        try:
            check = client.get(f"/tables/{table_id}")
            if check.status_code == 200:
                table_exists = True
        except httpx.HTTPError:
            pass

        if table_exists:
            return _load_data_into_existing_table(
                client, table_id, csv_path, primary_key
            )
        else:
            return _create_table_with_data(
                client, bucket_id, table_name, csv_path, primary_key
            )


def _create_table_with_data(
    client: httpx.Client,
    bucket_id: str,
    table_name: str,
    csv_path: Path,
    primary_key: list[str] | None,
) -> str:
    """Create a new table from a CSV file (async).

    Uploads the CSV to Keboola File Storage first, then creates
    the table using the dataFileId.
    """
    logger.info("Creating table %s.%s from %s", bucket_id, table_name, csv_path.name)

    data_file_id = _upload_file(client, csv_path)

    form_data: dict = {
        "name": table_name,
        "dataFileId": str(data_file_id),
    }
    if primary_key:
        form_data["primaryKey"] = ",".join(primary_key)

    response = client.post(
        f"/buckets/{bucket_id}/tables-async",
        data=form_data,
    )
    response.raise_for_status()
    job = response.json()
    logger.debug("Create-table job response: %s", job)

    # The response is a job - poll for completion
    job_url = job.get("url", f"/jobs/{job['id']}")
    result = _poll_job(client, job_url)

    table_id = result.get("results", {}).get("id", f"{bucket_id}.{table_name}")
    logger.info("Table %s created successfully.", table_id)
    return table_id


def _load_data_into_existing_table(
    client: httpx.Client,
    table_id: str,
    csv_path: Path,
    primary_key: list[str] | None,
) -> str:
    """Load CSV data into an existing table (async, full load).

    Uploads the CSV to Keboola File Storage first, then imports
    using the dataFileId.
    """
    logger.info("Loading data into existing table %s from %s", table_id, csv_path.name)

    data_file_id = _upload_file(client, csv_path)

    form_data: dict = {
        "dataFileId": str(data_file_id),
        "incremental": "0",
    }

    response = client.post(
        f"/tables/{table_id}/import-async",
        data=form_data,
    )
    response.raise_for_status()
    job = response.json()
    logger.debug("Load-data job response: %s", job)

    job_url = job.get("url", f"/jobs/{job['id']}")
    _poll_job(client, job_url)

    logger.info("Data loaded into table %s successfully.", table_id)
    return table_id


def verify_table(table_id: str) -> dict:
    """Verify a table exists and return its metadata.

    Args:
        table_id: Full table ID (e.g. 'in.c-shopingy.malls').

    Returns:
        Dict with 'row_count' (int) and 'columns' (list[str]) keys.
    """
    with _get_client() as client:
        response = client.get(f"/tables/{table_id}")
        response.raise_for_status()
        data = response.json()

    row_count = int(data.get("rowsCount", 0))
    columns = data.get("columns", [])

    logger.info(
        "Table %s: %d rows, %d columns", table_id, row_count, len(columns)
    )

    return {
        "row_count": row_count,
        "columns": columns,
    }
