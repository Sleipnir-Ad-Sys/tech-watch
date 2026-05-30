"""
Modèles Pydantic v2 partagés — définit les structures de données
utilisées par tous les modules (collectors, pipeline, engine, api).
"""

from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


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
    MODERATE = "moderate"
    MEDIUM = "medium"    # conservé pour compatibilité avec les données existantes
    LOW = "low"
    UNKNOWN = "unknown"


class ChangelogCategory(str, Enum):
    """Catégories détectées dans les changelogs."""
    SECURITY = "security"
    BREAKING_CHANGE = "breaking_change"
    DEPRECATED = "deprecated"
    REMOVED = "removed"
    MIGRATION = "migration"
    PERFORMANCE = "performance"
    ENHANCEMENT = "enhancement"
    BUG_FIX = "bug_fix"
    DOCUMENTATION = "documentation"


class UserProfile(str, Enum):
    """Profils utilisateur pour le calcul de pertinence."""
    DATA_ENGINEERING = "data_engineering"
    ANALYTICS_ENGINEERING = "analytics_engineering"
    PYTHON = "python"
    RUST = "rust"
    AI_LLM = "ai_llm"
    CLOUD = "cloud"
    FRONTEND = "frontend"


class UrgencyLevel(str, Enum):
    """Urgence métier, indépendante du score technique d'impact."""
    URGENT = "URGENT"   # Sécurité / CVE → action immédiate
    HIGH = "HIGH"       # Breaking change → planifier
    MEDIUM = "MEDIUM"   # Migration requise
    LOW = "LOW"         # Performance / bug fix / documentation


class ActionRecommended(str, Enum):
    """Action recommandée dérivée de l'impact + l'urgence."""
    UPGRADE_IMMEDIATELY = "URGENT"             # Urgence URGENT (sécurité)
    PLAN_MIGRATION = "PLANIFIER MIGRATION"     # Breaking change
    MONITOR_UPDATE = "METTRE À JOUR"          # Impact HIGH/CRITICAL, prochain cycle
    MONITOR = "SURVEILLER"                     # Changements notables non urgents
    IGNORE = "IGNORER"                         # Impact faible / aucun facteur


class TrendDirection(str, Enum):
    RISING = "rising"
    STABLE = "stable"
    DECLINING = "declining"


# ---------------------------------------------------------------------------
# Modèles d'analyse d'impact changelog
# ---------------------------------------------------------------------------


class DetectedFactor(BaseModel):
    """Facteur détecté dans un changelog avec son score."""
    category: ChangelogCategory
    count: int
    score_contribution: float
    snippets: list[str] = Field(default_factory=list)


class ReleaseImpactScore(BaseModel):
    """Score d'impact complet calculé par le moteur d'analyse."""
    release_id: str
    technical_score: float = 0.0
    relevance_score: float = 0.0
    final_score: float = 0.0
    impact_level: ImpactLevel = ImpactLevel.UNKNOWN
    urgency_level: UrgencyLevel = UrgencyLevel.LOW
    profiles: list[str] = Field(default_factory=list)
    detected_factors: list[DetectedFactor] = Field(default_factory=list)
    action_recommended: ActionRecommended = ActionRecommended.IGNORE
    reasons: list[str] = Field(default_factory=list)
    # Réservé pour analyse LLM future — ne pas modifier le modèle lors de l'intégration
    llm_analysis: dict[str, Any] | None = None
    computed_at: datetime = Field(default_factory=datetime.utcnow)


class ImpactScoreHistoryEntry(BaseModel):
    """Entrée d'historique pour la comparaison des scores entre releases."""
    release_id: str
    project_name: str
    tag: str
    computed_at: datetime = Field(default_factory=datetime.utcnow)
    technical_score: float
    relevance_score: float
    final_score: float
    profiles: list[str] = Field(default_factory=list)
    impact_level: ImpactLevel


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
    body_excerpt: str = ""            # jusqu'à 2000 caractères du changelog
    has_breaking_change: bool = False
    breaking_snippets: list[str] = Field(default_factory=list)
    # Scores — impact_score est le technical_score (alias de compatibilité)
    impact_score: float = 0.0
    impact_level: ImpactLevel = ImpactLevel.UNKNOWN
    repo_weight: float = 1.0
    html_url: str = ""
    collected_at: datetime = Field(default_factory=datetime.utcnow)
    # Champs d'analyse d'impact changelog (nouveau moteur)
    technical_score: float = 0.0
    relevance_score: float = 0.0
    final_score: float = 0.0
    detected_factors: list[DetectedFactor] = Field(default_factory=list)
    action_recommended: str = ""
    analysis_reasons: list[str] = Field(default_factory=list)

    @field_validator("detected_factors", mode="before")
    @classmethod
    def parse_detected_factors(cls, v: Any) -> list[DetectedFactor]:
        """Désérialise detected_factors depuis une chaîne JSON (stockage DuckDB)."""
        if isinstance(v, str):
            try:
                data = json.loads(v)
                return [DetectedFactor.model_validate(item) for item in data]
            except Exception:
                return []
        if v is None:
            return []
        return v

    @field_validator("analysis_reasons", mode="before")
    @classmethod
    def parse_analysis_reasons(cls, v: Any) -> list[str]:
        """Normalise analysis_reasons — accepte None ou liste."""
        if v is None:
            return []
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v] if v else []
        return list(v)


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


class ImpactAnalysisResponse(BaseModel):
    """Réponse de l'endpoint d'analyse d'impact."""
    release_id: str
    project_name: str
    tag: str
    impact: ReleaseImpactScore


class ProfilesResponse(BaseModel):
    """Réponse listant les profils disponibles."""
    profiles: list[dict[str, Any]]
