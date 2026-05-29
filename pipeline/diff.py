"""
Diff — détecte les nouvelles entrées entre deux runs du pipeline.

Compare le DataFrame courant avec les données stockées en DuckDB
pour identifier uniquement les nouvelles releases non encore vues.

Utilise les IDs sha256 calculés dans transform.py.
"""

from __future__ import annotations

import polars as pl

from logger import get_logger
from pipeline.storage import load_releases_from_db

logger = get_logger(__name__)


def find_new_releases(current_df: pl.DataFrame) -> pl.DataFrame:
    """
    Retourne les releases présentes dans current_df mais absentes de la DB.

    Args:
        current_df: DataFrame du run courant (avec colonne 'id')

    Returns:
        DataFrame ne contenant que les nouvelles releases
    """
    if current_df.is_empty():
        return current_df

    try:
        existing_df = load_releases_from_db()
    except Exception as exc:
        logger.warning("diff.load_db_failed", error=str(exc))
        # Si la DB est vide ou inexistante, tout est nouveau
        return current_df

    if existing_df.is_empty():
        logger.info("diff.all_new", count=len(current_df))
        return current_df

    existing_ids = set(existing_df["id"].to_list())
    current_ids = set(current_df["id"].to_list())

    new_ids = current_ids - existing_ids
    new_df = current_df.filter(pl.col("id").is_in(list(new_ids)))

    logger.info(
        "diff.result",
        current=len(current_df),
        existing=len(existing_df),
        new=len(new_df),
    )

    return new_df
