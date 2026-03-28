"""Shopingy API client - enum and DataTables data endpoints."""

import logging

import httpx

logger = logging.getLogger(__name__)

# All available enum endpoint names.
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

# DataTables endpoint paths.
ENDPOINT_MALLS = "/api/shoppingmalls/"
ENDPOINT_SHOPS = "/api/shops/"
ENDPOINT_BRANDS = "/api/brands/"
ENDPOINT_UNIQUE_SHOPS = "/api/unique-shops/"


# ---------------------------------------------------------------------------
# Enum endpoints
# ---------------------------------------------------------------------------


def fetch_enum(session: httpx.Client, enum_name: str) -> list[str]:
    """Fetch a single enum list from the Shopingy API.

    Args:
        session: Authenticated httpx client.
        enum_name: One of the names in ALL_ENUM_NAMES.

    Returns:
        List of string values for the enum.
    """
    url = f"/api/enums/{enum_name}"
    logger.debug("Fetching enum %s", enum_name)
    response = session.get(url)
    response.raise_for_status()
    data = response.json()
    logger.debug("Enum %s returned %d values", enum_name, len(data))
    return data


def fetch_all_enums(session: httpx.Client) -> dict[str, list[str]]:
    """Fetch all 12 enum endpoints.

    Args:
        session: Authenticated httpx client.

    Returns:
        Dict mapping enum name to its list of values.
    """
    result: dict[str, list[str]] = {}
    for name in ALL_ENUM_NAMES:
        result[name] = fetch_enum(session, name)
    logger.info("Fetched all %d enums", len(result))
    return result


# ---------------------------------------------------------------------------
# DataTables endpoints
# ---------------------------------------------------------------------------


def _build_datatable_payload(
    start: int, length: int, draw: int
) -> dict[str, str]:
    """Build form-encoded payload for DataTables POST requests."""
    return {
        "draw": str(draw),
        "start": str(start),
        "length": str(length),
        "search[value]": "",
        "search[regex]": "false",
    }


def fetch_datatable_page(
    session: httpx.Client,
    endpoint: str,
    start: int = 0,
    length: int = 5000,
    draw: int = 1,
) -> dict:
    """Fetch one page of DataTables data via form-encoded POST.

    CRITICAL: Uses ``data=`` (form-encoded), NOT ``json=``.

    Args:
        session: Authenticated httpx client.
        endpoint: API path (e.g. ``/api/shops/``).
        start: Row offset for pagination.
        length: Number of rows to request.
        draw: DataTables draw counter.

    Returns:
        Full JSON response dict with keys: draw, recordsTotal,
        recordsFiltered, data.
    """
    payload = _build_datatable_payload(start, length, draw)
    logger.debug(
        "POST %s  start=%d length=%d draw=%d", endpoint, start, length, draw
    )
    response = session.post(endpoint, data=payload)
    response.raise_for_status()
    return response.json()


def fetch_all_records(
    session: httpx.Client,
    endpoint: str,
    page_size: int = 5000,
) -> tuple[list[list], int]:
    """Paginate through all records for a DataTables endpoint.

    Args:
        session: Authenticated httpx client.
        endpoint: API path (e.g. ``/api/shops/``).
        page_size: Number of rows per request.

    Returns:
        Tuple of (all_rows, total_count) where each row is a list of
        column values.
    """
    all_rows: list[list] = []
    draw = 1

    # First page to discover total count
    first_page = fetch_datatable_page(
        session, endpoint, start=0, length=page_size, draw=draw
    )
    total = int(first_page["recordsFiltered"])
    all_rows.extend(first_page["data"])
    logger.info(
        "%s: page 1 fetched %d rows (total: %d)",
        endpoint,
        len(first_page["data"]),
        total,
    )

    # Remaining pages
    while len(all_rows) < total:
        draw += 1
        page = fetch_datatable_page(
            session,
            endpoint,
            start=len(all_rows),
            length=page_size,
            draw=draw,
        )
        rows = page["data"]
        if not rows:
            logger.warning(
                "%s: empty page at offset %d, stopping early", endpoint, len(all_rows)
            )
            break
        all_rows.extend(rows)
        logger.info(
            "%s: page %d fetched %d rows (%d / %d)",
            endpoint,
            draw,
            len(rows),
            len(all_rows),
            total,
        )

    logger.info("%s: completed with %d total rows", endpoint, len(all_rows))
    return all_rows, total
