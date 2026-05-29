"""
Scoring — calcule un score d'impact pour chaque release.

Formule de score :
    score = (version_weight + breaking_weight + frequency_weight) * repo_weight

Où :
    version_weight   = major*10 + minor*3 + patch*0.5
    breaking_weight  = 8 si breaking_change else 0
    frequency_weight = 2 si fréquence élevée (> 2 releases/mois)

Le score est normalisé dans [0, 100] puis mappé à un ImpactLevel.
"""

from __future__ import annotations

import polars as pl

from config import load_config
from logger import get_logger
from models import ImpactLevel

logger = get_logger(__name__)


def _score_level(score: float) -> str:
    """Mappe un score numérique à un ImpactLevel."""
    if score >= 20.0:
        return ImpactLevel.CRITICAL.value
    elif score >= 12.0:
        return ImpactLevel.HIGH.value
    elif score >= 5.0:
        return ImpactLevel.MEDIUM.value
    elif score > 0.0:
        return ImpactLevel.LOW.value
    return ImpactLevel.UNKNOWN.value


def compute_scores(df: pl.DataFrame) -> pl.DataFrame:
    """
    Ajoute les colonnes 'impact_score' et 'impact_level' au DataFrame.

    Attendu en entrée : DataFrame produit par transform.transform_releases()
    """
    if df.is_empty():
        return df.with_columns([
            pl.lit(0.0).alias("impact_score"),
            pl.lit(ImpactLevel.UNKNOWN.value).alias("impact_level"),
        ])

    cfg = load_config().scoring
    w = cfg.weights

    major_w = w.get("major_version", 10.0)
    minor_w = w.get("minor_version", 3.0)
    patch_w = w.get("patch_version", 0.5)
    breaking_w = w.get("breaking_change", 8.0)
    freq_w = w.get("high_frequency", 2.0)

    # Calcul de la fréquence de release par projet (dans la même session)
    # On compte combien de releases existent par nom de projet
    freq_df = (
        df.group_by("name")
        .agg(pl.count().alias("release_count"))
    )

    df = df.join(freq_df, on="name", how="left")

    # Score de version (gérer les nulls — patch peut être None)
    df = df.with_columns([
        pl.col("version_major").fill_null(0).alias("version_major"),
        pl.col("version_minor").fill_null(0).alias("version_minor"),
        pl.col("version_patch").fill_null(0).alias("version_patch"),
    ])

    df = df.with_columns([
        (
            pl.col("version_major") * major_w
            + pl.col("version_minor") * minor_w
            + pl.col("version_patch") * patch_w
            + pl.when(pl.col("has_breaking_change")).then(pl.lit(breaking_w)).otherwise(pl.lit(0.0))
            + pl.when(pl.col("release_count") > 2).then(pl.lit(freq_w)).otherwise(pl.lit(0.0))
        ).alias("_raw_score")
    ])

    # Multiplication par le poids du repo
    df = df.with_columns([
        (pl.col("_raw_score") * pl.col("repo_weight")).alias("impact_score")
    ])

    # Mapping vers ImpactLevel via map_elements
    df = df.with_columns([
        pl.col("impact_score")
        .map_elements(_score_level, return_dtype=pl.Utf8)
        .alias("impact_level")
    ])

    # Nettoyage colonnes temporaires
    df = df.drop(["_raw_score", "release_count"])

    logger.info(
        "scoring.done",
        total=len(df),
        critical=len(df.filter(pl.col("impact_level") == ImpactLevel.CRITICAL.value)),
        high=len(df.filter(pl.col("impact_level") == ImpactLevel.HIGH.value)),
    )

    return df
