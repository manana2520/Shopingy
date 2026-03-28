"""Integration tests for Shopingy enum API endpoints."""

from typing import Any

import httpx
import pytest

BUSINESS_URL = "https://business.shopingy.com"

pytestmark = pytest.mark.integration

ALL_ENUM_NAMES: list[str] = [
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


def test_enum_active_returns_2_values(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/active endpoint should return exactly 2 values."""
    response = authenticated_session.get("/api/enums/active")
    assert response.status_code == 200
    data: list[Any] = response.json()
    assert len(data) == 2


def test_enum_categories_count(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/categories endpoint should return exactly 20 values."""
    response = authenticated_session.get("/api/enums/categories")
    assert response.status_code == 200
    data: list[Any] = response.json()
    assert len(data) == 20


def test_enum_kinds_count(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/kinds endpoint should return exactly 71 values."""
    response = authenticated_session.get("/api/enums/kinds")
    assert response.status_code == 200
    data: list[Any] = response.json()
    assert len(data) == 71


def test_enum_cities_count(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/cities endpoint should return a large number of cities.

    The full dataset has ~3,960 cities across all countries.
    """
    response = authenticated_session.get("/api/enums/cities")
    assert response.status_code == 200
    data: list[Any] = response.json()
    assert len(data) >= 100, (
        f"Expected at least 100 cities, got {len(data)}"
    )


def test_enum_mall_types_count(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/outlettype endpoint should return exactly 7 values."""
    response = authenticated_session.get("/api/enums/outlettype")
    assert response.status_code == 200
    data: list[Any] = response.json()
    assert len(data) == 7


def test_enum_sizes_count(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/sizes endpoint should return exactly 6 values."""
    response = authenticated_session.get("/api/enums/sizes")
    assert response.status_code == 200
    data: list[Any] = response.json()
    assert len(data) == 6


@pytest.mark.parametrize("enum_name", ALL_ENUM_NAMES)
def test_all_12_enum_endpoints_return_data(
    authenticated_session: httpx.Client,
    enum_name: str,
) -> None:
    """Each of the 12 enum endpoints should return a non-empty list."""
    response = authenticated_session.get(f"/api/enums/{enum_name}")
    assert response.status_code == 200, (
        f"/api/enums/{enum_name} returned {response.status_code}"
    )
    data: list[Any] = response.json()
    assert isinstance(data, list), (
        f"Expected list from /api/enums/{enum_name}, got {type(data)}"
    )
    assert len(data) > 0, f"/api/enums/{enum_name} returned empty list"


def test_enum_values_are_strings(
    authenticated_session: httpx.Client,
) -> None:
    """The /api/enums/categories values should all be strings."""
    response = authenticated_session.get("/api/enums/categories")
    assert response.status_code == 200
    data: list[Any] = response.json()
    for item in data:
        assert isinstance(item, str), (
            f"Expected string enum value, got {type(item)}: {item}"
        )
