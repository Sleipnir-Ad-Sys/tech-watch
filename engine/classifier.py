"""
Classifier — applique le RuleEngine sur un DataFrame de releases Polars.

Prend en entrée le DataFrame produit par pipeline/scoring.py
et retourne un DataFrame enrichi avec les colonnes finales
impact_score et impact_level recalculées par le moteur de règles.
"""

from __future__ import annotations

import polars as pl

from engine.rules import RuleContext, RuleEngine
from logger import get_logger
from models import ImpactLevel

logger = get_logger(__name__)


def classify_releases(df: pl.DataFrame) -> pl.DataFrame:
    """
    Applique le RuleEngine à chaque release du DataFrame.

    Args:
        df: DataFrame produit par pipeline/scoring.compute_scores()

    Returns:
        DataFrame avec impact_score et impact_level mis à jour
    """
    if df.is_empty():
        return df

    engine = RuleEngine()
    updated_scores: list[float] = []
    updated_levels: list[str] = []

    for row in df.iter_rows(named=True):
        ctx = RuleContext(
            name=row.get("name", ""),
            tag=row.get("tag", ""),
            version_major=row.get("version_major"),
            version_minor=row.get("version_minor"),
            version_patch=row.get("version_patch"),
            has_breaking_change=bool(row.get("has_breaking_change", False)),
            body_excerpt=row.get("body_excerpt", ""),
            category=row.get("category", ""),
            impact_score=float(row.get("impact_score", 0.0)),
            impact_level=row.get("impact_level", ImpactLevel.UNKNOWN.value),
        )
        score, level = engine.evaluate(ctx)
        updated_scores.append(score)
        updated_levels.append(level)

    df = df.with_columns([
        pl.Series("impact_score", updated_scores, dtype=pl.Float64),
        pl.Series("impact_level", updated_levels, dtype=pl.Utf8),
    ])

    logger.info(
        "classifier.done",
        total=len(df),
        critical=len(df.filter(pl.col("impact_level") == ImpactLevel.CRITICAL.value)),
        high=len(df.filter(pl.col("impact_level") == ImpactLevel.HIGH.value)),
    )

    return df
