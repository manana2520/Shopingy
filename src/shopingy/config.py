"""Central configuration loading from .env file."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Shopingy credentials
    shopingy_web: str
    shopingy_business_url: str
    shopingy_username: str
    shopingy_password: str

    # Keboola credentials
    keboola_url: str
    keboola_master_token: str
    keboola_stack_url: str
    keboola_project_id: str

    model_config = {
        "env_file": str(Path(__file__).resolve().parents[2] / ".env"),
        "env_file_encoding": "utf-8",
    }


def get_settings() -> Settings:
    """Load and return application settings. Fails fast on missing vars."""
    return Settings()
