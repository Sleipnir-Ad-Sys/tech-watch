"""
run_pipeline.py — point d'entrée principal du pipeline complet.

Étapes :
1. Collecte (GitHub + RSS + PyPI)
2. Transformation Polars
3. Scoring
4. Classification par RuleEngine
5. Stockage DuckDB + export Parquet
6. Calcul des tendances
7. Génération des résumés
8. Export web/data.json pour GitHub Pages

Usage :
    python -m scripts.run_pipeline
    python -m scripts.run_pipeline --no-github --no-rss
    python -m scripts.run_pipeline --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.table import Table

from collectors.registry import CollectorRegistry
from config import load_config
from engine.classifier import classify_releases
from engine.summarizer import format_summary_text, generate_all_summaries
from logger import configure_logging, get_logger
from models import ImpactLevel, RawPackageRelease, RawRelease, SourceType, TrendDirection
from pipeline.scoring import compute_scores
from pipeline.storage import export_to_parquet, init_db, upsert_releases
from pipeline.transform import transform_releases
from pipeline.trends import compute_trends

configure_logging()
logger = get_logger(__name__)
console = Console()


def _pypi_to_raw_releases(pypi_releases: list[RawPackageRelease]) -> list[RawRelease]:
    """Convertit les releases PyPI en RawRelease pour le pipeline unifié."""
    converted = []
    for pkg in pypi_releases:
        converted.append(
            RawRelease(
                source=SourceType.PYPI,
                repo_owner="pypi",
                repo_name=pkg.package_name,
                tag_name=pkg.version,
                name=pkg.package_name,
                body=pkg.summary or "",
                published_at=pkg.upload_time,
                html_url=f"https://pypi.org/project/{pkg.package_name}/{pkg.version}/",
                prerelease=False,
                draft=False,
                category=pkg.category,
                repo_weight=pkg.weight,
                collected_at=pkg.collected_at,
            )
        )
    return converted


def run_pipeline(
    enable_github: bool = True,
    enable_rss: bool = True,
    enable_pypi: bool = True,
    enable_discovery: bool = True,
    dry_run: bool = False,
) -> dict:
    """
    Exécute le pipeline complet de veille technologique.

    Args:
        enable_github: Activer le collector GitHub
        enable_rss: Activer le collector RSS
        enable_pypi: Activer le collector PyPI
        enable_discovery: Activer la découverte automatique de nouveaux outils
        dry_run: Si True, ne stocke rien et n'exporte rien

    Returns:
        Dictionnaire de métriques d'exécution
    """
    start = datetime.utcnow()
    cfg = load_config()

    console.rule("[bold blue]🔭 Tech Watch Pipeline[/bold blue]")
    logger.info("pipeline.start", dry_run=dry_run)

    # ------------------------------------------------------------------
    # 1. Initialisation DB
    # ------------------------------------------------------------------
    if not dry_run:
        init_db()

    # ------------------------------------------------------------------
    # 2. Collecte
    # ------------------------------------------------------------------
    console.print("\n[cyan]→ Collecte des données...[/cyan]")
    registry = CollectorRegistry(
        enable_github=enable_github,
        enable_rss=enable_rss,
        enable_pypi=enable_pypi,
        enable_discovery=enable_discovery,
    )
    result = registry.run_all()
    console.print(f"  ✓ {len(result.releases)} releases GitHub")
    console.print(f"  ✓ {len(result.articles)} articles RSS")
    console.print(f"  ✓ {len(result.pypi_releases)} releases PyPI")
    if enable_discovery:
        console.print(f"  ✓ {len(result.discoveries)} outils découverts (radar)")

    # ------------------------------------------------------------------
    # 3. Transformation Polars
    # ------------------------------------------------------------------
    console.print("\n[cyan]→ Transformation des données...[/cyan]")
    all_releases = result.releases + _pypi_to_raw_releases(result.pypi_releases)
    df = transform_releases(all_releases)
    console.print(f"  ✓ {len(df)} releases normalisées ({len(result.releases)} GitHub, {len(result.pypi_releases)} PyPI)")

    if df.is_empty():
        logger.warning("pipeline.no_data")
        console.print("[yellow]  ⚠ Aucune release collectée.[/yellow]")
        # Exporter quand même data.json si des découvertes sont disponibles
        if result.discoveries and not dry_run:
            console.print("[cyan]→ Export data.json (découvertes uniquement)...[/cyan]")
            _export_web_json(df, [], [], result.discoveries)
            console.print(f"  ✓ {len(result.discoveries)} outils exportés dans web/data.json")
        return {"status": "no_data", "discoveries": len(result.discoveries), "duration_s": 0}

    # ------------------------------------------------------------------
    # 4. Scoring
    # ------------------------------------------------------------------
    console.print("\n[cyan]→ Calcul des scores d'impact...[/cyan]")
    df = compute_scores(df)

    # ------------------------------------------------------------------
    # 5. Classification par RuleEngine
    # ------------------------------------------------------------------
    console.print("\n[cyan]→ Classification par règles métier...[/cyan]")
    df = classify_releases(df)

    critical_count = len(df.filter(df["impact_level"] == ImpactLevel.CRITICAL.value))
    high_count = len(df.filter(df["impact_level"] == ImpactLevel.HIGH.value))
    console.print(f"  ✓ {critical_count} critiques, {high_count} high impact")

    # ------------------------------------------------------------------
    # 6. Stockage
    # ------------------------------------------------------------------
    if not dry_run:
        console.print("\n[cyan]→ Stockage DuckDB...[/cyan]")
        upsert_releases(df)
        export_to_parquet(df, "releases")
        console.print(f"  ✓ {len(df)} releases stockées")

    # ------------------------------------------------------------------
    # 7. Tendances
    # ------------------------------------------------------------------
    console.print("\n[cyan]→ Calcul des tendances...[/cyan]")
    trends = compute_trends(df)
    rising = [t for t in trends if t.direction == TrendDirection.RISING]
    console.print(f"  ✓ {len(trends)} projets analysés, {len(rising)} en hausse")

    # ------------------------------------------------------------------
    # 8. Résumés
    # ------------------------------------------------------------------
    console.print("\n[cyan]→ Génération des résumés...[/cyan]")
    summaries = generate_all_summaries(df)

    # Affichage des releases critiques
    critical_df = df.filter(df["impact_level"] == ImpactLevel.CRITICAL.value)
    if not critical_df.is_empty():
        console.print("\n[red bold]🔴 Releases CRITIQUES :[/red bold]")
        for row in critical_df.head(5).iter_rows(named=True):
            console.print(f"  • {row['name']} {row['tag']} — score: {row['impact_score']:.1f}")

    # ------------------------------------------------------------------
    # 9. Export web/data.json
    # ------------------------------------------------------------------
    if not dry_run:
        console.print("\n[cyan]→ Export frontend data.json...[/cyan]")
        _export_web_json(df, trends, summaries, result.discoveries)
        console.print("  ✓ web/data.json mis à jour")

    # ------------------------------------------------------------------
    # Métriques finales
    # ------------------------------------------------------------------
    duration = (datetime.utcnow() - start).total_seconds()
    metrics = {
        "status": "success",
        "releases": len(df),
        "articles": len(result.articles),
        "pypi": len(result.pypi_releases),
        "discoveries": len(result.discoveries),
        "critical": critical_count,
        "high": high_count,
        "trends": len(trends),
        "summaries": len(summaries),
        "duration_s": round(duration, 2),
    }

    console.rule("[bold green]✅ Pipeline terminé[/bold green]")
    console.print(f"  Durée : {duration:.1f}s")

    _print_summary_table(df, trends)

    logger.info("pipeline.done", **metrics)
    return metrics


def _export_web_json(df, trends, summaries, discoveries=None) -> None:
    """
    Exporte les données au format JSON pour le frontend GitHub Pages.
    Structure : { releases: [...], trends: [...], summaries: [...], discoveries: [...], updated_at: "..." }
    """
    cfg = load_config()
    web_path = Path(cfg.paths.web_data)
    web_path.parent.mkdir(parents=True, exist_ok=True)

    # Sérialisation — tri par date de publication décroissante, top 100
    releases_data = []
    df_export = df.sort("published_at", descending=True, nulls_last=True).head(100)
    for row in df_export.iter_rows(named=True):
        r = {}
        for k, v in row.items():
            if k == "detected_factors":
                # Peut être une chaîne JSON (depuis DuckDB) ou une liste Python
                if isinstance(v, str):
                    try:
                        r[k] = json.loads(v)
                    except Exception:
                        r[k] = []
                elif v is None:
                    r[k] = []
                else:
                    r[k] = v
            elif k == "analysis_reasons":
                r[k] = v if v is not None else []
            elif hasattr(v, "isoformat"):
                r[k] = v.isoformat()
            elif isinstance(v, list):
                r[k] = v
            else:
                r[k] = v
        releases_data.append(r)

    trends_data = [t.model_dump(mode="json") for t in trends]

    summaries_data = []
    for s in summaries[:20]:
        d = s.model_dump(mode="json")
        summaries_data.append(d)

    discoveries_data = []
    for repo in (discoveries or []):
        discoveries_data.append(repo.model_dump(mode="json"))

    payload = {
        "updated_at": datetime.utcnow().isoformat(),
        "releases": releases_data,
        "trends": trends_data,
        "summaries": summaries_data,
        "discoveries": discoveries_data,
    }

    with web_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)


def _print_summary_table(df, trends) -> None:
    """Affiche un tableau récapitulatif dans le terminal."""
    table = Table(title="Top Releases par Impact", show_header=True, header_style="bold cyan")
    table.add_column("Projet", style="white")
    table.add_column("Tag", style="cyan")
    table.add_column("Impact", style="bold")
    table.add_column("Score", justify="right")
    table.add_column("Catégorie")

    impact_colors = {
        "critical": "red",
        "high": "orange3",
        "moderate": "yellow",
        "medium": "yellow",
        "low": "green",
    }

    top = df.sort("final_score" if "final_score" in df.columns else "impact_score", descending=True).head(10)
    for row in top.iter_rows(named=True):
        level = row.get("impact_level", "unknown")
        color = impact_colors.get(level, "white")
        final = row.get("final_score") or row.get("impact_score", 0)
        table.add_row(
            row.get("name", ""),
            row.get("tag", ""),
            f"[{color}]{level.upper()}[/{color}]",
            f"{final:.1f}",
            row.get("category", ""),
        )

    console.print(table)


def main() -> None:
    parser = argparse.ArgumentParser(description="Tech Watch Pipeline")
    parser.add_argument("--no-github", action="store_true", help="Désactiver GitHub collector")
    parser.add_argument("--no-rss", action="store_true", help="Désactiver RSS collector")
    parser.add_argument("--no-pypi", action="store_true", help="Désactiver PyPI collector")
    parser.add_argument("--no-discovery", action="store_true", help="Désactiver la découverte automatique")
    parser.add_argument("--dry-run", action="store_true", help="Mode test — sans stockage")
    args = parser.parse_args()

    metrics = run_pipeline(
        enable_github=not args.no_github,
        enable_rss=not args.no_rss,
        enable_pypi=not args.no_pypi,
        enable_discovery=not args.no_discovery,
        dry_run=args.dry_run,
    )

    if metrics["status"] != "success":
        sys.exit(1)


if __name__ == "__main__":
    main()
