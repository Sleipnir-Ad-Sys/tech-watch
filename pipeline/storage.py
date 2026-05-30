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

# Schéma DDL de la table releases (incluant les colonnes d'analyse d'impact)
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
    impact_score        DOUBLE DEFAULT 0.0,
    impact_level        VARCHAR DEFAULT 'unknown',
    repo_weight         DOUBLE DEFAULT 1.0,
    html_url            VARCHAR,
    collected_at        TIMESTAMP,
    -- Colonnes d'analyse d'impact changelog (moteur v2)
    technical_score     DOUBLE DEFAULT 0.0,
    relevance_score     DOUBLE DEFAULT 0.0,
    final_score         DOUBLE DEFAULT 0.0,
    detected_factors    TEXT,
    action_recommended  VARCHAR,
    analysis_reasons    TEXT[]
)
"""

# Historique des scores d'impact pour comparaison entre releases
_CREATE_IMPACT_HISTORY_SQL = """
CREATE TABLE IF NOT EXISTS impact_score_history (
    id              VARCHAR NOT NULL,
    release_id      VARCHAR NOT NULL,
    project_name    VARCHAR NOT NULL,
    tag             VARCHAR NOT NULL,
    computed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    technical_score DOUBLE DEFAULT 0.0,
    relevance_score DOUBLE DEFAULT 0.0,
    final_score     DOUBLE DEFAULT 0.0,
    profiles        TEXT[],
    impact_level    VARCHAR DEFAULT 'unknown',
    PRIMARY KEY (release_id, computed_at)
)
"""

# Migrations pour les bases existantes (ADD COLUMN IF NOT EXISTS)
_MIGRATION_SQL = [
    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS technical_score    DOUBLE  DEFAULT 0.0",
    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS relevance_score    DOUBLE  DEFAULT 0.0",
    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS final_score        DOUBLE  DEFAULT 0.0",
    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS detected_factors   TEXT",
    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS action_recommended VARCHAR",
    "ALTER TABLE releases ADD COLUMN IF NOT EXISTS analysis_reasons   TEXT[]",
]

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
    """Crée les tables DuckDB et applique les migrations si nécessaire."""
    db_path = get_db_path()
    with duckdb.connect(str(db_path)) as con:
        con.execute(_CREATE_RELEASES_SQL)
        con.execute(_CREATE_ARTICLES_SQL)
        con.execute(_CREATE_IMPACT_HISTORY_SQL)
        # Migration des colonnes manquantes pour les DBs existantes
        for stmt in _MIGRATION_SQL:
            try:
                con.execute(stmt)
            except Exception:
                pass  # La colonne existe déjà
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

    # S'assurer que les colonnes d'analyse existent (valeurs par défaut si absentes)
    for col, dtype, default in [
        ("technical_score",    pl.Float64,       0.0),
        ("relevance_score",    pl.Float64,       0.0),
        ("final_score",        pl.Float64,       0.0),
        ("detected_factors",   pl.Utf8,          "[]"),
        ("action_recommended", pl.Utf8,          ""),
        ("analysis_reasons",   pl.List(pl.Utf8), None),
    ]:
        if col not in df.columns:
            if dtype == pl.List(pl.Utf8):
                df = df.with_columns(pl.lit(None).cast(pl.List(pl.Utf8)).alias(col))
            else:
                df = df.with_columns(pl.lit(default).cast(dtype).alias(col))

    with duckdb.connect(str(db_path)) as con:
        con.register("staging", df.to_arrow())
        con.execute("""
            INSERT INTO releases (
                id, source, name, tag,
                version_major, version_minor, version_patch,
                published_at, category, body_excerpt,
                has_breaking_change, breaking_snippets,
                impact_score, impact_level,
                repo_weight, html_url, collected_at,
                technical_score, relevance_score, final_score,
                detected_factors, action_recommended, analysis_reasons
            )
            SELECT
                id, source, name, tag,
                version_major, version_minor, version_patch,
                published_at, category, body_excerpt,
                has_breaking_change, breaking_snippets,
                impact_score, impact_level,
                repo_weight, html_url, collected_at,
                technical_score, relevance_score, final_score,
                detected_factors, action_recommended, analysis_reasons
            FROM staging
            ON CONFLICT (id) DO UPDATE SET
                impact_score        = excluded.impact_score,
                impact_level        = excluded.impact_level,
                has_breaking_change = excluded.has_breaking_change,
                breaking_snippets   = excluded.breaking_snippets,
                body_excerpt        = excluded.body_excerpt,
                technical_score     = excluded.technical_score,
                relevance_score     = excluded.relevance_score,
                final_score         = excluded.final_score,
                detected_factors    = excluded.detected_factors,
                action_recommended  = excluded.action_recommended,
                analysis_reasons    = excluded.analysis_reasons,
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


