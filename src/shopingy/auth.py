"""Shopingy authentication module - CSRF-based login flow."""

import logging
import re

import httpx

from shopingy.config import Settings

logger = logging.getLogger(__name__)

CSRF_PATTERN = re.compile(
    r'<input\s+type="hidden"\s+name="_csrf_token"\s+value="([^"]+)"'
)

LOGIN_PATH = "/login"


def _extract_csrf_token(html: str) -> str:
    """Extract CSRF token from the login page HTML."""
    match = CSRF_PATTERN.search(html)
    if not match:
        raise RuntimeError(
            "Failed to extract CSRF token from login page. "
            "The page structure may have changed."
        )
    return match.group(1)


def get_authenticated_session(settings: Settings) -> httpx.Client:
    """Authenticate against Shopingy and return an httpx.Client with active session.

    Flow:
        1. GET /login to obtain CSRF token from the HTML form.
        2. POST /login with credentials and CSRF token (form-encoded).
        3. Verify the response did not redirect back to /login.

    Args:
        settings: Application settings containing Shopingy credentials.

    Returns:
        An httpx.Client with authenticated cookies ready for API calls.

    Raises:
        RuntimeError: If CSRF extraction or login verification fails.
        httpx.HTTPStatusError: If the server returns an error status.
    """
    client = httpx.Client(
        base_url=settings.shopingy_business_url,
        follow_redirects=True,
        timeout=30.0,
    )

    try:
        # Step 1: GET login page and extract CSRF token
        logger.info("Fetching login page from %s%s", settings.shopingy_business_url, LOGIN_PATH)
        login_page = client.get(LOGIN_PATH)
        login_page.raise_for_status()

        csrf_token = _extract_csrf_token(login_page.text)
        logger.debug("CSRF token obtained successfully")

        # Step 2: POST login with credentials
        logger.info("Submitting login credentials for %s", settings.shopingy_username)
        login_response = client.post(
            LOGIN_PATH,
            data={
                "_csrf_token": csrf_token,
                "email": settings.shopingy_username,
                "password": settings.shopingy_password,
            },
        )
        login_response.raise_for_status()

        # Step 3: Verify login succeeded (should NOT end up back on /login)
        final_url = str(login_response.url)
        if final_url.rstrip("/").endswith(LOGIN_PATH):
            raise RuntimeError(
                "Login failed: redirected back to login page. "
                "Check credentials in .env file."
            )

        logger.info("Authentication successful (landed on %s)", final_url)

    except Exception:
        client.close()
        raise

    return client
