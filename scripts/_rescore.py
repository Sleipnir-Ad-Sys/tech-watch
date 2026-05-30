"""
Script de re-scoring des releases existantes avec le nouveau moteur.
Met à jour data.json en appliquant l'analyse sémantique du changelog
sur toutes les releases stockées dans DuckDB.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import duckdb
import polars as pl

from engine.impact_analyzer import ImpactScoreEngine
from logger import get_logger

logger = get_logger(__name__)

DB_PATH = Path("data/warehouse.duckdb")
DATA_JSON = Path("web/data.json")
PROFILES = ["data_engineering"]


def _load_from_db() -> pl.DataFrame:
    with duckdb.connect(str(DB_PATH), read_only=True) as con:
        arrow = con.execute(
            "SELECT * FROM releases ORDER BY published_at DESC"
        ).arrow()
    return pl.from_arrow(arrow)


def _rescore(df: pl.DataFrame) -> pl.DataFrame:
    engine = ImpactScoreEngine()
    df = engine.analyze_dataframe(df, profiles=PROFILES)
    return df


def _to_json_safe(val):
    """Convertit les types Polars / Python en types JSON-serialisables."""
    if val is None:
        return None
    if isinstance(val, float) and (val != val):  # NaN check
        return None
    return val


def _export(df: pl.DataFrame) -> None:
    # Charge l'ancien data.json pour garder trends / discoveries
    old_trends: list = []
    old_discoveries: list = []
    if DATA_JSON.exists():
        try:
            old = json.loads(DATA_JSON.read_text(encoding="utf-8"))
            old_trends = old.get("trends", [])
            old_discoveries = old.get("discoveries", [])
        except Exception:
            pass

    releases = []
    for row in df.iter_rows(named=True):
        # detected_factors : JSON string → object
        raw_factors = row.get("detected_factors")
        if isinstance(raw_factors, str):
            try:
                factors = json.loads(raw_factors)
            except Exception:
                factors = []
        else:
            factors = []

        # analysis_reasons : peut être une liste ou None
        reasons = row.get("analysis_reasons") or []
        if not isinstance(reasons, list):
            reasons = []

        releases.append({
            "id":               row.get("id"),
            "name":             row.get("name"),
            "tag":              row.get("tag"),
            "url":              row.get("url"),
            "published_at":     str(row.get("published_at") or ""),
            "source":           row.get("source"),
            "body_excerpt":     row.get("body_excerpt") or "",
            # Scoring
            "impact_score":     _to_json_safe(row.get("impact_score") or row.get("technical_score")),
            "impact_level":     row.get("impact_level") or "unknown",
            "technical_score":  _to_json_safe(row.get("technical_score")),
            "relevance_score":  _to_json_safe(row.get("relevance_score")),
            "final_score":      _to_json_safe(row.get("final_score")),
            "detected_factors": factors,
            "action_recommended": row.get("action_recommended") or "",
            "analysis_reasons": reasons,
        })

    payload = {
        "releases":    releases,
        "trends":      old_trends,
        "discoveries": old_discoveries,
    }
    DATA_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK " + str(len(releases)) + " releases exportees vers " + str(DATA_JSON))


def main() -> None:
    print(f"Chargement depuis {DB_PATH} ...")
    df = _load_from_db()
    print(f"   {len(df)} releases chargees")

    print("Re-scoring avec le nouveau moteur ...")
    df = _rescore(df)

    # Résumé
    lvl_counts = df.group_by("impact_level").agg(pl.len().alias("n")).sort("n", descending=True)
    print("   Resume des niveaux d'impact :")
    for row in lvl_counts.iter_rows(named=True):
        print(f"     {row['impact_level']:12s} : {row['n']}")

    print("Export vers data.json ...")
    _export(df)


if __name__ == "__main__":
    main()
