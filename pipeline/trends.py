"""
Trends — détection de tendances sur une fenêtre glissante.

Calcule pour chaque projet :
- Nombre de releases dans la fenêtre (défaut 30 jours)
- Moyenne de jours entre releases
- Direction de tendance : RISING / STABLE / DECLINING

Utilise Polars pour les calculs agrégés sur le DataFrame de releases.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import polars as pl

from config import load_config
from logger import get_logger
from models import TrendDirection, TrendEntry

logger = get_logger(__name__)


def compute_trends(df: pl.DataFrame, window_days: int | None = None) -> list[TrendEntry]:
    """
    Calcule les tendances à partir du DataFrame de releases enrichi.

    Args:
        df: DataFrame produit par scoring.compute_scores()
        window_days: Fenêtre glissante en jours (défaut depuis config)

    Returns:
        Liste de TrendEntry triée par score décroissant
    """
    if df.is_empty():
        return []

    cfg = load_config()
    days = window_days or cfg.scoring.trend_window_days
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Filtre sur la fenêtre temporelle
    df_window = df.filter(
        pl.col("published_at").is_not_null()
        & (pl.col("published_at") >= cutoff)
    )

    # Agrégation par projet
    agg_df = (
        df.sort("published_at", descending=True, nulls_last=True)
        .group_by("name")
        .agg([
            pl.col("tag").first().alias("latest_version"),
            pl.col("published_at").first().alias("latest_date"),
            pl.col("category").first().alias("category"),
            pl.col("impact_score").mean().alias("avg_score"),
        ])
    )

    # Compte des releases dans la fenêtre
    window_counts = (
        df_window.group_by("name")
        .agg(pl.count().alias("release_count_window"))
    )

    agg_df = agg_df.join(window_counts, on="name", how="left").with_columns(
        pl.col("release_count_window").fill_null(0)
    )

    # Calcul de la moyenne de jours entre releases (toutes releases confondues)
    avg_days_df = _compute_avg_days_between_releases(df)
    agg_df = agg_df.join(avg_days_df, on="name", how="left")

    # Direction de tendance
    trends: list[TrendEntry] = []

    for row in agg_df.iter_rows(named=True):
        direction = _determine_direction(
            release_count=row["release_count_window"],
            avg_days=row.get("avg_days_between_releases"),
        )

        latest_date = row.get("latest_date")
        if isinstance(latest_date, str):
            try:
                latest_date = datetime.fromisoformat(latest_date)
            except ValueError:
                latest_date = None

        trends.append(TrendEntry(
            name=row["name"],
            category=row.get("category", ""),
            direction=direction,
            release_count_window=int(row["release_count_window"]),
            avg_days_between_releases=row.get("avg_days_between_releases"),
            latest_version=row.get("latest_version"),
            latest_release_date=latest_date,
            score=float(row.get("avg_score") or 0.0),
        ))

    # Trier : RISING en premier, puis par score décroissant
    trends.sort(key=lambda t: (t.direction != TrendDirection.RISING, -t.score))

    logger.info("trends.done", total=len(trends), window_days=days)
    return trends


def _compute_avg_days_between_releases(df: pl.DataFrame) -> pl.DataFrame:
    """
    Calcule la moyenne de jours entre les releases consécutives par projet.
    Retourne un DataFrame avec colonnes [name, avg_days_between_releases].
    """
    df_sorted = (
        df.filter(pl.col("published_at").is_not_null())
        .sort(["name", "published_at"])
    )

    # Calcul du diff entre dates consécutives par groupe
    df_with_prev = df_sorted.with_columns(
        pl.col("published_at").shift(1).over("name").alias("prev_date")
    )

    df_diffs = df_with_prev.filter(pl.col("prev_date").is_not_null()).with_columns(
        (
            (pl.col("published_at") - pl.col("prev_date")).dt.total_days()
        ).abs().alias("days_diff")
    )

    avg_df = (
        df_diffs.group_by("name")
        .agg(pl.col("days_diff").mean().alias("avg_days_between_releases"))
    )

    return avg_df


def _determine_direction(
    release_count: int,
    avg_days: float | None,
) -> TrendDirection:
    """
    Détermine la direction de tendance selon des seuils simples.

    Règles :
    - RISING  : >= 3 releases dans la fenêtre OU avg_days <= 14
    - DECLINING : 0 release dans la fenêtre ET avg_days > 90
    - STABLE  : sinon
    """
    if release_count >= 3 or (avg_days is not None and avg_days <= 14):
        return TrendDirection.RISING
    if release_count == 0 and (avg_days is None or avg_days > 90):
        return TrendDirection.DECLINING
    return TrendDirection.STABLE
