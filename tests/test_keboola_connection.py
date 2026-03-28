"""Integration tests for basic Keboola connectivity.

These tests verify that the Keboola Storage API is reachable and that the
configured token has the expected permissions for the Shopingy project (ID 2835).
"""

import os
from typing import Generator

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv()

pytestmark = pytest.mark.integration

KEBOOLA_STACK_URL: str = os.environ["KEBOOLA_STACK_URL"]
KEBOOLA_MASTER_TOKEN: str = os.environ["KEBOOLA_MASTER_TOKEN"]
STORAGE_API_BASE: str = f"{KEBOOLA_STACK_URL}/v2/storage"


@pytest.fixture(scope="module")
def keboola_client() -> Generator[httpx.Client, None, None]:
    """Create an httpx.Client with the Keboola Storage API token header."""
    client = httpx.Client(
        base_url=STORAGE_API_BASE,
        headers={"X-StorageApi-Token": KEBOOLA_MASTER_TOKEN},
        timeout=30.0,
    )
    yield client
    client.close()


def test_storage_api_reachable(keboola_client: httpx.Client) -> None:
    """GET /v2/storage with token header returns 200."""
    response = keboola_client.get("/")
    assert response.status_code == 200, (
        f"Expected 200 from Storage API root, got {response.status_code}"
    )


def test_token_valid_for_project_2835(keboola_client: httpx.Client) -> None:
    """Token verify endpoint confirms project ID is 2835."""
    response = keboola_client.get("/tokens/verify")
    response.raise_for_status()
    data = response.json()
    owner_id = data["owner"]["id"]
    assert int(owner_id) == 2835, (
        f"Expected project ID 2835, got {owner_id}"
    )


def test_token_can_manage_buckets(keboola_client: httpx.Client) -> None:
    """Token verify endpoint confirms canManageBuckets is True."""
    response = keboola_client.get("/tokens/verify")
    response.raise_for_status()
    data = response.json()
    assert data["canManageBuckets"] is True, (
        f"Expected canManageBuckets=True, got {data.get('canManageBuckets')}"
    )


def test_project_name_is_shopingy(keboola_client: httpx.Client) -> None:
    """Token verify endpoint confirms project name is 'Shopingy'."""
    response = keboola_client.get("/tokens/verify")
    response.raise_for_status()
    data = response.json()
    owner_name = data["owner"]["name"]
    assert owner_name == "Shopingy", (
        f"Expected project name 'Shopingy', got '{owner_name}'"
    )
