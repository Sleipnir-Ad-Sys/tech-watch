"""
Summarizer — génération de résumés texte structurés SANS LLM.

Utilise des templates et des heuristiques pour extraire :
- Les changements clés depuis le body de la release
- Le niveau d'impact
- Les breaking changes
- Un résumé lisible pour le frontend

Architecture prévue pour un remplacement futur par un LLM
(injecter un SummarizerBackend alternatif).
"""

from __future__ import annotations

import re
from datetime import datetime

import polars as pl

from logger import get_logger
from models import ImpactLevel, ProcessedRelease, SummaryReport

logger = get_logger(__name__)

# Marqueurs de sections dans les changelogs GitHub (style Keep a Changelog)
_SECTION_HEADERS = re.compile(
    r"^#{1,3}\s*(added|changed|deprecated|removed|fixed|security|breaking|new|improvements?|bug\s*fix)",
    re.IGNORECASE | re.MULTILINE,
)

# Lignes de liste markdown
_LIST_ITEM_RE = re.compile(r"^[\s]*[-*+]\s+(.+)$", re.MULTILINE)


def extract_changes(body: str, max_items: int = 8) -> list[str]:
    """
    Extrait les changements clés d'un body de release.

    Stratégie :
    1. Cherche les items de liste markdown (- item)
    2. Filtre les lignes trop courtes ou trop longues
    3. Déduplique

    Args:
        body: Texte brut du body de release (nettoyé)
        max_items: Nombre max d'items à retourner

    Returns:
        Liste de chaînes décrivant les changements
    """
    changes: list[str] = []
    seen: set[str] = set()

    for m in _LIST_ITEM_RE.finditer(body):
        item = m.group(1).strip()

        # Filtres qualité
        if len(item) < 10 or len(item) > 300:
            continue
        # Exclure les lignes qui sont uniquement un lien ou un hash commit
        if re.match(r"^https?://", item) or re.match(r"^[a-f0-9]{7,40}$", item):
            continue

        # Normalisation
        item_clean = item.rstrip(".").strip()
        if item_clean.lower() not in seen:
            seen.add(item_clean.lower())
            changes.append(item_clean)

        if len(changes) >= max_items:
            break

    # Fallback : si pas de liste, on prend les premières phrases
    if not changes:
        sentences = re.split(r"[.!?]\s+", body[:1000])
        for s in sentences:
            s = s.strip()
            if 20 <= len(s) <= 200:
                changes.append(s)
            if len(changes) >= 3:
                break

    return changes


def generate_summary(release: ProcessedRelease) -> SummaryReport:
    """
    Génère un SummaryReport structuré pour une release.

    Args:
        release: Release enrichie par le pipeline

    Returns:
        SummaryReport prêt pour affichage ou export
    """
    changes = extract_changes(release.body_excerpt)

    # Si pas de changes extraits, message par défaut
    if not changes:
        version_str = ""
        if release.version_major is not None:
            version_str = f"{release.version_major}.{release.version_minor}.{release.version_patch}"
        changes = [f"Release {version_str} — voir les notes complètes sur {release.html_url}"]

    date_str = ""
    if release.published_at:
        date_str = release.published_at.strftime("%Y-%m")
    else:
        date_str = datetime.utcnow().strftime("%Y-%m")

    return SummaryReport(
        release_id=release.id,
        lib_name=release.name,
        version=release.tag,
        date=date_str,
        changes=changes,
        impact=ImpactLevel(release.impact_level),
        breaking=release.has_breaking_change,
        category=release.category,
    )


def format_summary_text(report: SummaryReport) -> str:
    """
    Formate un SummaryReport en texte lisible (pour CLI ou export).

    Exemple de sortie :
        ─────────────────────────────────────
        LIB     : pola-rs/polars
        VERSION : v1.2.0
        DATE    : 2026-05
        IMPACT  : HIGH  ⚠ BREAKING CHANGE

        CHANGES :
          • amélioration lazy execution
          • optimisation groupby
          • fix memory leak
        ─────────────────────────────────────
    """
    separator = "─" * 50
    breaking_flag = "  ⚠  BREAKING CHANGE" if report.breaking else ""
    impact_icon = {
        ImpactLevel.CRITICAL: "🔴",
        ImpactLevel.HIGH: "🟠",
        ImpactLevel.MEDIUM: "🟡",
        ImpactLevel.LOW: "🟢",
        ImpactLevel.UNKNOWN: "⚪",
    }.get(report.impact, "⚪")

    changes_text = "\n".join(f"  • {c}" for c in report.changes)

    return (
        f"\n{separator}\n"
        f"LIB     : {report.lib_name}\n"
        f"VERSION : {report.version}\n"
        f"DATE    : {report.date}\n"
        f"IMPACT  : {impact_icon} {report.impact.value.upper()}{breaking_flag}\n"
        f"\nCHANGES :\n{changes_text}\n"
        f"{separator}\n"
    )


def generate_all_summaries(df: pl.DataFrame) -> list[SummaryReport]:
    """
    Génère les SummaryReport pour toutes les releases d'un DataFrame.

    Args:
        df: DataFrame enrichi (colonnes ProcessedRelease)

    Returns:
        Liste de SummaryReport
    """
    if df.is_empty():
        return []

    summaries: list[SummaryReport] = []

    for row in df.iter_rows(named=True):
        try:
            release = ProcessedRelease.model_validate(row)
            summary = generate_summary(release)
            summaries.append(summary)
        except Exception as exc:
            logger.warning(
                "summarizer.row_error",
                id=row.get("id"),
                error=str(exc),
            )

    logger.info("summarizer.done", count=len(summaries))
    return summaries
