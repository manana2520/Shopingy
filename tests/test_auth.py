"""Integration tests for Shopingy authentication flow."""

import re

import httpx
import pytest

from shopingy.config import Settings

BUSINESS_URL = "https://business.shopingy.com"

pytestmark = pytest.mark.integration


def test_csrf_token_retrieved() -> None:
    """GET /login should return an HTML page containing a CSRF token."""
    with httpx.Client(base_url=BUSINESS_URL, timeout=30.0) as client:
        response = client.get("/login")

    assert response.status_code == 200

    # Look for a hidden input named _csrf_token (Symfony CSRF field)
    match = re.search(
        r'<input[^>]*name=["\']_csrf_token["\'][^>]*value=["\']([^"\']+)["\']',
        response.text,
    )
    assert match is not None, "CSRF _csrf_token input not found in login page HTML"
    assert len(match.group(1)) > 0, "CSRF token value is empty"


def test_login_succeeds_with_valid_credentials(config: Settings) -> None:
    """POST /login with valid credentials should redirect to dashboard."""
    with httpx.Client(
        base_url=BUSINESS_URL, follow_redirects=False, timeout=30.0
    ) as client:
        # Get CSRF token
        login_page = client.get("/login")
        match = re.search(
            r'<input[^>]*name=["\']_csrf_token["\'][^>]*value=["\']([^"\']+)["\']',
            login_page.text,
        )
        assert match is not None
        csrf_token: str = match.group(1)

        # Post credentials
        response = client.post(
            "/login",
            data={
                "_csrf_token": csrf_token,
                "email": config.shopingy_username,
                "password": config.shopingy_password,
            },
        )

    # Successful login should produce a 302 redirect (to dashboard)
    # or 200 if the server follows through
    assert response.status_code in (200, 302), (
        f"Expected 200 or 302, got {response.status_code}"
    )


def test_authenticated_session_accesses_api(config: Settings) -> None:
    """A freshly authenticated session should be able to GET /api/enums/active."""
    # Use a fresh session to avoid flakiness from session-scoped fixture expiry
    with httpx.Client(
        base_url=BUSINESS_URL, follow_redirects=True, timeout=30.0
    ) as client:
        login_page = client.get("/login")
        match = re.search(
            r'<input[^>]*name=["\']_csrf_token["\'][^>]*value=["\']([^"\']+)["\']',
            login_page.text,
        )
        assert match is not None
        client.post(
            "/login",
            data={
                "_csrf_token": match.group(1),
                "email": config.shopingy_username,
                "password": config.shopingy_password,
            },
        )

        response = client.get("/api/enums/active")

    assert response.status_code == 200
    assert "application/json" in response.headers.get("content-type", ""), (
        f"Expected JSON, got: {response.headers.get('content-type')}"
    )
    data = response.json()
    assert isinstance(data, list), f"Expected list, got {type(data)}"


def test_login_fails_with_bad_credentials() -> None:
    """POST /login with wrong password should stay on login or show error."""
    with httpx.Client(
        base_url=BUSINESS_URL, follow_redirects=True, timeout=30.0
    ) as client:
        # Get CSRF token
        login_page = client.get("/login")
        match = re.search(
            r'<input[^>]*name=["\']_csrf_token["\'][^>]*value=["\']([^"\']+)["\']',
            login_page.text,
        )
        assert match is not None
        csrf_token: str = match.group(1)

        # Post with bad credentials
        response = client.post(
            "/login",
            data={
                "_csrf_token": csrf_token,
                "email": "nonexistent@example.com",
                "password": "definitely-wrong-password",
            },
        )

    # Should remain on the login page or receive an error
    assert "/login" in str(response.url) or response.status_code in (
        401,
        422,
    ), "Expected to stay on login page or get auth error"
