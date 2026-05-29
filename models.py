"""
Modèles Pydantic v2 partagés — définit les structures de données
utilisées par tous les modules (collectors, pipeline, engine, api).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, HttpUrl


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SourceType(str, Enum):
    GITHUB = "github"
    RSS = "rss"
    PYPI = "pypi"


class ImpactLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class TrendDirection(str, Enum):
    RISING = "rising"
    STABLE = "stable"
    DECLINING = "declining"


class Category(str, Enum):
    DATA_ENGINEERING = "data-engineering"
    AI = "ai"
    BACKEND = "backend"
    BACKEND_RUST = "backend-rust"
    LAKEHOUSE = "lakehouse"
    TOOLING = "tooling"
    DATA_SCIENCE = "data-science"
    ARCHITECTURE = "architecture"
    ENGINEERING = "engineering"


# ---------------------------------------------------------------------------
# Modèles de collecte bruts
# ---------------------------------------------------------------------------


class RawRelease(BaseModel):
    """Données brutes d'une release GitHub."""

    source: SourceType = SourceType.GITHUB
    repo_owner: str
    repo_name: str
    tag_name: str
    name: str | None = None
    body: str | None = None          # changelog / release notes
    published_at: datetime | None = None
    html_url: str
    prerelease: bool = False
    draft: bool = False
    category: str = ""
    repo_weight: float = 1.0
    collected_at: datetime = Field(default_factory=datetime.utcnow)


class RawArticle(BaseModel):
    """Données brutes d'un article RSS."""

    source: SourceType = SourceType.RSS
    feed_name: str
    title: str
    url: str
    summary: str | None = None
    published_at: datetime | None = None
    category: str = ""
    collected_at: datetime = Field(default_factory=datetime.utcnow)


class RawPackageRelease(BaseModel):
    """Données brutes d'une release PyPI."""

    source: SourceType = SourceType.PYPI
    package_name: str
    version: str
    upload_time: datetime | None = None
    requires_python: str | None = None
    summary: str | None = None
    category: str = ""
    weight: float = 1.0
    collected_at: datetime = Field(default_factory=datetime.utcnow)


class DiscoveredRepo(BaseModel):
    """Dépôt découvert dynamiquement via la recherche GitHub par topic."""

    owner: str
    repo: str
    full_name: str
    description: str | None = None
    url: str
    stars: int = 0
    language: str | None = None
    topics: list[str] = Field(default_factory=list)
    pushed_at: datetime | None = None
    created_at: datetime | None = None
    category: str = ""
    discovery_source: str = ""   # topic qui a déclenché la découverte
    collected_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Modèles traités (pipeline output)
# ---------------------------------------------------------------------------


class ProcessedRelease(BaseModel):
    """Release enrichie après traitement par le pipeline."""

    id: str                           # hash unique {owner}/{repo}@{tag}
    source: SourceType
    name: str                         # nom lisible : "polars/polars"
    tag: str
    version_major: int | None = None
    version_minor: int | None = None
    version_patch: int | None = None
    published_at: datetime | None = None
    category: str
    body_excerpt: str = ""            # 500 premiers caractères du changelog
    has_breaking_change: bool = False
    breaking_snippets: list[str] = Field(default_factory=list)
    impact_score: float = 0.0
    impact_level: ImpactLevel = ImpactLevel.UNKNOWN
    repo_weight: float = 1.0
    html_url: str = ""
    collected_at: datetime = Field(default_factory=datetime.utcnow)


class TrendEntry(BaseModel):
    """Entrée de tendance calculée sur une fenêtre glissante."""

    name: str
    category: str
    direction: TrendDirection
    release_count_window: int        # releases dans la fenêtre
    avg_days_between_releases: float | None = None
    latest_version: str | None = None
    latest_release_date: datetime | None = None
    score: float = 0.0


class SummaryReport(BaseModel):
    """Rapport de synthèse généré pour une release."""

    release_id: str
    lib_name: str
    version: str
    date: str                         # YYYY-MM
    changes: list[str] = Field(default_factory=list)
    impact: ImpactLevel
    breaking: bool = False
    category: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Réponses API
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str


class ReleasesResponse(BaseModel):
    total: int
    releases: list[ProcessedRelease]


class TrendsResponse(BaseModel):
    window_days: int
    trends: list[TrendEntry]


class ImpactResponse(BaseModel):
    total: int
    releases: list[ProcessedRelease]
