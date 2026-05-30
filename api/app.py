"""
FastAPI Application — API REST pour exposer les données de veille.

Endpoints :
    GET /           → health check
    GET /releases   → dernières releases (filtres: category, impact, limit)
    GET /trends     → tendances calculées
    GET /impact     → releases par niveau d'impact
    GET /summary/{id} → résumé d'une release spécifique

CORS configuré pour GitHub Pages et dev local.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import load_config
from engine.summarizer import generate_summary
from logger import configure_logging, get_logger
from models import (
    HealthResponse,
    ImpactAnalysisResponse,
    ImpactLevel,
    ImpactResponse,
    ProcessedRelease,
    ProfilesResponse,
    ReleasesResponse,
    SummaryReport,
    TrendsResponse,
)
from pipeline.storage import load_releases_from_db, load_impact_history
from pipeline.trends import compute_trends

configure_logging()
logger = get_logger(__name__)

cfg = load_config()

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Tech Watch API",
    description="API de veille technologique — Data Engineering, IA, Rust & Modern Backend",
    version=cfg.app.version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — autorise GitHub Pages et dev local
app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.api.cors_origins + ["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Health check — vérifie que l'API est opérationnelle."""
    return HealthResponse(status="ok", version=cfg.app.version)


@app.get("/releases", response_model=ReleasesResponse, tags=["data"])
async def get_releases(
    limit: int = Query(default=20, ge=1, le=cfg.api.max_results),
    category: str | None = Query(default=None, description="Filtre par catégorie"),
    impact: str | None = Query(default=None, description="Filtre par niveau d'impact"),
    source: str | None = Query(default=None, description="Filtre par source (github/pypi/rss)"),
) -> ReleasesResponse:
    """
    Retourne les dernières releases triées par date décroissante.

    Paramètres optionnels :
    - `category` : data-engineering, ai, backend, lakehouse, tooling…
    - `impact` : critical, high, medium, low
    - `source` : github, pypi, rss
    - `limit` : nombre max de résultats (défaut 20)
    """
    df = load_releases_from_db(
        limit=limit,
        category=category,
        impact_level=impact,
    )

    if not df.is_empty() and source:
        import polars as pl
        df = df.filter(pl.col("source") == source)

    releases = _df_to_processed_releases(df)

    return ReleasesResponse(total=len(releases), releases=releases)


@app.get("/trends", response_model=TrendsResponse, tags=["data"])
async def get_trends(
    window_days: int = Query(default=30, ge=7, le=365),
) -> TrendsResponse:
    """
    Retourne les tendances calculées sur une fenêtre glissante.

    - `window_days` : fenêtre en jours (défaut 30)
    """
    df = load_releases_from_db(limit=1000)
    trends = compute_trends(df, window_days=window_days)

    return TrendsResponse(window_days=window_days, trends=trends)


@app.get("/impact", response_model=ImpactResponse, tags=["data"])
async def get_impact(
    level: str = Query(default="high", description="Niveau minimum : critical, high, medium"),
    limit: int = Query(default=20, ge=1, le=cfg.api.max_results),
) -> ImpactResponse:
    """
    Retourne les releases filtrées par niveau d'impact.

    - `level` : critical | high | medium | low
    """
    valid_levels = {lvl.value for lvl in ImpactLevel}
    if level not in valid_levels:
        raise HTTPException(
            status_code=400,
            detail=f"Niveau invalide. Valeurs acceptées : {', '.join(valid_levels)}",
        )

    df = load_releases_from_db(limit=limit, impact_level=level)
    releases = _df_to_processed_releases(df)

    return ImpactResponse(total=len(releases), releases=releases)


@app.get("/summary/{release_id}", response_model=SummaryReport, tags=["data"])
async def get_summary(release_id: str) -> SummaryReport:
    """
    Retourne le résumé textuel d'une release par son identifiant.
    """
    import polars as pl

    df = load_releases_from_db(limit=1000)

    if df.is_empty():
        raise HTTPException(status_code=404, detail="Aucune release trouvée")

    filtered = df.filter(pl.col("id") == release_id)

    if filtered.is_empty():
        raise HTTPException(
            status_code=404,
            detail=f"Release {release_id!r} introuvable",
        )

    row = filtered.row(0, named=True)
    release = _row_to_processed_release(row)
    return generate_summary(release)


