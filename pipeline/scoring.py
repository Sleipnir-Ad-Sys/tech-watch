"""
Scoring — calcule un score d'impact pour chaque release.

Nouveau moteur (v2) : analyse sémantique du contenu du changelog.

Le score technique est calculé à partir des catégories détectées dans
les release notes (breaking changes, sécurité, performance, etc.) et
pondérées selon config.yaml (section impact_analysis.changelog_weights).

Formule :
    technical_score = Σ (weight_catégorie × nb_occurrences)
    final_score     = technical_score × max(relevance_score, 1.0)

Classification :
    > 100 → CRITICAL | > 50 → HIGH | > 20 → MODERATE | ≤ 20 → LOW
"""

from __future__ import annotations

import polars as pl

from engine.impact_analyzer import ImpactScoreEngine
from logger import get_logger
from models import ImpactLevel

logger = get_logger(__name__)

# Instance partagée du moteur (chargé une seule fois par processus)
_engine = ImpactScoreEngine()


def _score_level(score: float) -> str:
    """
    Mappe un score vers un ImpactLevel.
    Conservé pour compatibilité avec les appels directs existants.
    """
    from engine.impact_analyzer import score_to_impact_level
    return score_to_impact_level(score).value


def compute_scores(
    df: pl.DataFrame,
    profiles: list[str] | None = None,
) -> pl.DataFrame:
    """
    Ajoute les colonnes d'impact au DataFrame via l'analyseur de changelog.

    Colonnes produites :
        impact_score        float  (= technical_score, alias de compatibilité)
        impact_level        str    (low / moderate / high / critical)
        technical_score     float
        relevance_score     float
        final_score         float
        detected_factors    str    (JSON)
        action_recommended  str
        analysis_reasons    list[str]

    Args:
        df:       DataFrame produit par transform.transform_releases()
        profiles: Profils utilisateur à appliquer pour le relevance_score.
                  Si None, utilise le(s) profil(s) par défaut de config.yaml.
    """
    if df.is_empty():
        return df.with_columns([
            pl.lit(0.0).alias("impact_score"),
            pl.lit(ImpactLevel.UNKNOWN.value).alias("impact_level"),
            pl.lit(0.0).alias("technical_score"),
            pl.lit(0.0).alias("relevance_score"),
            pl.lit(0.0).alias("final_score"),
            pl.lit("[]").alias("detected_factors"),
            pl.lit("").alias("action_recommended"),
            pl.lit(None).cast(pl.List(pl.Utf8)).alias("analysis_reasons"),
        ])

    df = _engine.analyze_dataframe(df, profiles=profiles)

    logger.info(
        "scoring.done",
        total=len(df),
        critical=len(df.filter(pl.col("impact_level") == ImpactLevel.CRITICAL.value)),
        high=len(df.filter(pl.col("impact_level") == ImpactLevel.HIGH.value)),
        moderate=len(df.filter(pl.col("impact_level") == ImpactLevel.MODERATE.value)),
    )

    return df

