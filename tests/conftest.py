"""Shared pytest fixtures for Shopingy integration tests."""

import re
from typing import Generator

import httpx
import pytest
from dotenv import load_dotenv

from shopingy.config import Settings, get_settings

# Load .env at module level so all tests have access to environment variables
load_dotenv()

BUSINESS_URL = "https://business.shopingy.com"


def _login(client: httpx.Client, settings: Settings) -> None:
    """Perform CSRF + login flow on an httpx.Client."""
    login_page = client.get("/login")
    login_page.raise_for_status()

    match = re.search(
        r'<input[^>]*name=["\']_csrf_token["\'][^>]*value=["\']([^"\']+)["\']',
        login_page.text,
    )
    if match is None:
        raise RuntimeError("Could not extract CSRF token from login page")

    login_response = client.post(
        "/login",
        data={
            "_csrf_token": match.group(1),
            "email": settings.shopingy_username,
            "password": settings.shopingy_password,
        },
    )

    if login_response.status_code != 200:
        raise RuntimeError(f"Login failed with status {login_response.status_code}")
    if "/login" in str(login_response.url):
        raise RuntimeError("Login failed - redirected back to login page")


@pytest.fixture
def config() -> Settings:
    """Load and return application settings from .env."""
    return get_settings()


@pytest.fixture(scope="module")
def authenticated_session() -> Generator[httpx.Client, None, None]:
    """Create an httpx.Client authenticated against the Shopingy business app.

    Module-scoped to avoid session expiry across too many tests.
    Performs the full CSRF + login flow directly with httpx so that
    tests are runnable even before the shopingy.auth module is implemented.
    """
    settings = get_settings()

    client = httpx.Client(
        base_url=BUSINESS_URL,
        follow_redirects=True,
        timeout=30.0,
    )

    _login(client, settings)

    yield client
    client.close()