def save_impact_history(
    df: pl.DataFrame,
    profiles: list[str] | None = None,
) -> int:
    """
    Sauvegarde une entrée d'historique des scores d'impact pour chaque release.
    Permet la comparaison des impacts entre releases.

    Args:
        df:       DataFrame contenant les releases avec scores calculés
        profiles: Profils utilisateur utilisés pour le calcul

    Returns:
        Nombre de lignes insérées
    """
    if df.is_empty():
        return 0

    required = {"id", "name", "tag", "technical_score", "relevance_score", "final_score", "impact_level"}
    if not required.issubset(set(df.columns)):
        logger.warning("storage.history_skip", reason="colonnes manquantes")
        return 0

    import hashlib
    from datetime import datetime as _dt

    db_path = get_db_path()
    now = _dt.utcnow().isoformat()
    profiles_val = profiles or []

    rows = []
    for row in df.iter_rows(named=True):
        uid_raw = f"{row['id']}_{now}"
        uid = hashlib.sha256(uid_raw.encode()).hexdigest()[:20]
        rows.append({
            "id": uid,
            "release_id": row["id"],
            "project_name": row.get("name", ""),
            "tag": row.get("tag", ""),
            "computed_at": now,
            "technical_score": float(row.get("technical_score", 0.0)),
            "relevance_score": float(row.get("relevance_score", 0.0)),
            "final_score": float(row.get("final_score", 0.0)),
            "profiles": profiles_val,
            "impact_level": row.get("impact_level", "unknown"),
        })

    history_df = pl.DataFrame(rows)

    with duckdb.connect(str(db_path)) as con:
        con.register("history_staging", history_df.to_arrow())
        con.execute("""
            INSERT INTO impact_score_history
                (id, release_id, project_name, tag, computed_at,
                 technical_score, relevance_score, final_score, profiles, impact_level)
            SELECT
                id, release_id, project_name, tag, computed_at::TIMESTAMP,
                technical_score, relevance_score, final_score, profiles, impact_level
            FROM history_staging
            ON CONFLICT DO NOTHING
        """)

    logger.info("storage.history_saved", rows=len(rows))
    return len(rows)


def load_impact_history(
    release_id: str | None = None,
    project_name: str | None = None,
    limit: int = 100,
) -> pl.DataFrame:
    """
    Charge l'historique des scores d'impact pour comparaison entre releases.

    Args:
        release_id:   Filtre sur une release spécifique
        project_name: Filtre sur un projet
        limit:        Nombre max de résultats

    Returns:
        DataFrame Polars trié par computed_at décroissant
    """
    db_path = get_db_path()
    if not db_path.exists():
        return pl.DataFrame()

    conditions = ["1=1"]
    if release_id:
        conditions.append(f"release_id = '{release_id}'")
    if project_name:
        conditions.append(f"project_name ILIKE '%{project_name}%'")

    where = " AND ".join(conditions)
    query = f"""
        SELECT *
        FROM impact_score_history
        WHERE {where}
        ORDER BY computed_at DESC
        LIMIT {limit}
    """

    with duckdb.connect(str(db_path), read_only=True) as con:
        result = con.execute(query).fetchdf()

    return pl.from_pandas(result)
