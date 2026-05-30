"""
Transform — pipeline Polars de nettoyage et normalisation.

Transformations :
1. Parsing et validation des versions sémantiques (major.minor.patch)
2. Déduplication sur (owner, repo, tag)
3. Nettoyage du body / changelog
4. Extraction d'un extrait normalisé
5. Enrichissement avec métadonnées calculées
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime

import polars as pl

from config import load_config
from logger import get_logger
from models import RawRelease

logger = get_logger(__name__)

# Regex pour semver : v1.2.3, 1.2.3, v1.2, 1.2, etc.
_SEMVER_RE = re.compile(
    r"v?(?P<major>\d+)\.(?P<minor>\d+)(?:\.(?P<patch>\d+))?(?:[.\-].*)?$"
)

_BREAKING_PATTERNS = [
    r"BREAKING[\s_-]?CHANGE",
    r"BREAKING:",
    r"\[breaking\]",
    r"incompatible",
    r"migration required",
    r"removed.*deprecated",
]
_BREAKING_RE = re.compile("|".join(_BREAKING_PATTERNS), re.IGNORECASE)


def parse_semver(tag: str) -> tuple[int | None, int | None, int | None]:
    """
    Parse un tag de version en (major, minor, patch).
    Retourne (None, None, None) si le tag n'est pas parseable.
    """
    m = _SEMVER_RE.search(tag)
    if not m:
        return None, None, None
    major = int(m.group("major"))
    minor = int(m.group("minor"))
    patch = int(m.group("patch")) if m.group("patch") else 0
    return major, minor, patch


def make_release_id(owner: str, repo: str, tag: str) -> str:
    """Génère un identifiant unique déterministe pour une release."""
    raw = f"{owner}/{repo}@{tag}".lower()
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def extract_breaking_snippets(body: str) -> list[str]:
    """
    Extrait les lignes contenant des marqueurs de breaking change.
    Retourne jusqu'à 5 extraits.
    """
    snippets: list[str] = []
    for line in body.splitlines():
        if _BREAKING_RE.search(line):
            snippet = line.strip()[:200]
            if snippet and snippet not in snippets:
                snippets.append(snippet)
        if len(snippets) >= 5:
            break
    return snippets


def clean_body(body: str | None) -> str:
    """Nettoie le body d'une release (markdown basique → texte)."""
    if not body:
        return ""
    # Supprime les blocs de code
    body = re.sub(r"```[\s\S]*?```", "", body)
    # Supprime les liens markdown [[texte](url)]
    body = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", body)
    # Supprime les balises HTML simples
    body = re.sub(r"<[^>]+>", "", body)
    # Normalise les espaces
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()[:2000]


def transform_releases(raw_releases: list[RawRelease]) -> pl.DataFrame:
    """
    Transforme une liste de RawRelease en DataFrame Polars normalisé.

    Colonnes produites :
        id, source, name, tag, version_major, version_minor, version_patch,
        published_at, category, body_excerpt, has_breaking_change,
        breaking_snippets, repo_weight, html_url, collected_at
    """
    if not raw_releases:
        return _empty_releases_df()

    rows: list[dict] = []

    for r in raw_releases:
        major, minor, patch = parse_semver(r.tag_name)
        body_clean = clean_body(r.body)
        has_breaking = bool(_BREAKING_RE.search(body_clean))
        snippets = extract_breaking_snippets(body_clean) if has_breaking else []

        rows.append({
            "id": make_release_id(r.repo_owner, r.repo_name, r.tag_name),
            "source": r.source.value,
            "name": f"{r.repo_owner}/{r.repo_name}",
            "tag": r.tag_name,
            "version_major": major,
            "version_minor": minor,
            "version_patch": patch,
            "published_at": r.published_at,
            "category": r.category,
            "body_excerpt": body_clean[:2000],
            "has_breaking_change": has_breaking,
            "breaking_snippets": snippets,
            "repo_weight": r.repo_weight,
            "html_url": r.html_url,
            "collected_at": r.collected_at,
        })

    df = pl.DataFrame(rows, schema_overrides={
        "version_major": pl.Int32,
        "version_minor": pl.Int32,
        "version_patch": pl.Int32,
        "has_breaking_change": pl.Boolean,
        "repo_weight": pl.Float64,
    })

    # Déduplication : on garde la release la plus récente par (name, tag)
    df = (
        df.sort("collected_at", descending=True)
        .unique(subset=["id"], keep="first")
    )

    logger.info(
        "transform.releases_done",
        input=len(raw_releases),
        output=len(df),
    )
    return df


def _empty_releases_df() -> pl.DataFrame:
    """Retourne un DataFrame vide avec le bon schéma."""
    return pl.DataFrame({
        "id": pl.Series([], dtype=pl.Utf8),
        "source": pl.Series([], dtype=pl.Utf8),
        "name": pl.Series([], dtype=pl.Utf8),
        "tag": pl.Series([], dtype=pl.Utf8),
        "version_major": pl.Series([], dtype=pl.Int32),
        "version_minor": pl.Series([], dtype=pl.Int32),
        "version_patch": pl.Series([], dtype=pl.Int32),
        "published_at": pl.Series([], dtype=pl.Datetime),
        "category": pl.Series([], dtype=pl.Utf8),
        "body_excerpt": pl.Series([], dtype=pl.Utf8),
        "has_breaking_change": pl.Series([], dtype=pl.Boolean),
        "breaking_snippets": pl.Series([], dtype=pl.List(pl.Utf8)),
        "repo_weight": pl.Series([], dtype=pl.Float64),
        "html_url": pl.Series([], dtype=pl.Utf8),
        "collected_at": pl.Series([], dtype=pl.Datetime),
    })
