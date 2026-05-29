"""
Storage — couche d'accès DuckDB + Parquet.

Responsabilités :
- Création et migration du schéma DuckDB
- Insertion / upsert des releases
- Export Parquet intermédiaire
- Chargement pour le pipeline et l'API
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl

from config import load_config
from logger import get_logger

logger = get_logger(__name__)

# Schéma DDL de la table releases
_CREATE_RELEASES_SQL = """
CREATE TABLE IF NOT EXISTS releases (
    id               VARCHAR PRIMARY KEY,
    source           VARCHAR NOT NULL,
    name             VARCHAR NOT NULL,
    tag              VARCHAR NOT NULL,
    version_major    INTEGER,
    version_minor    INTEGER,
    version_patch    INTEGER,
    published_at     TIMESTAMP,
    category         VARCHAR,
    body_excerpt     TEXT,
    has_breaking_change BOOLEAN DEFAULT FALSE,
    breaking_snippets   TEXT[],
    impact_score     DOUBLE DEFAULT 0.0,
    impact_level     VARCHAR DEFAULT 'unknown',
    repo_weight      DOUBLE DEFAULT 1.0,
    html_url         VARCHAR,
    collected_at     TIMESTAMP
)
"""

_CREATE_ARTICLES_SQL = """
CREATE TABLE IF NOT EXISTS articles (
    id           VARCHAR PRIMARY KEY,
    source       VARCHAR NOT NULL,
    feed_name    VARCHAR,
    title        VARCHAR NOT NULL,
    url          VARCHAR NOT NULL,
    summary      TEXT,
    published_at TIMESTAMP,
    category     VARCHAR,
    collected_at TIMESTAMP
)
"""


def get_db_path() -> Path:
    """Retourne le chemin absolu vers le fichier DuckDB."""
    cfg = load_config()
    path = Path(cfg.paths.warehouse)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def init_db() -> None:
    """Crée les tables DuckDB si elles n'existent pas encore."""
    db_path = get_db_path()
    with duckdb.connect(str(db_path)) as con:
        con.execute(_CREATE_RELEASES_SQL)
        con.execute(_CREATE_ARTICLES_SQL)
    logger.info("storage.db_initialized", path=str(db_path))


def upsert_releases(df: pl.DataFrame) -> int:
    """
    Insère ou met à jour les releases dans DuckDB.
    Utilise INSERT OR REPLACE (ON CONFLICT DO UPDATE).

    Returns:
        Nombre de lignes insérées/mises à jour
    """
    if df.is_empty():
        return 0

    db_path = get_db_path()

    with duckdb.connect(str(db_path)) as con:
        # DuckDB peut lire directement un DataFrame Polars via Arrow
        con.register("staging", df.to_arrow())
        result = con.execute("""
            INSERT INTO releases (
                id, source, name, tag,
                version_major, version_minor, version_patch,
                published_at, category, body_excerpt,
                has_breaking_change, breaking_snippets,
                impact_score, impact_level,
                repo_weight, html_url, collected_at
            )
            SELECT
                id, source, name, tag,
                version_major, version_minor, version_patch,
                published_at, category, body_excerpt,
                has_breaking_change, breaking_snippets,
                impact_score, impact_level,
                repo_weight, html_url, collected_at
            FROM staging
            ON CONFLICT (id) DO UPDATE SET
                impact_score        = excluded.impact_score,
                impact_level        = excluded.impact_level,
                has_breaking_change = excluded.has_breaking_change,
                breaking_snippets   = excluded.breaking_snippets,
                collected_at        = excluded.collected_at
        """)
        count = len(df)

    logger.info("storage.upsert_done", rows=len(df), changed=count)
    return count


def load_releases_from_db(
    limit: int = 500,
    category: str | None = None,
    impact_level: str | None = None,
) -> pl.DataFrame:
    """
    Charge les releases depuis DuckDB.

    Args:
        limit: Nombre maximum de résultats
        category: Filtre optionnel par catégorie
        impact_level: Filtre optionnel par niveau d'impact

    Returns:
        DataFrame Polars trié par published_at décroissant
    """
    db_path = get_db_path()

    if not db_path.exists():
        logger.warning("storage.db_not_found", path=str(db_path))
        return pl.DataFrame()

    conditions = ["1=1"]
    if category:
        conditions.append(f"category = '{category}'")
    if impact_level:
        conditions.append(f"impact_level = '{impact_level}'")

    where = " AND ".join(conditions)
    query = f"""
        SELECT *
        FROM releases
        WHERE {where}
        ORDER BY published_at DESC NULLS LAST
        LIMIT {limit}
    """

    with duckdb.connect(str(db_path), read_only=True) as con:
        result = con.execute(query).fetchdf()

    return pl.from_pandas(result)


def export_to_parquet(df: pl.DataFrame, name: str = "releases") -> Path:
    """
    Exporte un DataFrame en fichier Parquet dans data/processed/.

    Args:
        df: DataFrame à exporter
        name: Nom de base du fichier (sans extension)

    Returns:
        Chemin du fichier créé
    """
    cfg = load_config()
    processed_dir = Path(cfg.paths.processed_dir)
    processed_dir.mkdir(parents=True, exist_ok=True)

    path = processed_dir / f"{name}.parquet"
    df.write_parquet(str(path))

    logger.info("storage.parquet_exported", path=str(path), rows=len(df))
    return path


def load_from_parquet(name: str = "releases") -> pl.DataFrame:
    """Charge un fichier Parquet depuis data/processed/."""
    cfg = load_config()
    path = Path(cfg.paths.processed_dir) / f"{name}.parquet"

    if not path.exists():
        logger.warning("storage.parquet_not_found", path=str(path))
        return pl.DataFrame()

    return pl.read_parquet(str(path))
