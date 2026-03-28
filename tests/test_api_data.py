"""Integration tests for Shopingy DataTables API endpoints."""

from typing import Any

import httpx
import pytest

BUSINESS_URL = "https://business.shopingy.com"

pytestmark = pytest.mark.integration


def _datatables_payload(
    start: int = 0,
    length: int = 10,
    draw: int = 1,
) -> dict[str, str]:
    """Build a standard DataTables server-side POST body as form-encoded data.

    The Shopingy API expects application/x-www-form-urlencoded, not JSON.
    """
    return {
        "draw": str(draw),
        "start": str(start),
        "length": str(length),
        "search[value]": "",
        "search[regex]": "false",
    }


# ---------------------------------------------------------------------------
# Malls (/api/shoppingmalls/)
# ---------------------------------------------------------------------------


def test_malls_api_returns_datatables_response(
    authenticated_session: httpx.Client,
) -> None:
    """POST /api/shoppingmalls/ should return a standard DataTables response."""
    response = authenticated_session.post(
        "/api/shoppingmalls/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    data: dict[str, Any] = response.json()
    for key in ("draw", "recordsTotal", "recordsFiltered", "data"):
        assert key in data, f"Missing key '{key}' in DataTables response"


def test_malls_total_count_approximately_325(
    authenticated_session: httpx.Client,
) -> None:
    """The malls recordsFiltered count should be approximately 325."""
    response = authenticated_session.post(
        "/api/shoppingmalls/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    filtered = int(response.json()["recordsFiltered"])
    assert 300 <= filtered <= 400, (
        f"Expected 300-400 malls, got {filtered}"
    )


def test_malls_row_has_17_columns(
    authenticated_session: httpx.Client,
) -> None:
    """Each mall row should contain exactly 17 columns."""
    response = authenticated_session.post(
        "/api/shoppingmalls/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    rows: list[list[Any]] = response.json()["data"]
    assert len(rows) > 0, "No mall rows returned"
    assert len(rows[0]) == 17, (
        f"Expected 17 columns in mall row, got {len(rows[0])}"
    )


def test_malls_pagination_returns_different_pages(
    authenticated_session: httpx.Client,
) -> None:
    """Paginating with different start offsets should return different rows."""
    page1 = authenticated_session.post(
        "/api/shoppingmalls/",
        data=_datatables_payload(start=0, length=5),
    )
    page2 = authenticated_session.post(
        "/api/shoppingmalls/",
        data=_datatables_payload(start=5, length=5),
    )
    assert page1.status_code == 200
    assert page2.status_code == 200

    rows_page1: list[list[Any]] = page1.json()["data"]
    rows_page2: list[list[Any]] = page2.json()["data"]

    assert len(rows_page1) > 0
    assert len(rows_page2) > 0
    assert rows_page1[0] != rows_page2[0], (
        "First rows of page 1 and page 2 should differ"
    )


# ---------------------------------------------------------------------------
# Stores (/api/shops/)
# ---------------------------------------------------------------------------


def test_stores_total_count_in_expected_range(
    authenticated_session: httpx.Client,
) -> None:
    """The stores recordsFiltered count should be in a reasonable range."""
    response = authenticated_session.post(
        "/api/shops/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    filtered = int(response.json()["recordsFiltered"])
    assert 10000 <= filtered <= 20000, (
        f"Expected 10000-20000 stores, got {filtered}"
    )


def test_stores_row_has_23_columns(
    authenticated_session: httpx.Client,
) -> None:
    """Each store row should have 23 columns."""
    response = authenticated_session.post(
        "/api/shops/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    rows: list[list[Any]] = response.json()["data"]
    assert len(rows) > 0, "No store rows returned"
    assert len(rows[0]) == 23, (
        f"Expected 23 columns in store row, got {len(rows[0])}"
    )


# ---------------------------------------------------------------------------
# Brands (/api/brands/)
# ---------------------------------------------------------------------------


def test_brands_total_count_approximately_1340(
    authenticated_session: httpx.Client,
) -> None:
    """The brands recordsFiltered count should be approximately 1340."""
    response = authenticated_session.post(
        "/api/brands/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    filtered = int(response.json()["recordsFiltered"])
    assert 1200 <= filtered <= 1500, (
        f"Expected 1200-1500 brands, got {filtered}"
    )


def test_brands_row_has_78_columns(
    authenticated_session: httpx.Client,
) -> None:
    """Each brand row should have 78 columns (5 base + 36*2 country + 1)."""
    response = authenticated_session.post(
        "/api/brands/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    rows: list[list[Any]] = response.json()["data"]
    assert len(rows) > 0, "No brand rows returned"
    assert len(rows[0]) == 78, (
        f"Expected 78 columns in brand row, got {len(rows[0])}"
    )


# ---------------------------------------------------------------------------
# Unique Shops (/api/unique-shops/)
# ---------------------------------------------------------------------------


def test_unique_shops_total_count_approximately_4400(
    authenticated_session: httpx.Client,
) -> None:
    """The unique-shops recordsFiltered count should be approximately 4400."""
    response = authenticated_session.post(
        "/api/unique-shops/",
        data=_datatables_payload(),
    )
    assert response.status_code == 200
    filtered = int(response.json()["recordsFiltered"])
    assert 4000 <= filtered <= 5000, (
        f"Expected 4000-5000 unique shops, got {filtered}"
    )


# ---------------------------------------------------------------------------
# Full pagination
# ---------------------------------------------------------------------------


@pytest.mark.slow
def test_full_pagination_extracts_all_malls(
    authenticated_session: httpx.Client,
) -> None:
    """Paginate through all malls with length=100 and collect every row."""
    page_size = 100
    first_response = authenticated_session.post(
        "/api/shoppingmalls/",
        data=_datatables_payload(start=0, length=page_size, draw=1),
    )
    assert first_response.status_code == 200
    first_json: dict[str, Any] = first_response.json()
    total_filtered = int(first_json["recordsFiltered"])

    all_rows: list[list[Any]] = list(first_json["data"])
    draw = 2
    start = page_size

    while start < total_filtered:
        page_response = authenticated_session.post(
            "/api/shoppingmalls/",
            data=_datatables_payload(start=start, length=page_size, draw=draw),
        )
        assert page_response.status_code == 200
        page_data: list[list[Any]] = page_response.json()["data"]
        if not page_data:
            break
        all_rows.extend(page_data)
        start += page_size
        draw += 1

    assert len(all_rows) == total_filtered, (
        f"Collected {len(all_rows)} rows but recordsFiltered is {total_filtered}"
    )