@app.get("/profiles", response_model=ProfilesResponse, tags=["impact"])
async def get_profiles() -> ProfilesResponse:
    """
    Retourne la liste des profils utilisateur disponibles pour le calcul de pertinence.
    """
    from engine.impact_analyzer import ProfileEngine
    engine = ProfileEngine()
    return ProfilesResponse(profiles=engine.list_profiles())


@app.get("/releases/{release_id}/impact", response_model=ImpactAnalysisResponse, tags=["impact"])
async def get_release_impact(
    release_id: str,
    profiles: str = Query(
        default="",
        description="Profils séparés par virgule : data_engineering,python,rust…",
    ),
) -> ImpactAnalysisResponse:
    """
    Analyse l'impact d'une release spécifique selon les profils sélectionnés.

    - `release_id` : identifiant SHA de la release
    - `profiles`   : profils séparés par virgule (ex: data_engineering,python)
    """
    import polars as pl
    from engine.impact_analyzer import ImpactScoreEngine

    df = load_releases_from_db(limit=10000)
    if df.is_empty():
        raise HTTPException(status_code=404, detail="Aucune release trouvée")

    filtered = df.filter(pl.col("id") == release_id)
    if filtered.is_empty():
        raise HTTPException(status_code=404, detail=f"Release {release_id!r} introuvable")

    row = filtered.row(0, named=True)
    active_profiles = [p.strip() for p in profiles.split(",") if p.strip()] or None

    engine = ImpactScoreEngine()
    impact = engine.analyze(
        release_id=release_id,
        project_name=row.get("name", ""),
        changelog_text=row.get("body_excerpt", ""),
        profiles=active_profiles,
    )

    return ImpactAnalysisResponse(
        release_id=release_id,
        project_name=row.get("name", ""),
        tag=row.get("tag", ""),
        impact=impact,
    )


@app.get("/impact/history", tags=["impact"])
async def get_impact_history(
    project: str | None = Query(default=None, description="Filtre par nom de projet"),
    limit: int = Query(default=50, ge=1, le=200),
) -> JSONResponse:
    """
    Retourne l'historique des scores d'impact pour comparaison entre releases.

    - `project` : filtre partiel sur le nom du projet
    - `limit`   : nombre max de résultats
    """
    df = load_impact_history(project_name=project, limit=limit)

    if df.is_empty():
        return JSONResponse({"total": 0, "history": []})

    history = []
    for row in df.iter_rows(named=True):
        entry = {}
        for k, v in row.items():
            if hasattr(v, "isoformat"):
                entry[k] = v.isoformat()
            elif isinstance(v, list):
                entry[k] = v
            else:
                entry[k] = v
        history.append(entry)

    return JSONResponse({"total": len(history), "history": history})


@app.get("/stats", tags=["data"])
async def get_stats() -> JSONResponse:    """
    Retourne des statistiques globales sur le dataset.
    """
    import polars as pl

    df = load_releases_from_db(limit=10000)

    if df.is_empty():
        return JSONResponse({"total": 0, "by_category": {}, "by_impact": {}, "by_source": {}})

    by_category = df.group_by("category").agg(pl.count().alias("count")).sort("count", descending=True)
    by_impact = df.group_by("impact_level").agg(pl.count().alias("count")).sort("count", descending=True)
    by_source = df.group_by("source").agg(pl.count().alias("count")).sort("count", descending=True)

    return JSONResponse({
        "total": len(df),
        "by_category": dict(zip(
            by_category["category"].to_list(),
            by_category["count"].to_list(),
        )),
        "by_impact": dict(zip(
            by_impact["impact_level"].to_list(),
            by_impact["count"].to_list(),
        )),
        "by_source": dict(zip(
            by_source["source"].to_list(),
            by_source["count"].to_list(),
        )),
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _df_to_processed_releases(df) -> list[ProcessedRelease]:
    """Convertit un DataFrame Polars en liste de ProcessedRelease."""
    if df.is_empty():
        return []
    return [_row_to_processed_release(row) for row in df.iter_rows(named=True)]


def _row_to_processed_release(row: dict) -> ProcessedRelease:
    """Convertit une ligne dict en ProcessedRelease Pydantic."""
    return ProcessedRelease.model_validate(row)


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.app:app",
        host=cfg.api.host,
        port=cfg.api.port,
        reload=True,
        log_level="info",
    )
