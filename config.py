"""
Shared configuration loader — lit config.yaml + variables d'environnement.
Utilise pydantic-settings pour la validation et la surcharge par env vars.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).parent


# ---------------------------------------------------------------------------
# Modèles de configuration Pydantic
# ---------------------------------------------------------------------------


class RepoConfig(BaseModel):
    owner: str
    repo: str
    category: str
    weight: float = 1.0


class FeedConfig(BaseModel):
    name: str
    url: str
    category: str


class PyPIPackageConfig(BaseModel):
    name: str
    category: str
    weight: float = 1.0


class GitHubConfig(BaseModel):
    base_url: str = "https://api.github.com"
    per_page: int = 30
    repos: list[RepoConfig] = Field(default_factory=list)


class RSSConfig(BaseModel):
    feeds: list[FeedConfig] = Field(default_factory=list)


class PyPIConfig(BaseModel):
    base_url: str = "https://pypi.org/pypi"
    packages: list[PyPIPackageConfig] = Field(default_factory=list)


class ScoringConfig(BaseModel):
    weights: dict[str, float] = Field(default_factory=dict)
    breaking_keywords: list[str] = Field(default_factory=list)
    trend_window_days: int = 30


class PathsConfig(BaseModel):
    data_dir: str = "data"
    raw_dir: str = "data/raw"
    processed_dir: str = "data/processed"
    warehouse: str = "data/warehouse.duckdb"
    web_data: str = "web/data.json"


class APIConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = Field(default_factory=list)
    max_results: int = 100


class AppConfig(BaseModel):
    name: str = "Tech Watch"
    version: str = "0.1.0"
    description: str = ""
    timezone: str = "Europe/Paris"


class SchedulerConfig(BaseModel):
    enabled: bool = True
    cron: str = "0 7 * * *"
    timezone: str = "Europe/Paris"


class DiscoveryTopicConfig(BaseModel):
    name: str
    category: str = ""


class DiscoveryConfig(BaseModel):
    enabled: bool = True
    per_topic: int = 8
    min_stars: int = 500
    topics: list[DiscoveryTopicConfig] = Field(default_factory=list)


class Config(BaseModel):
    app: AppConfig = Field(default_factory=AppConfig)
    paths: PathsConfig = Field(default_factory=PathsConfig)
    github: GitHubConfig = Field(default_factory=GitHubConfig)
    rss: RSSConfig = Field(default_factory=RSSConfig)
    pypi: PyPIConfig = Field(default_factory=PyPIConfig)
    scoring: ScoringConfig = Field(default_factory=ScoringConfig)
    api: APIConfig = Field(default_factory=APIConfig)
    scheduler: SchedulerConfig = Field(default_factory=SchedulerConfig)
    discovery: DiscoveryConfig = Field(default_factory=DiscoveryConfig)


# ---------------------------------------------------------------------------
# Settings (surcharge par env vars)
# ---------------------------------------------------------------------------


class Settings(BaseSettings):
    """Variables d'environnement sensibles — NE PAS committer."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    github_token: str | None = None
    log_level: str = "INFO"
    environment: str = "development"


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def load_config(config_path: str | None = None) -> Config:
    """Charge config.yaml et retourne un objet Config validé."""
    path = Path(config_path) if config_path else ROOT_DIR / "config.yaml"
    if not path.exists():
        return Config()
    with path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return Config.model_validate(raw or {})


@lru_cache(maxsize=1)
def load_settings() -> Settings:
    """Charge les settings depuis les variables d'environnement / .env."""
    return Settings()


def get_github_headers(settings: Settings | None = None) -> dict[str, str]:
    """Retourne les headers HTTP pour l'API GitHub avec token si disponible."""
    if settings is None:
        settings = load_settings()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = settings.github_token or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers
