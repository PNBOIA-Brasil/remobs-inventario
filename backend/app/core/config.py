from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="REMOBS_",
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "remobs-inventario"
    app_version: str = "0.1.0"
    environment: str = "dev"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./remobs-inventario.sqlite"
    database_schema: str = ""
    database_ssl: str = ""

    jwt_secret: str = "CHANGE_ME_IN_PROD"
    jwt_issuer: str = "remobs-users"
    jwt_audience: str = "remobs-api"

    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    request_id_header: str = "X-Request-ID"

    storage_backend: str = "local"
    storage_local_path: str = str(BASE_DIR / "storage" / "files")
    storage_max_bytes: int = 15 * 1024 * 1024
    storage_s3_bucket: str = "inventario-remobs"
    storage_s3_region: str = "sa-east-1"
    storage_s3_prefix: str = "remobs-inventario"

    # Leitura de nota fiscal por modelo de visão no Bedrock (conta de IA, acesso via role entre contas).
    invoice_ai_model_id: str = "qwen.qwen3-vl-235b-a22b"
    invoice_ai_region: str = "sa-east-1"
    invoice_ai_role_arn: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def database_ssl_required(self) -> bool:
        return self.database_ssl.strip().lower() in {"1", "true", "yes", "require", "required"}

    @property
    def storage_backend_normalized(self) -> str:
        return (self.storage_backend or "local").strip().lower()

    @property
    def storage_s3_prefix_normalized(self) -> str:
        prefix = (self.storage_s3_prefix or "").strip().strip("/")
        return f"{prefix}/" if prefix else ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
